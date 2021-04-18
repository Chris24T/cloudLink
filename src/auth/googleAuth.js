const fs = require("fs");
const readline = require("readline");

const { google } = require("googleapis");

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

  async authorize(callback) {
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
  getUsage() {}

  // name is not "Home" that is an app naming convetion, am actulally looking for "root" - or equivalent
  listFiles(listPath = [["", ROOTID]]) {
    //id of the containing folder being listed
    const toList = listPath[listPath.length - 1][0];

    const resp = this.authorize((client) => {
      const p = new Promise((resolve, rej) => {
        client.files.list(
          {
            pageSize: 500,
            q: toList && "name='" + toList + "'", //? why isnt it ||
            fields:
              "nextPageToken, files(id, name, thumbnailLink, mimeType, parents, shared)",
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
    for (const file of files) {
      console.log(
        "GGL:" + file.parts.length,
        "total delete request for this file"
      );
      for (const part of Object.values(file.parts)) {
        console.log("deleting Id", part.id);
        this.authorize((client) => {
          client.files.delete({ fileId: part.id });
        });
      }
    }
  }

  // recieve from front: {conifg, files}
  // upload expects: upload(files[], config={isSmart, mode, target->e.g. google})
  uploadFiles(files, targetInfo, mode) {
    const { uploadType, isSmart } = mode;

    let fileCounter = 1,
      partCounter = 1;

    this.authorize((client) => {
      files.forEach(async ({ fileInfo, parts }) => {
        console.log(
          "GGL:" + parts.length,
          "total upload request for this file"
        );

        if (parts.length === 0) return;
        // case of only one part i.e. entire file
        // therefore fileName is not going to be a hash
        if (parts.length === 1 && uploadType !== 2) {
          console.log("set part name to file name");
          parts[0].name = fileInfo.name;
        }

        console.log(
          "Uploading File",
          fileInfo.name,
          "of ",
          parts.length,
          " parts | File Position in Queue: [",
          fileCounter,
          "/",
          files.length,
          "]"
        );
        //Check for reupload here
        // if (file name is in current rendered folder) it is reupload, need to find intermediate parent
        // else if (is smart or stripe (i.e. chunked)) will need to create intermediate parent folder here
        fileInfo.parent = await this.findParent(fileInfo, targetInfo, mode);
        console.log("parent", fileInfo.parent.data);
        // ! if one part, use fileInfo name, else use part name !

        parts.forEach((part) => {
          console.log(
            "Initiating Upload | Part Position in Queue [",
            partCounter,
            "/",
            parts.length,
            "]"
          );

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
    { name, existingFileData },
    { targetDrive, targetPath, foreignFolders },
    { uploadType, isSmart }
  ) {
    //name = name.split(".").slice(0, -1).join(".");
    const vID = this.vendor;
    let pID;
    console.log("existingData", existingFileData);
    if (targetDrive === vID) {
      //working in "native"

      if (existingFileData[vID]) {
        // e.g. root/path...
        // ->   /f_*name*
        // if already exists, use same containing folder to upload to - regardless of upload type
        pID = existingFileData[vID].containingFolder[1];
      } else {
        // need to create files part folder
        // target Path only relevent if drive is target
        // * should set target automatically based on current dir
        const installDirID = targetPath[targetPath.length - 1][1];
        pID = installDirID;

        if (uploadType === 2)
          pID = (await this.createFolder(installDirID, "__" + name)).data.id;

        // if simple, parent is tos,
        // else create folder, return taht folder id

        // dont need to create this folder, if simple upload
      }
    } else {
      //working in "foreign"
      let foreign = foreignFolders[vID];

      if (existingFileData[vID]) {
        //? foregin must exist here surely - since where else would the containing folder be if it exists?

        // e.g. root/__foreign__/
        // -> /f_*name*

        //! need to consider if containingFolder can be changed
        //! e.g. case of changing primary drive (target) where file is stored
        //! -> native and foreign could switch
        //* Assuming for now: cannot change the primary drive - means above (blue) query should hold
        const parentFolder = existingFileData[vID].containingFolder;

        pID = parentFolder[1];
      } else {
        let foreignID;
        // if foreign does not exist
        //create it
        if (!foreign) {
          foreignID = (await this.createFolder(ROOTID, "__foreign__")).data.id;
        } else foreignID = foreign[1];
        console.log("ggl doreign", foreign);

        //if containing folder does not exist - it shouldnt since no existing copy
        // create it
        console.log("creating folder __", name, " in ", foreign);
        pID = (await this.createFolder(foreignID, "__" + name)).data.id;
      }
    }

    return pID;
  }

  //TODO
  downloadFiles(files, mode) {
    console.log("GGL - Initiating Download of [", files.length, "] files");

    let fileCounter = 1,
      partCounter = 1;

    this.authorize((client) => {
      files.forEach(({ file, parts }) => {
        console.log(
          "Downloading File",
          file.name,
          "of ",
          parts.length,
          " parts | File Position in Queue: [",
          fileCounter,
          "/",
          files.length,
          "]"
        );
        parts.forEach((partId) => {
          console.log(
            "Initiating Download | Part Position in Queue [",
            partCounter,
            "/",
            parts.length,
            "]"
          );
          _downloadFile(client, file, partId, partCounter);
          partCounter++;
        });
        fileCounter++;
        partCounter = 1;
      });
    });

    function _downloadFile(client, file, fileId, pNum) {
      const dest = fs.createWriteStream(DOWNLOADS_DIR + "/" + fileId);

      client.files
        .get(
          {
            fileId,
            alt: "media",
          },
          {
            responseType: "stream",
          }
        )
        .on("data", (data) => {
          console.log("download Progress++", data);
        })
        .on("end", () => {
          console.log(
            "Part ",
            fileId,
            " Download Success | See ",
            DOWNLOADS_DIR
          );
        })
        .on("error", (err) => {
          console.log("File ", file.name, " Part Download Failure:", err);
        })
        .pipe(dest);
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
}

module.exports.google_client = new googleAuth();
