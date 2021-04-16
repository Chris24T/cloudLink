/* eslint-disable no-useless-concat */
const fs = require("fs");
const { Dropbox } = require("dropbox");
const { file } = require("googleapis/build/src/apis/file");
const fetch = require("node-fetch");

const CLIENT_ID = process.env.DROPBOX_AUTH_CLIENT_ID,
  CLIENT_SECRET = process.env.DROPBOX_AUTH_CLIENT_SECRET,
  REDIRECT_URIS = process.env.DROPBOX_AUTH_REDIRECT_URIS,
  SCOPES = process.env.DROPBOX_AUTH_SCOPES,
  TOKEN_PATH = process.env.DROPBOX_TOKEN_PATH,
  DOWNLOADS_DIR = process.env.DOWNLOAD_PATH,
  VENDOR_NAME = "dropbox",
  ROOTID = "/";

class dropboxAuth {
  constructor() {
    this.vendor = VENDOR_NAME;
  }

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

  listFiles(listPath) {
    const resp = this.authorize((client) => {
      return _listFiles(client, listPath);
    });

    return resp.then((v) => {
      let entries = v.result.entries;
      return { origin: "dropbox", entries };
    });

    function _listFiles(client, path = "") {
      return client.filesListFolder({
        path,
        recursive: true,
      });
    }
  }

  deleteFiles(files, targetInfo, mode) {
    let partCounter = 0;

    this.authorize((client) => {
      files.forEach(({ fileInfo, parts }) => {
        console.log("DBX: ", parts.length, " delete request for this file");

        if (parts.length === 0) return;
        fileInfo.path = this.findPath(fileInfo, targetInfo, mode);

        parts.forEach((part) => {
          _deleteFile(client, fileInfo, part, partCounter);
        });
      });
    });

    function _deleteFile(client, fileInfo, file, pNum) {
      const resp = client.filesDeleteV2(
        {
          path: file.id || file.path,
        },
        (err) => console.log(err)
      );
      resp.then((message) => console.log("DBX Delete Response:", message));
    }
  }

  uploadFiles(files, targetInfo, mode) {
    let fileCounter = 1,
      partCounter = 1;

    this.authorize((client) => {
      files.forEach(({ fileInfo, parts }) => {
        console.log(
          "DBX: ",
          parts.length,
          " total upload request for this file"
        );

        if (parts.length === 0) return;
        if (parts.length === 1) parts[0].name = fileInfo.name;
        fileInfo.path = this.findPath(fileInfo, targetInfo, mode);
        parts.forEach((part) => {
          _uploadFile(client, fileInfo, part, partCounter);
        });
      });
    });

    function _uploadFile(client, fileInfo, fileContent, pNum) {
      const contents = fileContent.content,
        path = fileInfo.path + fileContent.name;
      //console.log("DBX install path:",path)

      const resp = client.filesUpload(
        {
          contents,
          path,
        },
        (err) => console.log(err)
      );
      resp.then((message) => console.log("DBX Upload Response:", message));

      return resp;
    }
  }

  downloadFiles() {
    function _downloadFile() {}
  }

  findPath(
    { name, existingFileData },
    { targetDrive, targetPath, foreignFolders },
    { uploadType, isSmart }
  ) {
    //cutting off extension
    name = name.split(".").slice(0, -1).join(".");
    const vID = this.vendor;
    let path;

    // dropbox will create the folder if it doesnt exist by path,
    // so no need to create folders

    const tPath = targetPath.reduce((acc, [name, id]) => {
      if (id === "root") return acc;
      return acc + name + "/";
    }, "");

    if (targetDrive === vID) {
      console.log("DBX is primary Recipent");

      if (existingFileData[vID]) {
        if (uploadType === 0) path = ROOTID + tPath;
        else path = ROOTID + tPath + "__" + name + "/";
      } else {
        if (uploadType === 0) path = ROOTID + tPath;
        else path = ROOTID + tPath + "__" + name + "/";
      }
    } else {
      console.log("DBX is non-primary Recipent");

      let foreign = foreignFolders[vID];

      if (existingFileData[vID]) {
        path = ROOTID + "__foreign__" + "/__" + name + "/";
      } else {
        path = ROOTID + "__foreign__" + "/__" + name + "/";
      }
    }

    return path;
  }
}

module.exports.dropbox_client = new dropboxAuth();
