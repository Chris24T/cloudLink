/* eslint-disable no-useless-concat */
const fs = require("fs");
const { Dropbox } = require("dropbox");
const { file } = require("googleapis/build/src/apis/file");
const fetch = require("node-fetch");
const { Readable } = require("stream");

const CLIENT_ID = process.env.DROPBOX_AUTH_CLIENT_ID,
  CLIENT_SECRET = process.env.DROPBOX_AUTH_CLIENT_SECRET,
  REDIRECT_URIS = process.env.DROPBOX_AUTH_REDIRECT_URIS,
  SCOPES = process.env.DROPBOX_AUTH_SCOPES,
  TOKEN_PATH = process.env.DROPBOX_TOKEN_PATH,
  DOWNLOADS_DIR = process.env.DOWNLOAD_PATH,
  VENDOR_NAME = "dropbox",
  ROOTID = "/",
  CHECKSUM_TEMPLATE = "checksums";

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

  async listFiles(listPath) {
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
        // include_property_groups: {
        //   // ".tag": "filter_some",
        //   // filter_some: ["id"],
        // },
      });
    }
  }

  deleteFiles(files) {
    let partCounter = 0;
    if (files.length === 0) return;
    console.log("DBX: attempting to delete ", files.length, " files");
    this.authorize((client) => {
      files.forEach((file) => {
        console.log("detelging file", file);
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

  renameFiles(files) {
    if (files.length === 0) return;
    console.log("DBX: attempting to rename ", files.length, " files");
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
        console.log("DBX: Dropbox upload Path", fileInfo.path);
        parts.forEach((part) => {
          _uploadFile(client, fileInfo, part, partCounter);
          partCounter++;
        });
      });
      partCounter = 1;
      fileCounter++;
    });

    async function _uploadFile(client, fileInfo, fileContent, pNum) {
      const contents = fileContent.content,
        path = fileInfo.path + fileContent.name;
      //console.log("DBX install path:",path)

      // let template = {
      //   name: "checksums",
      //   description: "md5 and sha256 cheksums",
      //   type: { ".tag": "string" },
      // };

      // const tmp = await client.filePropertiesTemplatesAddForUser({
      //   name: "User",
      //   description: "checksumTemplate",
      //   fields: [template],
      // });

      // let field = { name: "checksums", value: "THISISACHECKSUM" };
      // let propertyGroup = {
      //   template_id: tmp.result.template_id,
      //   fields: [field],
      // };

      const resp = client.filesUpload(
        {
          contents,
          path,
          // property_groups: [propertyGroup],
        }
        // (err) => {
        //   console.log(err);
        //   console.log(resp);
        //   return err;
        // }
      );
      resp.then((message) => console.log("DBX Upload Response:", message));

      return resp;
    }
  }

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
      // const dest = fs.createWriteStream("./dropboxPipe.txt");
      const resp = client.filesDownload({
        path: fileId,
      });

      return resp.then((val) => {
        return Readable.from(val.result.fileBinary);
      });

      // return resp;
      // //resp.result
    }
  }

  //is zipped
  downloadFolder() {}

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

  createPartitionFolder(name) {
    const tPath = "/" + name;

    return this.authorize((client) => {
      return client.filesCreateFolderV2({
        path: tPath,
      });
    });
  }

  createFolderByPath(path, name) {
    let tPath =
      "/" +
      path.reduce((acc, [name, id]) => {
        if (id === "root") return acc;
        return acc + name + "/";
      }, "");

    tPath += name;

    console.log("dropboxCreatefolder", tPath);

    return this.authorize((client) => {
      return client.filesCreateFolderV2({
        path: tPath,
      });
    });
  }

  findPath(
    { fileInfo, existingFileData },
    { droppedContainer, droppedPath },
    { uploadType, isSmart }
  ) {
    const { name } = fileInfo;
    //cutting off extension
    //name = name.split(".").slice(0, -1).join(".");
    const vID = this.vendor;
    let path;

    // dropbox will create the folder if it doesnt exist by path,
    // so no need to create folders

    const tPath = droppedPath.reduce((acc, [name, id]) => {
      if (id === "root") return acc;
      return acc + name + "/";
    }, "");

    console.log("DBX: Findpath tpath", tPath);
    console.log(
      "DBX: Dropped Container keys",
      Object.keys(droppedContainer.mergedIDs)
    );
    if (Object.keys(droppedContainer.mergedIDs).includes(vID)) {
      console.log("DBX: Key found");
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
    // } else {
    //   console.log("DBX is non-primary Recipent");

    //   let foreign = foreignFolders[vID];

    //   if (existingFileData[vID]) {
    //     path = ROOTID + "__foreign__" + "/__" + name + "/";
    //   } else {
    //     path = ROOTID + "__foreign__" + "/__" + name + "/";
    //   }
    // }

    return path;
  }
}

module.exports.dropbox_client = new dropboxAuth();
