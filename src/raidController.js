/* eslint-disable no-unused-vars */
const fs = require("fs");

const { partHandler } = require("./filePartHandler");
const { callClients } = require("./auth/authController");

/**
 * Controls the interpreting of data to/from the APIs
 * Enables abstraction of multiple drives into one
 */
class raidController {
  constructor() {
    // span, raid copy, raid split, raid parity

    this.config = {
      modes: [0, 1, 2, 3],
      mode: 0,
      SmartSync_enabled: false,
    };

    //console.log("table:", this.fileTable.getTable())

    //"this" effectively attaches it to the (controller) object scope, rather than function scope
    // the function scope stops existing after execution, so this makes it persist
    //modes: Spanned, Raid0, Raid1, SmartSync

    //test function (private)
  }

  /**
   *
   * @param {*} Object contains upload config e.g stripe + smart and info about target (upload dir - the parent)
   * @param {*} files list of files (meta) to upload
   */

  uploadFiles({ config, ...targetInfo }, files) {
    console.log("Initiating Upload of total [", files.length, "] files");

    const { connectedDrives: recipients, blockWidth, mode } = config;

    files.forEach(async (file) => {
      const [
        toUploadParts,
        toDeleteParts,
        toRenameParts,
      ] = await partHandler.buildParts(file, config); // width is being passed from config

      //const toUploadCount = toUploadParts.reduce( (acc, el) => )

      console.log();

      callClients((clientId, client) => {
        // upload new data - edits
        client.deleteFiles(
          [{ fileInfo: file, parts: toDeleteParts[clientId] }],
          targetInfo,
          mode
        );

        //timeout for api rate limits
        setTimeout(() => {
          // delete redundant data
          client.uploadFiles(
            [{ fileInfo: file, parts: toUploadParts[clientId] }],
            targetInfo,
            mode
          );
        }, 1000);

        //rename parts to retain correct parts ordering
        //client.renameFiles([{fileInfo:file, parts:toRenameParts[clientId]}], targetInfo)
      }, recipients);
    });
  }

  downloadFiles() {}

  deleteFiles() {}

