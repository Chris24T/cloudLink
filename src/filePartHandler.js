const { createReadStream } = require("fs");
const splitFile = require("split-file");
const crypto = require("crypto");
const fs = require("fs");
const { content } = require("googleapis/build/src/apis/content");
const { off } = require("process");
const { isCompositeComponent } = require("react-dom/test-utils");
class filePartHandler {
  //Generate a Hash of a read streams contents
  genContentHash(rs, type) {
    return new Promise((resolve, reject) => {
      let hash;

      switch (type) {
        case "md5":
          hash = crypto.createHash("md5");
          break;
        case "sha256":
          hash = crypto.createHash("sha256");
          break;
        default:
          hash = crypto.createHash("md5");
      }

      rs.on("error", (err) => reject(err));
      rs.on("data", (chunk) => hash.update(chunk));
      rs.on("end", () => resolve(hash.digest("hex")));
    });
  }

  //Constructs the individual file parts to be uploaded, from a given path
  async buildParts(
    { fileInfo, existingFileData },
    { targets, blockWidth: chunkSize = 5242880, recoveryDensity, mode }
  ) {
    const { uploadType, isSmart } = mode;
    const { path, size } = fileInfo;
    const vendorList = Object.keys(targets);

    const recoveryStepSize = recoveryDensity;

    //Build maps to store parts
    const toUpload = vendorList.reduce((acc, v) => (acc[v] = []) && acc, {}),
      toDelete = vendorList.reduce((acc, v) => (acc[v] = []) && acc, {}),
      toRename = vendorList.reduce((acc, v) => (acc[v] = []) && acc, {});

    let partCounter = 0,
      lastMatchOffset = 0,
      offset = 0,
      step = 1;

    //chunk entire file
    if (parseInt(uploadType) === 0) {
      //simple - upload file as single unit, to first drive with space, delete existing file
      console.log("PH Chunking Entrire File");
      const fileParts = await this.chunkBetween(path, {
        start: 0,
        end: size,
        chunkSize: size,
        counter: partCounter,
      });

      fileParts.forEach((part) => {
        toUpload[vendorList[0]].push(part);
      });

      if (existingFileData.isData) {
        for (const [clientId, clientData] of Object.entries(
          existingFileData.parts
        )) {
          toDelete[clientId] = clientData;
        }
      }
    } else if (parseInt(uploadType) === 1) {
      //mirror - upload file as single unit, to all connected drives, delete existing copies
      const fileParts = await this.chunkBetween(path, {
        start: 0,
        end: size,
        chunkSize: size,
        counter: partCounter,
      });

      fileParts.forEach((part) => {
        for (const vendor of vendorList) {
          toUpload[vendor].push(part);
        }
      });

      if (existingFileData.isData) {
        for (const [clientId, clientData] of Object.entries(
          existingFileData.parts
        )) {
          toDelete[clientId] = clientData;
        }
      }
    } else if (parseInt(uploadType) === 2) {
      //stripe - upload as split file, share between connected drives, delete existing parts if not smart
      let fileParts;
      if (!isSmart || !existingFileData.isData) {
        fileParts = await this.chunkBetween(path, {
          start: 0,
          end: size,
          chunkSize,
          counter: partCounter,
        });

        fileParts.forEach((part, i) => {
          toUpload[vendorList[i % vendorList.length]].push(part);
        });

        if (existingFileData.isData) {
          for (const [clientId, clientData] of Object.entries(
            existingFileData.parts
          )) {
            toDelete[clientId] = clientData;
          }
        }
      } else if (existingFileData && isSmart) {
        console.log("recveriong");
        //recovery
        await recovery.call(this);
        return [toUpload, toDelete, toRename];
      }
    }

    // return constructed instruction sets

    return [toUpload, toDelete, toRename];

    async function recovery() {
      console.log("INITATING RECOVERY");
      let isFound = false;
      let foundParts = JSON.parse(JSON.stringify(toDelete));
      while (offset < size) {
        isFound = false;

        // build test part
        const newPart = (
          await this.chunkBetween(path, {
            start: offset,
            end: offset + chunkSize,
            chunkSize,
            counter: partCounter,
          })
        )[0];

        const newPartChecksum = newPart.name.split("||")[0];

        //loop through existing parts
        //NB: partId is actually a keyring array (.mergedIds)

        for (const [clientId, clientData] of Object.entries(
          existingFileData.parts
        )) {
          for (const [partName, partId, dbxpath] of clientData) {
            //! path used only for dropbox rename
            if (partName.includes(newPartChecksum)) {
              isFound = true;
              foundParts[clientId].push(partId[0]);
              console.log("Hash Match Found");

              //need to recover edited regions now

              const editedRegionParts = await this.chunkBetween(path, {
                start: lastMatchOffset + 1, //start offset found in previous chunk, so +1?
                end: offset - 1, //end offset found in next chunk, so -1?
                chunkSize,
                counter: partCounter,
              });

              //Increment part counter so it is in sync
              partCounter += editedRegionParts.length;

              // Allocate part Owners
              editedRegionParts.forEach((part, i) => {
                if (uploadType === 2) {
                  //distribute equally
                  toUpload[vendorList[i % vendorList.length]].push(part);
                }
              });

              // Check to see if the position of the part in the local file matches the position in the remote file
              // if they dont match, instead of reuploading a new copy, just rename the existing one to reflect
              // its new position
              if (parseInt(partName.split("||")[1]) !== partCounter) {
                const newName = newPartChecksum + "||" + partCounter;
                toRename[clientId].push([partId, newName, partName, dbxpath]);
              }

              //Inc. part counter and last match offset to skip the matched chunk
              partCounter += 1;
              lastMatchOffset = offset + chunkSize;
            }
          }
        }

        //if a match was found, skip over it, else continue to next offset, as determined by the recoveryStep
        offset += isFound ? chunkSize : recoveryStepSize;
      }

      //get final data after last match
      const lastData = await this.chunkBetween(path, {
        start: lastMatchOffset + 1, //start offset found in previous chunk, so +1
        end: size, //end offset found in next chunk, so -1
        chunkSize,
        counter: partCounter,
      });

      //Set this final data to be uploaded
      lastData.forEach((part, i) => {
        toUpload[vendorList[i % vendorList.length]].push(part);
      });

      //Go through parts again, those not in "foundParts" need to be deleted
      // as they are redundant data
      for (const [clientId, clientData] of Object.entries(
        existingFileData.parts
      )) {
        for (const [partName, partId] of clientData) {
          if (!foundParts[clientId].includes(partId[0])) {
            toDelete[clientId].push([partName, partId]);
          }
        }
      }

      return;
    }
  }

  // splits a file into chunks, number of chunks depends on start and end param and chunksize
  async chunkBetween(path, { start, end, chunkSize, counter = 0 }) {
    let parts = [];
    let offset = start;
    if (start === end) return parts;

    while (offset < end) {
      // build content part for upload
      const content = fs.createReadStream(path, {
          start: offset,
          end: offset + chunkSize > end ? end : offset + chunkSize,
        }),
        //build content part for md5 checksum
        contentChecksum = await this.genContentHash(
          fs.createReadStream(path, {
            start: offset,
            end: offset + chunkSize > end ? end : offset + chunkSize,
          })
        ),
        //build content part for SHA checksum
        contentChecksumSha = await this.genContentHash(
          fs.createReadStream(path, {
            start: offset,
            end: offset + chunkSize > end ? end : offset + chunkSize,
          }),
          "sha256"
        );

      let part = {};

      part.name = contentChecksum + "||" + counter++;
      part.checksum = contentChecksum;
      part.md5Checksum = contentChecksum;
      part.sha256Checksum = contentChecksumSha;
      part.content = content;
      part.size = offset + chunkSize > end ? end - offset : chunkSize;

      parts.push(part);

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
