/* eslint-disable no-unused-vars */
const fs = require("fs");

const partitionInfoDB = require("node-localdb")("./partitionDB.json");
const tracksDB = require("node-localdb")("./trackingDB.json");

const { partHandler } = require("./filePartHandler");
const { callClients } = require("./auth/authController");

const { computeChecksum, eventChannel } = require("./helpers");
const { checkServerIdentity } = require("tls");
const { isCompositeComponent } = require("react-dom/test-utils");
const { ipcMain } = require("electron");

const Promise = require("bluebird");

/**
 * Controls the interpreting of data to/from the APIs
 * Enables abstraction of multiple drives into one
 */
class raidController {
  constructor() {
    // span, raid copy, raid split, raid parity
    this.init();
    this.config = {
      modes: [0, 1, 2, 3],
      mode: 0,
      SmartSync_enabled: false,
    };
  }

  deleteFiles(params, files) {
    files.forEach(({ partSources }) => {
      let responses = [];
      callClients((clientId, client) => {
        if (partSources[clientId]) client.deleteFiles(partSources[clientId]);
      });
    });
  }

  downloadFiles(params, files) {
    console.log("Download Request:", files);

    //parts need their order part:[positoin, id]
    files.forEach(({ fileInfo, partSources }) => {
      let responses = [];
      callClients((clientId, client) => {
        if (partSources[clientId])
          responses.push(client.downloadFiles(partSources[clientId]));
      });

      Promise.all(responses).then((driveResponses) => {
        let combinedResponse = [];

        driveResponses.forEach((response) => {
          response.forEach((part, i) => {
            if (part) {
              // in mirror: will override parts at equal positions: so mirror both position 0, only one is kept -> am still downloading both
              combinedResponse[i] = part;
            }
          });
        });

        console.log("Reconstructing from ", combinedResponse.length, " Parts");
        const writable = fs.createWriteStream("./Downloads/" + fileInfo.name, {
          emitClose: true,
          autoClose: true,
        });

        Promise.mapSeries(combinedResponse, (stream, index) => {
          const isLastIndex = index === combinedResponse.length - 1;
          console.log(index, combinedResponse.length);
          stream.on("data", (ch) => {
            console.log(ch.length);
          });
          stream.pipe(writable, { end: isLastIndex });
          return new Promise((resolve) => stream.on("end", resolve));
        });

        // stream.on("data", () => {
        //   console.log("RAID DATA");
        // });
        //console.log("index ", index, isLastIndex);

        // Promise.all(combinedResponse).then((streams) => {

        //   streams.forEach((partContent, i) => {
        //     console.log("part ", i, " merged");
        //     partContent.pipe(writable);
        //   });
        // });
        //should be in order already
        //just need to pipe to same write stream
        //use fileInfo here to get file name (and type)
      });
    });
  }

  check() {
    console.log("check");
    this.mark();
  }

  mark() {
    console.log("mark");
    this.check();
    return 5;
  }

  init() {
    this.startTracking();
    //this.startRefreshLoop()
  }

  /**
   *
   * @param {*} Object contains upload config e.g stripe + smart and info about target (upload dir - the parent)
   * @param {*} files list of files (meta) to upload
   */

