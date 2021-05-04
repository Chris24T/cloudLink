/* eslint-disable no-useless-concat */
const fs = require("fs");
const { Dropbox } = require("dropbox");
const fetch = require("node-fetch");
const { Readable } = require("stream");
const Stopwatch = require("statman-stopwatch");
const stopwatch = new Stopwatch();

const TOKEN_PATH = process.env.DROPBOX_TOKEN_PATH,
  VENDOR_NAME = "dropbox",
  ROOTID = "/";
class dropboxAuth {
  constructor() {
    this.vendor = VENDOR_NAME;
  }

  //Authorizes any client action using their access token
  async authorize(callback) {
    const result = (async () => {
      const config = {
        fetch,
        clientId: process.env.DROPBOX_OAUTH_APP_ID || "02tods18cnx57pc",
        clientSecret: process.env.DROPBOX_OAUTH_APP_SECRET || "8q61w8tuf46givk",
        accessToken: await this.getAccessToken(),
      };

      const dbx = new Dropbox(config);

      return callback(dbx);
    })();

    return result;
  }

  async getAccessToken() {
    let DROPBOX_ACESSTOKEN = new Promise((res, rej) => {
      fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) {
          console.log("Bad Token Read - Dropbox");
          rej(err);
        }
        res(JSON.parse(token).access_token);
      });
    });

    return DROPBOX_ACESSTOKEN;
  }

  //returns a list of all the meta data of every file on a drive
  async listFiles(listPath) {
    const resp = this.authorize((client) => {
      return _listFiles(client, listPath);
    });

    return resp.then((v) => {
      let entries = v.result.entries;
      //Apply Origin Tag
      return { origin: "dropbox", entries };
    });

    function _listFiles(client, path = "") {
      return client.filesListFolder({
        path,
        recursive: true,
      });
    }
  }

  // Provides Authorized API access to delete files
  deleteFiles(files) {
    //No Files, exit
    if (files.length === 0) return;

    //Authorize and unpack
    this.authorize((client) => {
      files.forEach((file) => {
        _deleteFile(client, file);
      });
    });

    function _deleteFile(client, [name, id]) {
      const resp = client.filesDeleteV2(
        {
          path: id[0],
        },
        (err) => console.log(err)
      );
    }
  }

  // Provides Authorized API access to rename a file resource
  renameFiles(files) {
    if (files.length === 0) return;

    this.authorize((client) => {
      files.forEach((file) => {
        const [id, name, newName, path] = file;
        const split = path.split("/");
        const newPath =
          split.slize(0, split.length - 2).join("/") + "/" + newName;

        _renameFile(client, [path, newPath]);
      });
    });

    function _renameFile(client, [from_path, to_path]) {
      const resp = client.filesMove({
        from_path,
        to_path,
      });
    }
  }

  // Provides Authorized API access to Upload a file resource
  uploadFiles(files, targetInfo, mode) {
    const { uploadType } = mode;
    let fileCounter = 1,
      partCounter = 1;

    this.authorize((client) => {
      files.forEach(({ file, parts }) => {
        const { fileInfo, existingFileData } = file;
        console.log(
          "DBX: ",
          parts.length,
          " Upload requests for",
          fileInfo.name
        );

        if (parts.length === 0) return;
        if (
          parts.length === 1 &&
          parseInt(uploadType) !== 2 &&
          parseInt(uploadType) !== 3
        )
          parts[0].name = fileInfo.name;

        fileInfo.path = this.findPath(file, targetInfo, mode);
        let responses = [];
        stopwatch.start();
        parts.forEach((part) => {
          responses.push(
            _uploadFile(client, fileInfo, part, partCounter, parts.length)
          );
          partCounter++;
        });
        Promise.all(responses).then(() => console.log(stopwatch.stop()));
      });
      partCounter = 1;
    });

    async function _uploadFile(client, fileInfo, fileContent, pNum, maxParts) {
      const contents = fileContent.content,
        path = fileInfo.path + fileContent.name;

      const resp = client.filesUpload(
        {
          contents,
          path,
        },
        (err, resp) => {
          if (resp && pNum === maxParts)
            console.log("dropbox:", stopwatch.stop());
        }
      );

      console.log("DBX resp", resp);
      return resp;
    }
  }

  // Provides Authorized API access to Download a file resource
  downloadFiles(files) {
    console.log("DBX - Initiating ", files.length, " Downloads");
    return new Promise((resolve) => {
      this.authorize((client) => {
        let responses = [];
        for (const [partPos, partId] of files) {
          responses[partPos] = _downloadFile(client, partId);
        }
        resolve(responses);
      });
    });

    async function _downloadFile(client, fileId) {
      const resp = client.filesDownload({
        path: fileId,
      });

      return resp.then((val) => {
        return Readable.from(val.result.fileBinary);
      });
    }
  }

  //is zipped - needs special enpoint
  downloadFolder() {}

  //Gets the space usage of the drive
  getSpaceUsage() {
    const resp = this.authorize((client) => {
      return client.usersGetSpaceUsage();
    });

    return resp.then((val) => {
      return {
        origin: "dropbox",
        allocated: val.result.allocation.allocated,
        used: val.result.used,
      };
    });
  }

  //Creates a folder in the top level of the drives directoy
  createPartitionFolder(name) {
    const tPath = "/" + name;

    return this.authorize((client) => {
      return client.filesCreateFolderV2({
        path: tPath,
      });
    });
  }

  //Creates a folder in the directory of the passed path
  createFolderByPath(path, name) {
    let tPath =
      "/" +
      path.reduce((acc, [name, id]) => {
        if (id === "root") return acc;
        return acc + name + "/";
      }, "");

    tPath += name;

    return this.authorize((client) => {
      return client.filesCreateFolderV2({
        path: tPath,
      });
    });
  }

  // finds the correct path for install, provided the partiton the file was "dropped" into
  findPath(
    { fileInfo, existingFileData },
    { droppedContainer, droppedPath },
    { uploadType }
  ) {
    const { name } = fileInfo;
    const vID = this.vendor;
    let path;

    // dropbox will create the folder if it doesnt exist by path,
    // so no need to create folders

    const tPath = droppedPath.reduce((acc, [name, id]) => {
      if (id === "root") return acc;
      return acc + name + "/";
    }, "");

    if (Object.keys(droppedContainer.mergedIDs).includes(vID)) {
      if (existingFileData.isData) {
        if (parseInt(uploadType) === 0 || parseInt(uploadType) === 1)
          path = ROOTID + tPath;
        else path = ROOTID + tPath + "__" + name + "/";
      } else {
        if (parseInt(uploadType) === 0 || parseInt(uploadType) === 1)
          path = ROOTID + tPath;
        else path = ROOTID + tPath + "__" + name + "/";
      }
    }

    return path;
  }
}

module.exports.dropbox_client = new dropboxAuth();
