/* eslint-disable no-unused-vars */
const fs = require("fs");

const partitionInfoDB = require("node-localdb")("./partitionDB.json");
const tracksDB = require("node-localdb")("./trackingDB.json");

const { partHandler } = require("./filePartHandler");
const { callClients } = require("./auth/authController");

const { computeChecksum, eventChannel } = require("./helpers");

const Promise = require("bluebird");

/**
 * Controls the interpreting of data to/from the APIs
 * Enables abstraction of multiple drives into one
 */
class raidController {
  constructor() {
    this.init();
    this.config = {
      modes: [0, 1, 2, 3],
      mode: 0,
      SmartSync_enabled: false,
    };
  }

  // Accepts a delete file(s) request form front end and informs the Cloud drive APIs
  deleteFiles(params, files) {
    //unwrapping request parameters
    files.forEach(({ partSources }) => {
      let responses = [];
      callClients((clientId, client) => {
        if (partSources[clientId]) client.deleteFiles(partSources[clientId]);
      });
    });
  }

  // Accepts a download file(s) request form front end and informs the Cloud drive APIs
  downloadFiles(params, files) {
    //unwrapping request parameters
    files.forEach(({ fileInfo, partSources }) => {
      let responses = [];
      callClients((clientId, client) => {
        if (partSources[clientId])
          responses.push(client.downloadFiles(partSources[clientId]));
      });

      // await all responses, combine them
      Promise.all(responses).then((driveResponses) => {
        let combinedResponse = [];

        driveResponses.forEach((response) => {
          response.forEach((part, i) => {
            if (part) {
              combinedResponse[i] = part;
            }
          });
        });

        //Writable for file download location
        const writable = fs.createWriteStream("./Downloads/" + fileInfo.name, {
          emitClose: true,
          autoClose: true,
        });

        // Await each part downloaded to be completed, as they are, pipe to write stream
        Promise.mapSeries(combinedResponse, (stream, index) => {
          const isLastIndex = index === combinedResponse.length - 1;
          console.log(index, combinedResponse.length);
          stream.on("data", (ch) => {
            console.log(ch.length);
          });
          stream.pipe(writable, { end: isLastIndex });
          return new Promise((resolve) => stream.on("end", resolve));
        });
      });
    });
  }

  init() {
    this.startTracking();
    //this.startRefreshLoop
  }

  // Accepts a Upload file request form front end and informs the Cloud drive APIs
  uploadFiles({ config, ...targetInfo }, files) {
    const { targets, mode, isTracked } = config; //partitionConfig
    let recipients = Object.keys(targets);

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

      let total = 0;

      for (const setOfPats of Object.values(toUploadParts)) {
        for (const part of setOfPats) {
          total += part.size;
        }
      }

      let responses = [];

      callClients((clientId, client) => {
        // upload new data - edits
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
      tracked.forEach(async (file) => {
        const { fileInfo, config, targetInfo } = file;
        const { path, md5Checksum } = fileInfo;
        try {
          const currentChecksum = await computeChecksum(path);
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

            // Mutate existing entry - updating checksum in db
            const existingEntry = await tracksDB.find({ path });

            //delete existing entry
            tracksDB.remove({ path }).then((v) => console.log("v", v));

            //replace with new - updating db entry to include new checksum
            existingEntry.fileInfo.md5Checksum = currentChecksum;
            const newEntry = existingEntry;
            tracksDB.insert(newEntry).then((u) => console.log("u", u));
          }
        } catch (e) {
          //console.log("Path No Longer Exists ", path);
        }
      });
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
    if (isPartition) {
      //Parition folder creation
      name = "p_" + name;
      const targets = Object.entries(allocation).reduce(
        (acc, [drive, alloc]) => {
          if (alloc.limit) acc[drive] = alloc;
          return acc;
        },
        {}
      );

      partitionInfoDB.insert({
        name,
        mode,
        targets,
        tracks: [],
        isTracked,
        blockWidth,
        recoveryDensity,
      });
      //Partition Folder Creation
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

  //Returns the availible capacity on a users drive
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

  //returns the meta data of all files existing on a cloud drive
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

    // Once the file lists are obtained,
    // Need to structure it to be navigable
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
};

// Function to format the seperate listfiles response into a single object
async function formatLists(lists) {
  const formatOptions = {
    google: _formatGoogle,
    dropbox: _formatDropbox,
  };
  let parentList = {};

  for (const { entries: list, origin } of lists) {
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

        parentListEntry.children = mergeChildren(newChildren, oldChildren);

        parentListEntry.mergedIDs = {
          ...parentListEntry.mergedIDs,
          ...entry.mergedIDs,
        };

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