  uploadFiles({ config, ...targetInfo }, files) {
    const { targets, mode, isTracked } = config; //partitionConfig
    let recipients = Object.keys(targets);

    // console.log("RC: Upload Target Info", targetInfo);
    // console.log("RC: Upload Files", files);
    // console.log("TrackStatus:", isTracked);
    const Stopwatch = require("statman-stopwatch");
    const localstopwatch = new Stopwatch();

    if (isTracked) addtrackedFiles(config, targetInfo, files);

    files.forEach(async (file) => {
      localstopwatch.start();
      const [
        toUploadParts,
        toDeleteParts,
        toRenameParts,
      ] = await partHandler.buildParts(file, config); // width is being passed from config
      console.log("Rsync duration: ", localstopwatch.stop());
      // const totalSize = Object.values(toUploadParts).reduce((acc, el, i) => {
      //   console.log("el i", i);
      //   for (const part of el) {
      //     console.log("part size:", part.size);
      //     acc += part.size;
      //     return acc;
      //   }
      // }, 0);

      let total = 0;

      for (const setOfPats of Object.values(toUploadParts)) {
        for (const part of setOfPats) {
          total += part.size;
        }
      }

      console.log("StartSize: ", file.fileInfo.size, " Upload Size: ", total);

      // console.log("RC: Parts To Upload", toUploadParts);
      let responses = [];

      callClients((clientId, client) => {
        // upload new data - edits
        //console.log("RC: todelete", toDeleteParts);
        client.deleteFiles(toDeleteParts[clientId]);

        //timeout for api rate limits
        setTimeout(() => {
          // delete redundant data

          responses.push(
            client.uploadFiles(
              [{ file, parts: toUploadParts[clientId] }],
              targetInfo,
              mode
            )
          );
        }, 1000);

        setTimeout(() => {
          client.renameFiles(toRenameParts[clientId]);
        }, 2000);

        //rename parts to retain correct parts ordering
        //client.renameFiles([{fileInfo:file, parts:toRenameParts[clientId]}], targetInfo)
      }, recipients);
    });

    async function addtrackedFiles(config, targetInfo, filesToTrack) {
      let filesProcessed = 0;
      filesToTrack.forEach(async (file) => {
        const path = file.fileInfo.path;

        const md5Checksum = await computeChecksum(path);

        // if not being tracked, track it
        console.log("tracksDb", await tracksDB.find({ path }));
        if ((await tracksDB.find({ path })).length === 0) {
          //also need checksum here to compare against
          console.log("inserting cehcksum", md5Checksum);
          delete targetInfo.children;
          tracksDB.insert({
            path,
            fileInfo: { ...file.fileInfo, md5Checksum },
            config,
            targetInfo,
          });
        }
        filesProcessed++;
      });
    }
  }

  async startTracking() {
    //at interval get
    setInterval(async () => {
      //compute cheksums of each tracked path
      const tracked = await tracksDB.find({});
      // console.log("tracked", tracked);
      tracked.forEach(async (file) => {
        const { fileInfo, config, targetInfo } = file;
        const { path, md5Checksum } = fileInfo;
        try {
          const currentChecksum = await computeChecksum(path);
          //console.log("cur", currentChecksum, "last", md5Checksum);
          //console.log("cur ", currentChecksum, " vs ", md5Checksum);
          if (currentChecksum !== md5Checksum) {
            //reupload file, by path, to its current location.
            //need to get all file info from tracksDB

            //send reqeust to frontend to simulate a drop
            //will need all the drop info + parittion config info + fileDetails
            eventChannel.emit(
              "tracked_File_Mismatch",
              fileInfo,
              config,
              targetInfo
            );
            //could "simulate drop" of all mutated files at once, or just do deqeuntially
            // current: sequential
            console.log("Tracked Change Detected, Reuploading");

            console.log("Relecting in DB");
            // Mutate existing entry - updating checksum in db
            console.log("DOESNT EXIST");
            const existingEntry = await tracksDB.find({ path });
            console.log("Existing ", existingEntry);
            //existingEntry.fileInfo.md5Checksum = currentChecksum;
            console.log("HERE");
            //delete existing entry
            tracksDB.remove({ path }).then((v) => console.log("v", v));
            //replace with new
            existingEntry.fileInfo.md5Checksum = currentChecksum;
            const newEntry = existingEntry;
            tracksDB.insert(newEntry).then((u) => console.log("u", u));
            //need to update db entry to include new checksum
          }
        } catch (e) {
          //console.log("Path No Longer Exists ", path);
        }
      });

      //check if they differ form stored one

      //if yes, reupload

      //else, continue
      //}, 900000);
    }, 15000);
  }

  createFolder(
    { targetDrive, targetPath },
    {
      name,
      isPartition,
      isTracked,
      blockWidth,
      recoveryDensity,
      allocation,
      mode,
    }
  ) {
    //console.log("CREATING FOLDER in", targetPath);
    // console.log("fodler create targetrs", targetDrive);
    // console.log("fodler create targetrs", targetPath);
    if (isPartition) {
      //Parition folder creation
      name = "p_" + name;
      //("will loop over", Object.entries(allocation));
      const targets = Object.entries(allocation).reduce(
        (acc, [drive, alloc]) => {
          //console.log("loop", drive, alloc);
          if (alloc.limit) acc[drive] = alloc;
          return acc;
        },
        {}
      );

      //want the names of the drives whose limit is non zero

      //console.log("Parition Name", name);
      partitionInfoDB.insert({
        name,
        mode,
        targets,
        tracks: [],
        isTracked,
        blockWidth,
        recoveryDensity,
      });
      callClients((clientId, client) => {
        client.createPartitionFolder(name);
      }, Object.keys(targets));
    } else {
      //Standard Folder Creation
      callClients((clientId, client) => {
        client.createFolderByPath(targetPath, name);
      }, Object.keys(targetDrive));
    }

    return;
  }

