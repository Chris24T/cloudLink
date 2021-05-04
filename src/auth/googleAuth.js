const fs = require("fs");
const readline = require("readline");

const { google } = require("googleapis");
const Stopwatch = require("statman-stopwatch");
const stopwatch = new Stopwatch();

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

  //Returns a users space usage for the drive
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

  // Returns the list of meta data of the file on the drive
  async listFiles(listPath = [["", ROOTID]]) {
    // name is not "Home" that is an app naming convetion, am actulally looking for "root" - or equivalent
    //id of the containing folder being listed
    const toList = listPath[listPath.length - 1][0];

    const resp = this.authorize((client) => {
      const p = new Promise((resolve, rej) => {
        client.files.list(
          {
            pageSize: 500,
            q: toList && "name='" + toList + "'", //? why isnt it ||
            fields:
              "nextPageToken, files(id, name, thumbnailLink, md5Checksum, mimeType, parents, shared, quotaBytesUsed)",
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

  //Provides authorized access to the API to delete files
  deleteFiles(files) {
    if (files.length === 0) return;

    this.authorize((client) => {
      files.forEach((file) => {
        _deleteFile(client, file);
      });
    });

    function _deleteFile(client, [name, id]) {
      const resp = client.files.delete({ fileId: id[0] });
    }
  }

  //Provides authorized access to the API to rename files
  renameFiles(files) {
    if (files.length === 0) return;

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

  //Provides authorized access to the API to Upload files
  uploadFiles(files, targetInfo, mode) {
    const { uploadType } = mode;

    let fileCounter = 1,
      partCounter = 1;

    this.authorize((client) => {
      files.forEach(async ({ file, parts }) => {
        const { fileInfo, existingFileData } = file;

        if (parts.length === 0) return;
        if (parts.length === 1 && uploadType !== 2 && uploadType !== 3)
          parts[0].name = fileInfo.name;

        fileInfo.parent = await this.findParent(file, targetInfo, mode);
        const responses = [];
        stopwatch.start();
        parts.forEach((part) => {
          responses.push(
            _uploadFile(client, fileInfo, part, partCounter, parts.length)
          );
          partCounter++;
        });

        partCounter = 1;
        Promise.all(responses).then((fullfill) => {
          console.log(stopwatch.stop());
        });
      });
    });

    function _uploadFile(client, fileInfo, fileContent, pNum, maxParts) {
      const { parent } = fileInfo;
      const { name, content } = fileContent;

      const resource = {
          name,
          parents: [parent], //if the parent exists, use it, else create it from the path, returning the penultimate id i.e. the parent
        },
        media = {
          MimeType: fileInfo.type,
          //body: content.on("data", chunk => console.log("sub-Chunk uploaded", chunk))
          body: content,
        };

      return new Promise((res) => {
        const resp = client.files.create(
          {
            resource,
            media,
            fields: "id",
          },
          (err, resp) => {
            if (err)
              return console.log("File: ", name, " Part Upload Failure: ", err);
            console.log("File: ", name, " part ", pNum, "Upload Success");
            res(resp);
          }
        );
      });
    }
  }

  // Finds the parent id of the container folder for the parts
  async findParent(
    { fileInfo, existingFileData },
    { droppedContainer, droppedPath },
    { uploadType, isSmart }
  ) {
    const vID = this.vendor;
    let pID;

    if (parseInt(uploadType) === 0 || parseInt(uploadType) === 1) {
      //Upload is simple, can upload directly to dropped container
      if (droppedPath.length > 1) {
        return droppedContainer.mergedIDs[vID][0];
      } else {
        return ROOTID;
      }
    } else {
      //Upload is not simple and is therefore striped, requried to create a part container folder
      // to hold the parts
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
  }

  //Provides authorized access to the API to downlaod files
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
        return val.data;
      });
    }
  }

  // Creates a folder, in a given parent
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

  // Creates a partitoin folder - a folder prepended it "p_" and is found in top level.
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

  // Create a folder based on a provided path
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
