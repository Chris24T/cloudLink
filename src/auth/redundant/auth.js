const { UserAgentApplication } = require("msal");
const {
  ImplicitMSALAuthenticationProvider,
} = require("@microsoft/microsoft-graph-client/lib/src/ImplicitMSALAuthenticationProvider");
const {
  MSALAuthenticationProviderOptions,
} = require("@microsoft/microsoft-graph-client/lib/src/MSALAuthenticationProviderOptions");

const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const { MicrosoftGraph_Client } = require("@microsoft/microsoft-graph-client");
const { ipcMain } = require("electron");
const { auth } = require("googleapis/build/src/apis/abusiveexperiencereport");
const { resolve } = require("path");
const { drive } = require("googleapis/build/src/apis/drive");
const filePartHandler = require("../../filePartHandler");

require("dotenv").config();

//every drive file will need to be a promise as they can be fetched individually
//maybe even every 5MB piece will need to be a promise?

function google_Auth() {
  const SCOPES = ["https://www.googleapis.com/auth/drive"];
  const TOKEN_PATH = "token.json";

  const CREDENTIALS_PATH = require("path").resolve(
    __dirname,
    "./credentials.json"
  );

  const CREDENTIALS = (function () {
    console.log("reading file");
    return new Promise((resolve, reject) => {
      fs.readFile(CREDENTIALS_PATH, (err, data) => {
        err ? reject(err) : resolve(JSON.parse(data));
      });
      console.log("Credentials Read");
    });
  })();

  /**
   * Create an OAuth2 client with the given credentials, and then execute the
   * given callback function.
   * @param {Object} credentials The authorization client credentials.
   * @param {function} callback The callback to call with the authorized client.
   */
  function _authorize(callback, e) {
    //returns response from request to authorize an action -> plays auth, action, returns response as promise
    return CREDENTIALS.then((credsResolved) => {
      //"then" returns resolved version of promise to first arg i.e. credsResolved

      const {
        client_secret,
        client_id,
        redirect_uris,
      } = credsResolved.installed;
      const oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
      );

      // Check if we have previously stored a token.
      //promise containing authenticated response data e.g. fileMetaData

      return new Promise((resolve, reject) => {
        //wanted to remove this promsie, since could just return the callback as it is a promsie. but it breaks, dont know why: the promise wouldnt resolve after a .then()

        fs.readFile(TOKEN_PATH, (err, token) => {
          if (err) return getAccessToken(oAuth2Client, callback); // promise must be max parent in order to exit with variables from children
          oAuth2Client.setCredentials(JSON.parse(token));
          console.log("TOKEN", token);
          //returns promise of data if return exists in callback

          let res = callback(oAuth2Client, e);
          resolve(res);
        });
      });
    });
  }

  this.deleteFile = async function deleteFile(id) {
    return await _authorize((auth) => _deleteFile(id, auth));
  };

  function _deleteFile(id, auth) {
    return new Promise((resolve, reject) => {
      const drive = google.drive({ version: "v3", auth });
      drive.files.delete({ fileId: id }, (err, resp) => {
        if (resp) resolve(resp);
        else reject(err);
      });
    });
  }
  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
   * @param {getEventsCallback} callback The callback for the authorized client.
   */
  function getAccessToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
    });
    console.log("Authorize this app by visiting this url:", authUrl);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question("Enter the code from that page here: ", (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error("Error retrieving access token", err);
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) return console.error(err);
          console.log("Token stored to", TOKEN_PATH);
        });
        callback(oAuth2Client);
      });
    });
  }

  this.uploadFile = function uploadFile(file) {
    return _authorize((auth) => _uploadFile(auth, file));
  };

  function _uploadFile(auth, file) {
    let fileMetadata = {
        name: file.name,
      },
      media = {
        mimeType: file.type,
        body: file.data,
      };

    if (file.size > 5242880000) {
      //needs to be split up
      filePartHandler.split();
    } else {
      //file is already correct size, therefore can just be uploaded (more or less)

      const drive = google.drive({ version: "v3", auth });
      drive.files.create(
        {
          resource: fileMetadata,
          media: media,
          fields: "id",
        },
        (err, file) => {
          if (err) console.error(err);
          else console.log("Upload Successful");
        }
      );

      return "resolved";
    }
  }

  /**
   * Lists the names and IDs of up to 10 files.
   * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
   */

  //WARNING: Pulls from trash
  this.getFilesMeta = function getFilesMeta() {
    console.log("\n Fetching Files Meta Content \n");
    console.log("***Authorizing***");
    return _authorize(_getFilesMeta);
  };

  /**
   * asdas
   * @param {*} auth
   */

  function _getFilesMeta(auth) {
    return new Promise((resolve, rej) => {
      const drive = google.drive({ version: "v3", auth });
      drive.files.list(
        {
          pageSize: 50,
          Authorization: auth,
          fields:
            "nextPageToken, files(id, name, thumbnailLink, mimeType, parents, shared)",
        },
        (err, res) => {
          if (err) {
            console.log("error");
            rej("error");
          }

          const files = res.data.files;
          if (files.length) {
            console.log("***API ACCESSED***");
            console.log("authFiles", files);
            resolve(files);
          }
        }
      );
    });
  }

  this.downloadFile = function downloadFile(id) {
    return _authorize((auth) => _downloadFile(id, auth));
  };

  function _downloadFile(id, auth) {
    return new Promise((resolve, reject) => {
      //will eventually return an array of promises representing each piece of the file

      const drive = google.drive({ version: "v3", auth });
      drive.files.get(
        {
          fileId: id,
          alt: "media",
        },
        (err, res) => {
          if (err) {
            console.log("ERROR " + err);
            reject("error: " + err);
          }

          resolve(res);
        }
      );
    });
  }

  this.googleTest = function () {
    console.log("google");
  };
}

function dropbox_Auth() {}

function onedrive_Auth() {
  const msalConfig = {
    auth: {
      clientId: process.env.ONEDRIVE_OAUTH_APP_ID,
      authority: process.env.ONEDRIVE_OAUTH_AUTHORITY,
      redirectUri: process.env.ONEDRIVE_OAUTH_REDIRECT,
      clientSecret: process.env.ONEDRIVE_OAUTH_APP_SECRET,
    },
  };

  const graphScopes = ["Files.ReadWrite.All", "Files.ReadWrite"];
  console.log("heere");
  const msalApplication = new UserAgentApplication(msalConfig);
  const options = new MSALAuthenticationProviderOptions(graphScopes);
  const authProvider = new ImplicitMSALAuthenticationProvider(
    msalApplication,
    options
  );
  console.log("heere");
  const options2 = {
    authProvider, // An instance created from previous step
  };
  const client = MicrosoftGraph_Client.initWithMiddleware(options2);

  async function get() {
    try {
      let userDetails = await client.api("/me").get();
      console.log("Onedrive", userDetails);
    } catch (err) {
      throw err;
    }
  }
}

function mega_Auth() {}

function amazon_Auth() {}

function mediafire_Auth() {}

function box_Auth() {}

/**
 * Controlls the delegation of upload/download commands to specific drive
 * Enables abstraction of multiple APIs into one
 */
function authController() {
  this.google = new google_Auth();
  this.dropbox = new dropbox_Auth();
  this.onedrive = new onedrive_Auth();

  this.authTest = function () {
    console.log("authTEst");
  };

  //Where distribution of upload commands takes place
}

//" this " makes the property public essentially (from the authcontroller object)
// i.e. when function is made an object, the local scope is made private
// so can only access them if given to the object via prototype or this

module.exports = authController;