  getSpaceUsage() {
    let usage = [];
    callClients((clientID, client) => {
      usage.push(client.getSpaceUsage());
    });

    return Promise.all(usage).then((usage) => {
      //console.log("usage", usage);
      return usage.reduce((acc, el) => {
        acc[el.origin] = el;
        return acc;
      }, {});
    });
  }

  listFiles() {
    let clientResponses = [];

    callClients((clientId, client) => {
      const p = new Promise((res) => {
        const resp = client.listFiles();

        res(resp);
      });
      p.origin = clientId;
      const l = new Promise((res) => res(p));
      clientResponses.push(l);
    });

    return Promise.all(clientResponses).then((fileLists) => {
      const formattedList = formatLists(fileLists);
      return formattedList;
    });
  }
}

raidController.prototype.getCapacities = function () {
  let capacities = [];
  this.fileTable.connectedDrives.callClients(({ key, client }) => {
    capacities.push(client.getCapacity());
  });

  return capacities;

  const clients = this.config.clients;
  let res = [];
  Object.keys(clients).forEach((clientKey) => {
    const client = clients[clientKey];
    //res[clientKey] = clients[clientKey].getCapacity()
    res.push(client.getCapacity());
  });

  return res;
};

async function formatLists(lists) {
  const formatOptions = {
    google: _formatGoogle,
    dropbox: _formatDropbox,
  };
  let parentList = {};

  for (const { entries: list, origin } of lists) {
    // console.log(origin, " list ", list);
    let sublist = await formatOptions[origin](list, origin);

    if (!Object.keys(parentList).length) {
      parentList = { ...sublist, ...parentList };

      continue;
    }

    for (const entry of Object.values(sublist)) {
      if (parentList[entry.name]) {
        //Two folders with same name detected (across drives)
        const parentListEntry = parentList[entry.name];
        const newChildren = entry.children;
        const oldChildren = parentListEntry.children;

        // merge - am not merging individual children -> mergeID

        //parentListEntry.children = { ...newChildren, ...oldChildren };

        parentListEntry.children = mergeChildren(newChildren, oldChildren);

        parentListEntry.mergedIDs = {
          ...parentListEntry.mergedIDs,
          ...entry.mergedIDs,
        };

        // if (parentListEntry.isPartitionFolder) {
        //   // if is partition, merge ids as child so it shows as mixed when looking at it as a child
        //   parentList["home"].children[parentListEntry.name].mergedIDs =
        //     parentListEntry.mergedIDs;
        // }

        //add back mutated version
        parentList[entry.name] = parentListEntry;
      } else {
        parentList[entry.name] = entry;
      }
    }
  }

  function mergeChildren(a, b) {
    for (const childA of Object.values(a)) {
      for (const childB of Object.values(b)) {
        if (childA.name === childB.name) {
          // essentially merge ( and delete one) children of duplicate name
          childA.mergedIDs = {
            ...childA.mergedIDs,
            ...childB.mergedIDs,
          };

          a[childA.name] = childA;
          delete b[childB.name];
        }
      }
    }

    return { ...a, ...b };
  }

  // Make folder for files not in a partition
  parentList["p_Unpartitioned Files"] = {
    name: "p_Unpartitioned Files",
    mergedIDs: {},
    isPartitionFolder: true,
    isFolder: true,
    children: {},
  };

  // add folder to root children
  parentList["home"].children["p_Unpartitioned Files"] = {
    name: "p_Unpartitioned Files",
    mergedIDs: {},
    isPartitionFolder: true,
    isFolder: true,
  };

  for (const child of Object.values(parentList["home"].children)) {
    if (!child.isPartitionFolder) {
      // console.log("child", child);
      parentList["p_Unpartitioned Files"].children[child.name] = child;
      parentList["p_Unpartitioned Files"].mergedIDs[
        Object.keys(child.mergedIDs)[0]
      ] = "";
      parentList["home"].children["p_Unpartitioned Files"].mergedIDs[
        Object.keys(child.mergedIDs)[0]
      ] = "";
      delete parentList["home"].children[child.name];
    }
  }

  // if it has no children, dont show it
  if (Object.keys(parentList["p_Unpartitioned Files"].children).length === 0) {
    delete parentList["home"].children["p_Unpartitioned Files"];
  }
  //console.log("Built List, sending to front", parentList);

  return parentList;

  function _formatDropbox(list, origin) {
    // will have to index by name, due to children identified by path of names (not ids)
    // then convert to by ID

    const listByName = list.reduce(
      (acc, el) => {
        const parentName = el.path_display.split("/").reverse()[1] || "home";

        if (el[".tag"] === "folder") {
          if (el.name.includes("p_")) {
            el.isPartitionFolder = true;
            el.partitionConfig = partitionInfoDB.find({ name: el.name });
          }
          acc[el.name] = acc[el.name] || {
            name: el.name,
            isPartitionFolder: el.isPartitionFolder || false,
            partitionConfig: el.partitionConfig || false,
            isFolder: true,
            size: el.size || 0,
            mergedIDs: {
              dropbox: [el.id],
            },
            children: {},
          };

          acc[el.name].size = el.size || 0;
          acc[el.name].mergedIDs = { dropbox: [el.id] };
        }

        const parent = acc[parentName] || {
          name: parentName,
          children: {},

          mergedIDs: { dropbox: null },
        };

        parent.children[el.name] = {
          mergedIDs: { dropbox: [el.id] },
          isFolder: el[".tag"] === "folder",
          isPartitionFolder: el.isPartitionFolder || false,
          name: el.name,
          size: el.size || 0,
        };

        return acc;
      },
      {
        home: {
          mergedIDs: { other: ["root"] },
          name: "home",
          children: {},
        },
      }
    );

    // //swap from by name to by id
    // const listById = Object.values(listByName).reduce((acc, el) => {
    //   acc[el.id] = el;
    //   return acc;
    // }, {});
    //console.log("dbx map", listById);
    return listByName;
  }

  function _formatGoogle(list, driveOwner) {
    const listByID = list.reduce(
      (acc, el) => {
        if (el.shared) return acc;

        let parentID = el.parents[0];

        if (parentID === "0AMLhUsJJYsZFUk9PVA") parentID = "root";

        el.isPartitionFolder = false;

        if (el["mimeType"].includes("folder")) {
          if (el.name.includes("p_")) {
            el.isPartitionFolder = true;
            el.partitionConfig = partitionInfoDB.find({ name: el.name });
          }

          acc[el.id] = acc[el.id] || {
            id: el.id,
            name: el.name,
            isPartitionFolder: el.isPartitionFolder || false,
            isFolder: true,

            children: {},
          };
          // if already exists from a childs reference
          // Need to add the missing properties
          acc[el.id].name = el.name;
          acc[el.id].size = el.quotaBytesUsed || 0;
          acc[el.id].isPartitionFolder = el.isPartitionFolder;
          acc[el.id].partitionConfig = el.partitionConfig;
        }

        const parent = acc[parentID] || {
          name: null,
          isFolder: true,
          children: {},
          id: parentID,
        };

        parent.children[el.name] = {
          mergedIDs: { google: [el.id] },
          isFolder: el["mimeType"].includes("folder"),
          isPartitionFolder: el.isPartitionFolder || false,
          size: el.quotaBytesUsed || 0,
          name: el.name,
        };

        acc[parentID] = parent;

        return acc;
      },
      {
        root: {
          ids: { other: ["root"] },
          name: "home",
          children: {},
        },
      }
    );

    //convert to ByName from by Id

    const listByName = Object.values(listByID).reduce((acc, el) => {
      el.mergedIDs = { google: [el.id] };
      delete el.id;
      acc[el.name] = el;
      return acc;
    }, {});

    return listByName;
  }
}

module.exports = new raidController();

/*

Some key features that you will have to decide on when selecting a hardware RAID controller include:

SATA and/or SAS interface (and related throughput speeds)
RAID levels supported
Operating system compatibility
Number of devices supported
Read/write performance
IOPs rating
Cache size
PCIe interface
Encryption capabilities
Power consumption

https://searchstorage.techtarget.com/definition/RAID-controller

*/
