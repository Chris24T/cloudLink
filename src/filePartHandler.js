const { createReadStream } = require("fs");
const splitFile = require("split-file");
const crypto = require("crypto");
const fs = require("fs");
const { content } = require("googleapis/build/src/apis/content");
const { off } = require("process");
class filePartHandler {
  genContentHash(rs) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("md5");

      rs.on("error", (err) => reject(err));
      rs.on("data", (chunk) => hash.update(chunk));
      rs.on("end", () => resolve(hash.digest("hex")));
    });
  }

  /**
   *
   * @param {object Object} file file meta data
   * @param {array} vendors array of string ids for recipient vendors
   * @param {object} config upload config - chunksize default:4194304(4MB)
   * @returns {object} looks like: {"google":[{part1, part3}], "dropbox":[{part2, part4}]}
   */
  async buildParts(
    { path, size, existingFileData },
    { connectedDrives: vendors, blockWidth: chunkSize = 4194304, mode }
  ) {
    const { uploadType, isSmart } = mode;

    let partCounter = 0,
      lastMatchOffset = 0,
      offset = 0,
      step = 1;

    const toUpload = vendors.reduce((acc, v) => (acc[v] = []) && acc, {}),
      toDelete = vendors.reduce((acc, v) => (acc[v] = []) && acc, {}),
      toRename = vendors.reduce((acc, v) => (acc[v] = []) && acc, {});

    // No data exists - chunk entire file -> overwrite any existing data

    /**
     * If
     */
    if (
      uploadType === 0 ||
      !existingFileData ||
      (uploadType === 2 && isSmart === 0)
    ) {
      const parts = await this.chunkBetween(path, {
        start: 0,
        end: size,
        chunkSize,
        counter: partCounter,
      });

      parts.forEach((part, i) => {
        toUpload[vendors[i % vendors.length]].push(part);
      });

      if (
        existingFileData &&
        (uploadType === 0 || (uploadType === 2 && isSmart === 0))
      ) {
        for (const [clientId, clientData] of Object.entries(existingFileData)) {
          toDelete[clientId] = Object.values(clientData.parts);
        }
      }

      return [toUpload, toDelete, toRename];
    }

    // recovery
    while (offset < size) {
      console.log(offset, step, chunkSize, size);
      // should only ever return one part
      const part = await this.chunkBetween(path, {
        start: offset,
        end: offset + chunkSize + 1,
        chunkSize,
        /*end:size+1*/ counter: partCounter,
      })[0];

      for (const [vendor, vendorData] of Object.entries(existingFileData)) {
        const { parts: existingParts } = vendorData;

        for (const existingPart of Object.values(existingParts)) {
          if (existingPart["name"].includes(part.checksum)) {
            // * Match found
            //console.log("Chunk match found")
            // init position array - stores the partnumber where the match was made
            existingPart.position = existingPart.position || [];

            // found a duplicate chunk,
            // can now chunk all data before this point and the last match (the edited region)
            //? should internally increment part counter for each chunk it generates
            // distributing new uplaods equally - //!currently ignoring balancing file numbers across drives
            toUpload[vendors[partCounter % vendors.length]].push(
              ...this.chunkBetween(path, {
                start: lastMatchOffset,
                end: offset,
                chunkSize,
                counter: partCounter,
              })
            );
            // skip over duplicate (matched) chunk
            offset += chunkSize;
            // rember last match location
            lastMatchOffset = offset;
            // Mark chunk as still relevent (still existing in the data) - distinguishes redundant parts
            existingPart.isMatched = true;
            // record the order the parts appear - can be used to compress data if appears in more than one location
            existingPart.position.push(partCounter);
            // found an (existing) part, so must inc part counter
            partCounter++;
          } else console.log("No Match on Chunk");
        }
      }
      offset += step;
    }

    // only previously chunked the parts between matches
    // need to also chunk eveything after the last match
    // console.log("Final Region Chunking")
    toUpload[vendors[partCounter % vendors.length]].push(
      ...(await this.chunkBetween(path, {
        start: lastMatchOffset,
        end: offset,
        chunkSize: chunkSize,
        counter: partCounter,
      }))
    );

    // Identify redundant parts, mark for delete
    // identify parts whose position info is now incorrect
    for (const [vendor, vendorData] of Object.entries(existingFileData)) {
      const { parts: existingParts } = vendorData;

      for (const existingPart of Object.values(existingParts)) {
        // unmatched parts are redundant, mark for delete
        if (!existingPart.isMatched) toDelete[vendor].push(existingPart);

        //! ToDo: build toRename
        // identifying parts to rename, such that new correct order is reflected in old parts
        //if(existingPart.name === existinPart.position) {
        //  toRename[vendor]
      }
    }

    // looks like: [ {google:[part, part], dropbox:[part,part]}. {*same*}. {*same*}]
    return [toUpload, toDelete, toRename];
  }

  // splits a file into chunks, number of chunks depends on start and end param
  async chunkBetween(path, { start, end, chunkSize, counter = 0 }) {
    //console.log("Generating chunks between bytes:", start, end, "Chunk Size:", chunkSize)
    let parts = [];
    let offset = start;

    while (offset < end) {
      const content = fs.createReadStream(path, {
          start: offset,
          end: offset + chunkSize + 1,
        }),
        contentChecksum = await this.genContentHash(
          fs.createReadStream(path, {
            start: offset,
            end: offset + chunkSize + 1,
          })
        );

      let part = {};

      part.name = contentChecksum + "||" + counter++;
      part.checksum = contentChecksum;
      part.content = content;
      part.size = offset + chunkSize + 1;

      parts.push(part);
      // if is not returning incremented value, can just use the parent scopes "partCounter"

      offset += chunkSize;
    }

    return parts;
  }
}

filePartHandler.prototype.merge = function (chunkarr) {
  return async () => {
    try {
      await chunkarr;
    } catch (e) {
      console.log("parts could not be resolved");
    }
    let mergeFile = splitFile.mergeFiles(
      chunkarr,
      __dirname + "/output/merge.jpg"
    );
    return mergeFile;
  };
};

module.exports.partHandler = new filePartHandler();