  getCapacities() {}

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
      return formatLists(fileLists);
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

//write
raidController.prototype.uploadFilesOLD = function (fileArr) {
  console.log(
    "File Upload Request Recieved",
    fileArr,
    "\n Operation Mode:",
    this.config.mode
  );

  // need to update catalogue

  fileArr.forEach((file) => {
    // switch (this.config.mode) { //does mode really need a state? - why not pass "upload type" in request
    // case 0: uploadFiles_Span.apply(this, [file])
    //     break;
    // case 1: uploadFiles_Mirror.apply(this, [file])
    //     break;
    // case 2: uploadFiles_Stripe.apply(this, [file])
    //     break;
    // case 3: uploadFiles_Parity(file)
    //     break;
    // default: uploadFiles_Span(file)
    // }

    //sepearte add to file table and upload
    // or adding to filetable, which then internally calls to upload

    this.fileTable.add(file.content);
  });

  async function uploadFiles_Span(file) {
    this.fileTable.connectedDrives.callClients(({ key, client }) => {});

    const clients = this.config.clients, //should be "active clients" - those which access has been granted/ user conifigured
      driveCapacities = await Promise.all(this.getCapacities());

    /** Capacity Object
     * [{name:"google", capacity:"", allocated:""}, {}, {}]
     */

    /**
     * Applies user ordering from UI - to apply drive prefernce (e.g. prioritise using google drive)
     */
    applyUserConfig_Upload_drivePreference(driveCapacities);

    this.fileTable.add();

    /**
     * Upload to first drive with enough free capacity
     * stop at first success
     */

    for (let drive = 0; drive < driveCapacities.length; drive++) {
      const { name, capacity, allocated } = driveCapacities[drive];
      if (parseInt(capacity) - parseInt(allocated) > file.size)
        return clients[name].uploadFiles(file);
    }
  }

  function updateCatalogue(file) {
    let catalogueInfo = {};
  }

  async function uploadFiles_Stripe(file) {
    const clients = this.config.clients,
      driveCapacities = await Promise.all(this.getCapacities());

    applyUserConfig_Upload_drivePreference(driveCapacities);

    //array of file read streams, each starting at their "chunk"
    const splitFile = await partHandler.splitReader(file);
    console.log("splitfile", splitFile);
    let i = 0,
      spanWidth = Object.keys(clients).length;

    for (let j = 0; j < Object.keys(splitFile).length; j++) {
      let chunkContent = splitFile[j]["part"],
        chunkMeta = JSON.parse(JSON.stringify(file));

      //chunkMeta.name = chunkMeta.name.slice(0, -4) + "-Part#" + j +".txt"
      chunkMeta.name = "STRIPE|" + j + "|" + chunkMeta.name;
      //chunkMeta.path = chunkMeta.app_path
      switch (j % spanWidth) {
        case 0:
          clients["google"].uploadFiles(chunkMeta, chunkContent);
          break;
        case 1:
          clients["dropbox"].uploadFiles(chunkMeta, chunkContent);
          break;
        default:
          clients["google"].uploadFiles(chunkMeta, chunkContent);
      }
    }

    splitFile.forEach((filePartStream) => {
      driveCapacities.forEach(({ name, capacity, allocated }) => {
        // TODO: Handle capacities
        file.name += "" + i;
        clients[name].uploadFiles(file, filePartStream);
        i++;
      });
    });

    driveCapacities.forEach(({ name, capacity, allocated }) => {
      if (parseInt(capacity) - parseInt(allocated) > file.size)
        return clients[name].uploadFiles(file);
    });
  }

  async function uploadFiles_Mirror(fileMeta) {
    const clients = this.config.clients,
      driveCapacities = await Promise.all(this.getCapacities());

    applyUserConfig_Upload_drivePreference(driveCapacities);

    let upload_displayCounter = 1,
      upload_limitCounter = Object.keys(driveCapacities).length;
    //fileName = fileMeta.name

    // uploads to EVERY drive - no break condition
    driveCapacities.forEach(({ name, capacity, allocated }) => {
      let fileName = fileMeta.name;
      fileName = "MIRROR|" + fileName;
      console.log(
        "Initiating Mirror-Upload: [",
        fileName,
        fileMeta.name,
        upload_displayCounter,
        "/",
        upload_limitCounter,
        "]"
      );
      upload_displayCounter += 1;

      //if (parseInt(capacity) - parseInt(allocated) > fileMeta.size) {
      let content = fs.createReadStream(fileMeta.path);
      return this.callClients(
        ({ key, client }) => client.uploadFiles(fileMeta, content),
        [name]
      );
      //}
    });
  }

  /**
   *
   * @param {callback} cb callback which returns log content
   * @param {String} defn defintion of log statment
   */
  function log(cb, defn) {
    console.log(defn, cb);
  }

  /**
   *
   * @param {Array} clients array of strings of client names e.g. ["dropbox", "google",]
   * @param {Object} fileMeta object containing metainfo e.g. name,
   * @param {readStream} fileContent readstream of upload content
   */

  function uploadFiles_Parity(file) {}

  // fileArr.forEach(async file => {
  //     file.data = fs.createReadStream(file.path)
  //     console.log("Initiating Upload Request for", file.fileId)
  //     await this.auth.google.google.uploadFile(file) //think this will cause sequential upload
  //     console.log("Upload Request Successful")
  // });
};

function applyUserConfig_Upload_drivePreference(obj) {
  //maybe make a userconfig object - applies filters, manipulations etc
  return obj;
}

//read (blob)
raidController.prototype.downloadFiles = function downloadFiles(data) {
  // data:{

  //     fileId:{
  //       google:[idpart1, idpart2, idpartx]
  //       dropbox:[idpart3, idparty]
  //     },
  //     fileId2 {

  //     }
  // }
  console.log("filesData", data);

  Object.keys(data).forEach((fileKey) => {
    let file = data[fileKey];

    // this.callClients( client => {
    //     downloadFile.apply(this, [client, partId])
    //  }, file)

    Object.keys(file).forEach((driveName) => {
      this.callClients(
        (client) => {
          const toDownloadParts = file[driveName];
          downloadFile.apply(this, [client, toDownloadParts]);
        },
        [driveName]
      );
      // const client = this.getClient(location),
      //       parts = file[location]
      //         parts.forEach( partId => {
      //             downloadFile.apply(this, [client, file])
      //         })
    });
  });

  function downloadFile(file, client) {
    console.log("Initiating Download Request for", file);

    switch (
      this.config.mode //should be by "file-uploadType"
    ) {
      case 0:
        return downloadFile_Span(client, file);
        break;
      case 1:
        return downloadFile_Mirror(client, file);
        break;
      case 2:
        return downloadFile_Stripe(client, file);
        break;
      case 3:
        return downloadFile_Parity(client, file);
        break;
      default:
        return downloadFile_Span(client, file);
    }

    async function downloadFile_Span(client, files) {
      try {
        //append relevent tag e.g. MIRROR| , STRIPE|0| ,
        // no tag for standard span...?
        let data = await client.downloadFiles(files);
        //blob

        console.log("Download Successfully Performed");
        console.log(data);

        //blob = Buffer.from(response.data, "utf8").toString("base64")
        //parent.manager.saveFile("testText.txt", blob)
      } catch (e) {
        console.log("Error Finalising Download Request.\nError :: ", e);
      }

      return {};
    }

    function downloadFile_Stripe({ filepartLocations }) {}

    function downloadFile_Mirror() {}

    function downloadFile_Parity() {}
  }
};

async function formatLists(lists) {
  const formatOptions = {
    google: allocateChildren,
    dropbox: _formatDropbox,
  };
  let parentList = {
    root: {
      name: "home",
      id: "root",
      children: {},
    },
  };

  for (const { entries: list, origin } of lists) {
    let sublist = (await formatOptions[origin](list, origin)) || {
      root: { children: {} },
    };

    parentList = { ...sublist, ...parentList };
    //console.log(origin, "sublist", sublist)
    let parentChildren = parentList["root"].children;
    parentList["root"].children = {
      ...parentChildren,
      ...sublist["root"].children,
    };
  }

  //console.log("plist", parentList)

  return parentList;

  function _formatDropbox(list, origin) {
    // will have to index by name, due to children identified by path of names (not ids)
    // then convert to by ID

    const listByName = list.reduce(
      (acc, el) => {
        const parentName = el.path_display.split("/").reverse()[1] || "home";

        if (el[".tag"] === "folder") {
          acc[el.name] = acc[el.name] || {
            id: el.id,
            name: el.name,
            isFolder: true,
            origin: "dropbox",
            children: {},
          };

          acc[el.name].id = el.id;
        }

        const parent = acc[parentName] || {
          name: parentName,
          children: {},
          origin: "dropbox",
          id: null,
        };

        parent.children[el.id] = {
          id: el.id,
          isFolder: el[".tag"] === "folder",
          name: el.name,
          origin: "dropbox",
        };

        return acc;
      },
      {
        home: {
          id: "root",
          name: "home",
          children: {},
        },
      }
    );

    //swap from by name to by id
    const listById = Object.values(listByName).reduce((acc, el) => {
      acc[el.id] = el;
      return acc;
    }, {});

    return listById;
  }

  function allocateChildren(list, driveOwner) {
    let map = generateMapping(list);
    //if (!map["root"]) map["root"] = {children:{}}

    return map;

    async function generateMapping(list) {
      await list;
      const map = Object.entries(await list).reduce((acc, fileEntry) => {
        // console.log("acc, ", acc)
        // console.log("file", fileEntry)
        let key = fileEntry[0],
          file = fileEntry[1];

        if (key === "root") key = "home";
        //const fileIsTrash = file.labels.trashed
        if (file.shared) return acc;
        // add current parent to acc if its not there already
        // if parent exists already, add current to parent child
        // if not exists, create the entry, and give it child property, add current as child
        file.origin = driveOwner;
        const cId = file.id,
          cname = file.name,
          parents = file.parents;
        let pId = parents ? parents[0] : file.parent;
        if (pId === "0AMLhUsJJYsZFUk9PVA") pId = "root";

        let parent = acc[pId];

        //folder creator
        if (!parent) {
          acc[pId] = {
            isFolder: true,
            children: {},
          };
        }

        acc[pId].children[cId] = file;

        // info/meta loader
        if (
          file.mimeType === "application/vnd.google-apps.folder" ||
          file[".tag"] === "folder"
        ) {
          file.isFolder = true;
          if (acc[cId]) acc[cId] = { ...file, ...acc[cId] };
          else acc[cId] = { ...file, children: {} };
        }

        return acc;

        // if current is folder
        // //do parent procedure
        // but do a current folder checkalso:
        // if current folder is not in acc, add it, with child property,
        // if it is already, just give it its meta
      }, {});

      return map;
    }
  }
}

//read (meta)
raidController.prototype.listFilesOLD = function () {
  console.log("\u001b[1;32m Fetching Files");
  let clientResponses = [];
  callClients((clientId, client) => {
    //console.log("this key", key, "client", client)
    const resp = client.listFiles();
    const p = new Promise((res) => res(resp));
    p.origin = clientId;
    clientResponses.push(p);
  });

  //await all responses, then build the file tree - breaks if one is bad
  return Promise.all(clientResponses).then((fileLists) => {
    console.log("Client listFiles() Responses:", fileLists);
    return formatLists(fileLists);
  });
};

raidController.prototype.getTable = function () {
  const table = this.fileTable.getTable();

  return table;
};

raidController.prototype.generateTable = function () {
  const res = this.listFiles();
  return res;
};

raidController.prototype.getFileList = function ({ type }) {
  if (type === 0) return this.table;
  else if (type === 1) return this.listFiles();
  // make this.table a function => get table , returns table properly
  return this.table || this.listFiles();
};

//delete
raidController.prototype.deleteFiles = function deleteFiles(fileId) {
  this.auth.google.deleteFile(fileId);
  //issue here with response, but request works
};

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
