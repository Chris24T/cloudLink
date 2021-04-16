
require("dotenv").config()

const {google} = require('googleapis');
const fs = require('fs');
const readline = require('readline');
const os = require('os');
const uuid = require('uuid');
const path = require('path');

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = 'token.json';

const CREDENTIALS_PATH = require("path").resolve(__dirname, "../credentials.json")


function google_Auth() {
    
    this.CREDENTIALS = loadCredentials(CREDENTIALS_PATH)

}

google_Auth.prototype.authorize = function(callback) {

    return (async () => {
    // const client_secret = process.env.GOOGLE_OAUTH_APP_SECRET
    // const client_id = process.env.GOOGLE_OAUTH_APP_ID
    // const redirect_uris = process.env.GOOGLE_OAUTH_REDIRECT_URI.split(",")
    
    const creds = await this.CREDENTIALS
    const {client_secret, client_id, redirect_uris} = creds.installed
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

        

    return new Promise( (resolve, reject) => { //wanted to remove this promsie, since could just return the callback as it is a promsie. but it breaks, dont know why: the promise wouldnt resolve after a .then()
        
        fs.readFile(TOKEN_PATH, (err, token) => {

        if (err) return getAccessToken(oAuth2Client, callback); // promise must be max parent in order to exit with variables from children
        oAuth2Client.setCredentials(JSON.parse(token));
               
        const googleClient = google.drive({version: 'v3', auth:oAuth2Client});
        let res = callback(googleClient)
        
        resolve(res)
        
        })
    })
    
    oAuth2Client.setCredentials(await getAccessToken())
    const googleClient = google.drive({version: 'v3', oAuth2Client});
    
    return callback(googleClient)
    })()
}
function getAccessToken(oAuth2Client, callback) {
    console.log("No Local Access token found - Please Create new")
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error('Error retrieving access token', err);
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) return console.error(err);
          console.log('Token stored to', TOKEN_PATH);
        });
        
        const googleClient = google.drive({version: 'v3', auth:oAuth2Client});
        callback(googleClient);
      });
    });
  }

    // using .env instead
function loadCredentials(path) {
    console.log("GOOGLE - Loading Credentials:", path)
    return new Promise( (res, rej) => {
        fs.readFile(CREDENTIALS_PATH, (err, data) => {
            err?rej(err):res(JSON.parse(data))

        })
    })
}

google_Auth.prototype.uploadFiles = function(file) {
    return this.authorize( client => _uploadFile(client, file))

    function _uploadFile(client, file) {
        let 
        fileMetadata = {
          "name":file.name
        },
        media = {
          mimeType: file.type,
          body: file.data
        }
    
        if(file.size > 5242880000) {
          //needs to be split up
        //   filePartHandler.split()
        }
        else {
          //file is already correct size, therefore can just be uploaded (more or less)          
          
          client.files.create({
            resource: fileMetadata,
            media: media,
            fields: "id"
          }, (err, file) => {
            if (err) console.error(err)
            else console.log("Upload Successful")
          })
    
          return "resolved"
        }
    }

}

google_Auth.prototype.downloadFiles = function(fileId) {
    return this.authorize(client => _downloadFile(client, fileId))

    function _downloadFileOLD(client, fileId) {
        return new Promise( (res, rej) => { 
                
            client.files.get({        
                fileId:fileId,
                alt:"media",                
                
            }, (err, resp) => {
              if (err) {
                console.log("ERROR "+err)
                rej("error: "+err)
              }              
      
              res(resp)
      
            })
          })
    }

    function _downloadFile(client, fileId) {
    

    client.files
    .get({fileId, alt: 'media'}, {responseType: 'stream'})
    .then(res => {
      return new Promise((resolve, reject) => {
        let filePath = path.join(path.join(__dirname,"../../../downloads"), uuid.v4());
        
        console.log("writing to" ,filePath);
        const dest = fs.createWriteStream(filePath);
        let progress = 0;
        console.log("download", res)
        res.data
          .on('end', () => {
            console.log('Done downloading file.');
            resolve(filePath); //resilve(filepath)
          })
          .on('error', err => {
            console.error('Error downloading file.');
            reject(err);
          })
          .on('data', d => {
            progress += d.length;
            if (process.stdout.isTTY) {
              process.stdout.clearLine();
              process.stdout.cursorTo(0);
              process.stdout.write(`Downloaded ${progress} bytes`);
            }
          })
          .pipe(dest);
      });
    });
}
    
    

}

google_Auth.prototype.listFiles2 = function(folderPath="") {
    
    return this.authorize(client => _listFiles(client, folderPath))

    function _listFiles(client, path) {        
        return new Promise( (res, rej) => {
            
            client.files.list({
                pageSize: 50,
                // Authorization: client.context._options.OAuth2Client,
                fields: "nextPageToken, files(id, name, thumbnailLink, mimeType, parents, shared)",
                responseType: "stream"    
            }).then( result => {
              console.log(result)
              result.data
                .on("data", d => {
                  console.log(d.length)
                })
                .on("end", () => {
                  res(result)
                })
            })
                })    
    }

}


google_Auth.prototype.listFiles = function(folderPath="") {
    
  return this.authorize(client => _listFiles(client, folderPath))

  function _listFiles(client, path) {        
      return new Promise( (res, rej) => {
          
          client.files.list({
              pageSize: 50,
              // Authorization: client.context._options.OAuth2Client,
              fields: "nextPageToken, files(id, name, thumbnailLink, mimeType, parents, shared)"    
          }, (err, resp) => {        
              if(err) {
                console.log("GOOGLE.LISTFILES ERROR:", err)
                rej("error")
              }              
              
              const files = {driveName:"google", entries:resp.data.files}
              res(files)
                })


              })    
  }

}

google_Auth.prototype.deleteFiles = function(file) {
    return this.authorize(client =>_deleteFile(client, file))
    
    function _deleteFile(client, file) {
        return new Promise ( (res, rej) => {
            client.files.delete({fileId:file.fileId}, (err, resp) => {
                if(!err) res(resp)
                rej(err)
            })
        })
        
    }
}

google_Auth.prototype.getCapacity = function() {
    this.authorize(client => _getCapacity(client))

    function _getCapacity(client) {
        return new Promise ( (res, rej) => {
        client.get({
            fields:"storageQuota"            
        }, (err, resp) => {
            if(!err) res(resp)
            rej(err)
        })
        })
    }

}

google_Auth.prototype.test = function() {
    console.log("bark")
} 

module.exports.google_client = new google_Auth()


