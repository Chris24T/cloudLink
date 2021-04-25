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
    { fileInfo, existingFileData },
    { targets, blockWidth: chunkSize = 4194304, mode }
  ) {
    //! Have targets, so also have usage - can distribute based on that
    //! will also need to set usage at some point though from front end
    const { uploadType, isSmart } = mode;
    const { name, path, size } = fileInfo;
    const vendorList = Object.keys(targets);

    const toUpload = vendorList.reduce((acc, v) => (acc[v] = []) && acc, {}),
      toDelete = vendorList.reduce((acc, v) => (acc[v] = []) && acc, {}),
      toRename = vendorList.reduce((acc, v) => (acc[v] = []) && acc, {});

    let partCounter = 0,
      lastMatchOffset = 0,
      offset = 0,
      step = 1;

    //chunk entire file
    console.log("PH Recieved Config:", mode);
    console.log("PH Recieved FileDetails:", fileInfo);
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
    } else if (parseInt(uploadType) === 3) {
      //mirror stripe - upload as split file, to all connected drives (copied), delete existing parts if not smart

      let fileParts;
      if (!isSmart || !existingFileData.isData) {
        fileParts = await this.chunkBetween(path, {
          start: 0,
          end: size,
          chunkSize,
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
      } else if (existingFileData && isSmart) {
        console.log("PH: INITATING RECOVERY");

        while (offset < size) {
          // Generate a (single) New part
          const newPart = (
            await this.chunkBetween(path, {
              start: offset,
              end: offset + chunkSize + 1,
              chunkSize,
              counter: partCounter,
            })
          )[0];

          //test new part against existing parts
          for (const [clientID, clientData] of Object.entries(
            existingFileData.parts
          )) {
            for (const [partName, partId] of clientData) {
              console.log(
                "PH-Checking Part: Existing vs New",
                partName,
                newPart.name
              );
              console.log("jello");
              if (partName.includes(newPart.name.split("_")[0])) {
                //found hash match
                console.log("hlleo");
                console.log("PH: Found Hash Match:", partName, newPart.name);
                //need to chunk everything that was not matched before this match
                const fileParts = await this.chunkBetween(path, {
                  start: lastMatchOffset, // starting at last match - chunk all data before current postition but after the last match
                  end: offset, //ending at current position
                  chunkSize,
                  partCounter,
                });

                // skip over duplicate (matched) chunk
                offset += chunkSize;
                // rember terminal offset of last match location (from end of chunk)
                lastMatchOffset = offset;
                // found an (existing) part, so must inc part counter
                partCounter++;

                if (parseInt(partName.split("_")[1]) !== partCounter) {
                  //push to toRename
                  const partNameChecksum = partName.split("_")[0];
                  toRename[clientID].push([
                    partNameChecksum + "_" + partCounter,
                    partId,
                  ]);
                } else {
                  //else dont have to push this matched part - do nothing with this part
                }

                //distribute new chunks to toUpload
                // fileParts.forEach((part) => {
                //   for (const vendor of vendorList) {
                //     toUpload[vendor].push(part);
                //   }
                // });
              } else {
                //No match, try very next chunk (at offset+1)
                console.log("inc offset", offset);
                offset += step;
              }
            }
          }
        }
        //need to build toDelete here (after chunking finished and we know what exists and what is redundant)
      }
    }

    return [toUpload, toDelete, toRename];

    async function recovery() {
      console.log("PH: INITATING RECOVERY");
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

              partCounter += editedRegionParts.length;

              //console.log("Edited Region", await editedRegionParts);

              editedRegionParts.forEach((part, i) => {
                if (uploadType === 2) {
                  //distribute equally
                  toUpload[vendorList[i % vendorList.length]].push(part);
                } else if (uploadType === 3) {
                  //duplicate across both
                }
              });

              if (parseInt(partName.split("||")[1]) !== partCounter) {
                const newName = newPartChecksum + "||" + partCounter;
                toRename[clientId].push([partId, newName, partName, dbxpath]);
              }

              partCounter += 1;
              lastMatchOffset = offset + chunkSize;

              //edited regions go to toUpload

              // if chunk position no longet correct, need to rename
            }
          }
        }

        offset += isFound ? chunkSize : 1;
        //partCounter += isFound ? 1 : 0;
      }

      //go through parts again, those not in "foundParts" need to be deleted
      for (const [clientId, clientData] of Object.entries(
        existingFileData.parts
      )) {
        for (const [partName, partId] of clientData) {
          if (!foundParts[clientId].includes(partId[0])) {
            toDelete[clientId].push([partName, partId]);
          }
        }
      }
      console.log("delete", toDelete);
      return;
    }
  }

  // splits a file into chunks, number of chunks depends on start and end param
  async chunkBetween(path, { start, end, chunkSize, counter = 0 }) {
    //console.log("Generating chunks between bytes:", start, end, "Chunk Size:", chunkSize)
    let parts = [];
    let offset = start;
    if (start === end) return parts;
    //console.log("PH: Chunking start end chunksize", start, end, chunkSize);

    while (offset < end) {
      const content = fs.createReadStream(path, {
          start: offset,
          end: offset + chunkSize > end ? end : offset + chunkSize,
        }),
        contentChecksum = await this.genContentHash(
          fs.createReadStream(path, {
            start: offset,
            end: offset + chunkSize > end ? end : offset + chunkSize,
          })
        );

      let part = {};

      part.name = contentChecksum + "||" + counter++;
      part.checksum = contentChecksum;
      part.content = content;
      part.size = offset + chunkSize > end ? end - offset : offset + chunkSize;
      // if (offset % chunkSize === 0)
      //   console.log("offset end chunksize", offset, end, chunkSize);
      //console.log("builtPart at offset end chunksize ", offset, end, chunkSize);
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
