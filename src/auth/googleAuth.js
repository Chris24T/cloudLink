const fs = require("fs");
const readline = require("readline");

const { google } = require("googleapis");
const { file } = require("googleapis/build/src/apis/file");
const { FileSlides } = require("react-bootstrap-icons");

const CLIENT_ID = process.env.GOOGLE_AUTH_CLIENT_ID,
  CLIENT_SECRET = process.env.GOOGLE_AUTH_CLIENT_SECRET,
  REDIRECT_URIS = process.env.GOOGLE_AUTH_REDIRECT_URIS,
  SCOPES = process.env.GOOGLE_AUTH_SCOPES,
  TOKEN_PATH = process.env.GOOGLE_AUTH_TOKEN_PATH,
  DOWNLOADS_DIR = process.env.DOWNLOAD_PATH,
  VENDOR_NAME = "google",
  ROOTID = "0AMLhUsJJYsZFUk9PVA";

class googleAuth {
  constructor() {
    this.vendor = VENDOR_NAME;
  }

  authorize(callback) {
    //Generate oAuth2Client
    const oAuth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URIS
    );

    /**
     * Generate client to perform operation using PERSONAL access token
     */
    return new Promise((resolve) => {
      fs.readFile(TOKEN_PATH, async (err, token) => {
        if (err) token = await this.getAccessToken(oAuth2Client);

        // Authentication
        oAuth2Client.setCredentials(JSON.parse(token));

        // Client
        const gClient = google.drive({ version: "v3", auth: oAuth2Client });

        const resp = callback(gClient);
        resolve(resp);
        //TODO use response - success/failure/progress
      });
    });
  }

  async getAccessToken(oAuth2Client) {
    console.log("No Local Access token found - Please Create new");
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
    });
    console.log("Authorize this app by visiting this url:", authUrl);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve, reject) => {
      rl.question("Enter the code from that page here: ", (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
          if (err) {
            reject(err);
            return console.error("Error retrieving access token", err);
          }

          resolve(token);

          // Store the token to disk for later program executions
          fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
            if (err) return console.error(err);
            console.log("Token stored to", TOKEN_PATH);
          });
        });
      });
    });
  }

  //TODO
  getSpaceUsage() {
    const resp = this.authorize((client) => {
      return client.about.get({
        fields: "storageQuota",
      });
    });

    return resp.then((val) => {
      return {
        origin: "google",
        allocated: parseInt(val.data.storageQuota.limit),
        used: parseInt(val.data.storageQuota.usage),
      };
    });
  }

  // name is not "Home" that is an app naming convetion, am actulally looking for "root" - or equivalent
  async listFiles(listPath = [["", ROOTID]]) {
    //id of the containing folder being listed
    const toList = listPath[listPath.length - 1][0];

    const resp = this.authorize((client) => {
      const p = new Promise((resolve, rej) => {
        client.files.list(
          {
            pageSize: 500,
            q: toList && "name='" + toList + "'", //? why isnt it ||
            fields:
              "nextPageToken, files(id, name, thumbnailLink, mimeType, parents, shared, quotaBytesUsed)",
            responseType: "stream",
          },
          (err, res) => {
            if (err) rej(err);

            resolve(res);
          }
        );
      });

      return p;
    });

    return resp.then((res) => {
      let entries = res.data.files;
      return { origin: "google", entries };
    });
  }

  deleteFiles(files) {
    if (files.length === 0) return;
    console.log("GGL: attempting to delete", files.length, " files");
    this.authorize((client) => {
      files.forEach((file) => {
        _deleteFile(client, file);
      });
    });

    function _deleteFile(client, [name, id]) {
      const resp = client.files.delete({ fileId: id[0] });
    }
  }

  renameFiles(files) {
    if (files.length === 0) return;
    console.log("GGL: attempting to rename ", files.length, " files");
    this.authorize((client) => {
      files.forEach((file) => {
        _renameFile(client, file);
      });
    });

    function _renameFile(client, [id, name]) {
      const resp = client.files.update({
        resource: { name },
        fileId: id[0],
      });
    }
  }

  // recieve from front: {conifg, files}
  // upload expects: upload(files[], config={isSmart, mode, target->e.g. google})
  uploadFiles(files, targetInfo, mode) {
    const { uploadType } = mode;

    let fileCounter = 1,
      partCounter = 1;

    this.authorize((client) => {
      files.forEach(async ({ file, parts }) => {
        const { fileInfo, existingFileData } = file;
        console.log(
          "GGL: ",
          parts.length,
          " Upload requests for",
          fileInfo.name
        );

        if (parts.length === 0) return;
        if (parts.length === 1 && uploadType !== 2 && uploadType !== 3)
          parts[0].name = fileInfo.name;

        fileInfo.parent = await this.findParent(file, targetInfo, mode);

        parts.forEach((part) => {
          _uploadFile(client, fileInfo, part, partCounter);
          partCounter++;
        });
        fileCounter++;
        partCounter = 1;
      });
    });

    //? expected deconstruct: {id, system_path, virtual_path, ...rest}

    //update - fileid is passed, else no id

    function _uploadFile(client, fileInfo, fileContent, pNum) {
      const { parent } = fileInfo;
      const { name, content } = fileContent;

      content.on("data", (chunk) => console.log("sub-Chunk uploaded", chunk));

      const resource = {
          name,
          //id: id || null //should handle update vs create - no id (null) means does not exist in cloud -> is a new file
          parents: [parent], //if the parent exists, use it, else create it from the path, returning the penultimate id i.e. the parent
        },
        media = {
          MimeType: fileInfo.type,
          //body: content.on("data", chunk => console.log("sub-Chunk uploaded", chunk))
          body: content,
        };

      client.files.create(
        {
          resource,
          media,
          fields: "id",
        },
        (err, resp) => {
          if (err)
            return console.log("File: ", name, " Part Upload Failure: ", err);
          console.log("File: ", name, " part ", pNum, "Upload Success");
        }
      );
    }
  }

  // ! when building parts, should get each contaiing folder too
  // reuturn parent id for containing folder of file or file parts
  async findParent(
    { fileInfo, existingFileData },
    { droppedContainer, droppedPath },
    { uploadType, isSmart }
  ) {
    const vID = this.vendor;
    let pID;

    if (parseInt(uploadType) === 0 || parseInt(uploadType) === 1) {
      //* can upload to conatining dir

      if (droppedPath.length > 1) {
        return droppedContainer.mergedIDs[vID][0];
      } else {
        return ROOTID;
      }
    } else {
      //* is striped - need striped folder -> get or create

      //* exisitng data -> existing containing folder
      //* else create it
      //console.log("GGL: Stripe dropped Container", droppedContainer);
      //console.log("GGL: Stripe Existing Data", existingFileData);
      if (existingFileData.parts[vID]) {
        pID = existingFileData.container.mergedIDs[vID][0];
      } else {
        pID = (
          await this.createFolder(
            droppedContainer.mergedIDs[vID][0],
            "__" + fileInfo.name
          )
        ).data.id;
      }
    }

    return pID;

    // if (vID in Object.keys(targetDrive)) {
    //   //working in "native"

    //   if (existingFileData[vID]) {
    //     // e.g. root/path...
    //     // ->   /f_*name*
    //     // if already exists, use same containing folder to upload to - regardless of upload type
    //     pID = existingFileData[vID].containingFolder[1];
    //   } else {
    //     // need to create files part folder
    //     // target Path only relevent if drive is target
    //     // * should set target automatically based on current dir
    //     const installDirID = targetPath[targetPath.length - 1][1];
    //     pID = installDirID;

    //     if (uploadType === 2)
    //       pID = (await this.createFolder(installDirID, "__" + name)).data.id;

    //     // if simple, parent is tos,
    //     // else create folder, return taht folder id

    //     // dont need to create this folder, if simple upload
    //   }
    // } else {
    //   //working in "foreign"
    //   let foreign = foreignFolders[vID];

    //   if (existingFileData[vID]) {
    //     //? foregin must exist here surely - since where else would the containing folder be if it exists?

    //     // e.g. root/__foreign__/
    //     // -> /f_*name*

    //     //! need to consider if containingFolder can be changed
    //     //! e.g. case of changing primary drive (target) where file is stored
    //     //! -> native and foreign could switch
    //     //* Assuming for now: cannot change the primary drive - means above (blue) query should hold
    //     const parentFolder = existingFileData[vID].containingFolder;

    //     pID = parentFolder[1];
    //   } else {
    //     let foreignID;
    //     // if foreign does not exist
    //     //create it
    //     if (!foreign) {
    //       foreignID = (await this.createFolder(ROOTID, "__foreign__")).data.id;
    //     } else foreignID = foreign[1];
    //     console.log("ggl doreign", foreign);

    //     //if containing folder does not exist - it shouldnt since no existing copy
    //     // create it
    //     console.log("creating folder __", name, " in ", foreign);
    //     pID = (await this.createFolder(foreignID, "__" + name)).data.id;
    //   }
    // }

    // return pID;
  }

  //TODO
  downloadFiles(files, mode) {
    console.log("GGL - Initiating ", files.length, " Downloads");
    return new Promise((resolve) => {
      this.authorize((client) => {
        let responses = [];
        for (const [partPos, partId] of files) {
          const download = _downloadFile(client, partId);
          responses[partPos] = download;
        }
        resolve(responses);
      });
    });

    async function _downloadFile(client, fileId) {
      // const dest = fs.createWriteStream("./googlePipe.txt", { flags: "a" });

      const resp = client.files.get(
        {
          fileId,
          alt: "media",
        },
        {
          responseType: "stream",
        }
      );
      return resp.then((val) => {
        //console.log("GGL RESP:", val);
        return val.data;
      });

      return resp;
      // .on("end", function () {
      //   console.log("Done");
      // })
      // .on("error", function (err) {
      //   console.log("Error during download", err);
      // })
      // .pipe(dest);
      // .on("data", (data) => {
      //   console.log("download Progress++", data);
      // })
      // .on("end", () => {
      //   console.log(
      //     "Part ",
      //     fileId,
      //     " Download Success | See ",
      //     DOWNLOADS_DIR
      //   );
      // })
      // .on("error", (err) => {
      //   console.log("File ", file.name, " Part Download Failure:", err);
      // })
      // .pipe(dest);
    }
  }

  createFolder(parent, name) {
    let metaData = {
      name,
      parents: [parent],
      mimeType: "application/vnd.google-apps.folder",
    };

    return new Promise((res, rej) => {
      this.authorize((client) => {
        client.files.create(
          {
            resource: metaData,
            fields: "id",
          },
          (err, resp) => {
            if (err) rej(err);
            else res(resp);
          }
        );
      });
    });
  }

  createPartitionFolder(name) {
    const parentId = ROOTID;
    let metaData = {
      name,
      parents: [parentId],
      mimeType: "application/vnd.google-apps.folder",
    };

    return new Promise((res, rej) => {
      this.authorize((client) => {
        client.files.create(
          {
            resource: metaData,
            fields: "id",
          },
          (err, resp) => {
            if (err) rej(err);
            else res(resp);
          }
        );
      });
    });
  }

  createFolderByPath(path, name) {
    const parentId = path[path.length - 1][1]["google"][0];
    let metaData = {
      name,
      parents: [parentId],
      mimeType: "application/vnd.google-apps.folder",
    };

    return new Promise((res, rej) => {
      this.authorize((client) => {
        client.files.create(
          {
            resource: metaData,
            fields: "id",
          },
          (err, resp) => {
            if (err) rej(err);
            else res(resp);
          }
        );
      });
    });
  }
}

module.exports.google_client = new googleAuth();
