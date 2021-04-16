
require("dotenv").config()

const {google} = require('googleapis');
const fs = require('fs');
const readline = require('readline');
const os = require('os');
const uuid = require('uuid');
const path = require('path');
const { create } = require("domain");

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
    //console.log("GOOGLE - Loading Credentials:", path)
    return new Promise( (res, rej) => {
        fs.readFile(CREDENTIALS_PATH, (err, data) => {
            err?rej(err):res(JSON.parse(data))

        })
    })
}

google_Auth.prototype.get_or_create = function(path) {

}

google_Auth.prototype.deleteFolderContents = function(ids) {
  console.log("delte", ids)
  Object.keys(ids).forEach(fileId => {
    console.log("deleteing file id", fileId)
    this.authorize(client => {
      client.files.delete({
        fileId
      })
  })

  
  })
}

google_Auth.prototype.getFolderChildren = function(fileId) {
  const children = this.authorize(client => {
    client.files.list({
      fileId
    })
  })
}




google_Auth.prototype.createFolders = function(map, option) {
  //console.log("createMap", map)

  return new Promise( res => {
  this.authorize( async client => {
    let prevDir
    
    let searchDirMap = await Promise.all(Object.values(map))
    //console.log("searchmap", searchDirMap)
    for (let key = 0; key < Object.values(searchDirMap).length; key++) {
      
      //console.log("key", key,"/", Object.values(searchDirMap).length)
      const accessedFile = searchDirMap[key]
      //console.log("file", accessedFile)
      let responseTOGetParentId
      if(Object.keys(map)[key] === "") {
        prevDir={id:"0AMLhUsJJYsZFUk9PVA"}
        continue
      }
      //console.log("current folder name", Object.keys(map)[key])
      if(!accessedFile) {
        responseTOGetParentId = await (_createFolder(client, Object.keys(map)[key], prevDir))
        //console.log("ggl create resposne", responseTOGetParentId.data.id)
      }
      //console.log("this exists", searchDirMap[key])
      prevDir = ( responseTOGetParentId && {id:responseTOGetParentId.data.id}) || searchDirMap[key] //[key-1]??
      if(key === Object.values(searchDirMap).length - 1) res(prevDir.id)
    }
    
    
  })
})

  

  function _createFolder(client, name, {id:parentId}) {
    console.log("crating folder", name ,parentId)
    if (name === "root") name="data"
    let fileMetadata = {
      'name': name,
      parents:[parentId],
      'mimeType': 'application/vnd.google-apps.folder'
    };   

      return new Promise (res => { client.files.create({
        resource: fileMetadata,
        fields: 'id'
      }, (err, file) => {
        if (err) {
          // Handle error
          console.error(err);
        } else {
          res(file)
          console.log('Folder Id: ', file.id);
        }
      });
    })
    }
    
  }




google_Auth.prototype.uploadFiles = function(file, path) {
  const subPartTotal = Object.keys(file).length
  let subPartCounter = 1
  console.log("Google Upload Initiated")
  file.forEach(part => {
    console.log("part id: ", part.id || part.name)
    console.log("part number: [", subPartCounter, "/", subPartTotal, "]")
    subPartCounter++
      return this.authorize( client => _uploadFile(client, part, path))
  });
    
    

    function _uploadFile(client, file, pId) {
        let contents = file.content ,
        parent

        if (pId) parent = [pId]
        else parent = [file.parent[0]] //default: root
        let 
        fileMetadata = {
          "name":file.name,
          parents:  parent 
        },
        fileContents = {
          mimeType: file.type,
          body: contents
        }          
          
          client.files.create({
            resource: fileMetadata,
            media: fileContents,
            fields: "id"
          }, (err, file) => {
            if (err) console.error(err)
            else console.log("Google Upload: Success")
          })
    
          return "resolved"
        
    }

}

google_Auth.prototype.downloadFiles = function(files) {
 
  let responsePromises = []

  for (let i = 0; i < files.length; i++) {
      const file = files[i],
      res = this.authorize(client => _downloadFile(client, file.id))

      responsePromises[responsePromises.length] = res
  }

  return responsePromises

  function _downloadFile(client, fileId) {    

    return client.files
            .get({fileId, alt: 'media'}, {responseType: 'stream'})
 
}


    //return this.authorize(client => _downloadFile(client, fileId))



    function _downloadFile(client, fileId) {    

      return client.files
              .get({fileId, alt: 'media'}, {responseType: 'stream'})
      /*
    .then(res => {
      return new Promise((resolve, reject) => {
        let filePath = path.join(path.join(__dirname,"../../../downloads"), uuid.v4());
        
        console.log("writing to" ,filePath);
        const dest = fs.createWriteStream(filePath);
        let progress = 0;
        console.log("download", res)
        res.data
          .on('end', () => {
            console.log('Done downloading file to', filePath);
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
    }); */
}
    
    

}
// old version - now am returning response object as promsie rather than using it here
google_Auth.prototype.listFiles2 = function(folderPath="") {
    
    return this.authorize(client => _listFiles(client, folderPath))

    function _listFiles(client, path) {        
        return new Promise( (res, rej) => {
            
            client.files.list({
                pageSize: 500,
                // Authorization: client.context._options.OAuth2Client,
                fields: "nextPageToken, files(id, name, thumbnailLink, mimeType, parents, shared)",
                responseType: "stream"    
            }).then( result => {
              console.log("result",result)
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
      //path = path.split("/")
      if (path) path = path.split("/")

      if(path) {

          let map = {}
          let counter = 0
          path.forEach(async dir => {
            //console.log("searcguig for", dir)
            if(dir==="root") dir="data"
            map[dir] = new Promise( (res,rej) => {
            const name = "name='"+dir+"'"
            //console.log("ggl", "name='"+dir+"'",)
            client.files.list({
              pageSize:"1",
              q:name,
              fields: "files(id, name)"
              // Authorization: client.context._options.OAuth2Client,
                 
          }, (err, resp) => {        
              if(err) {
                console.log("GOOGLE.LISTFILES ERROR:", err)
                rej("error")
              }              
              
              //const files = {origin:"google", entries:resp.data.files}
              
                res(resp.data.files[0])
                
                
                
              }
                )
          
                counter++
              })
              
          }
              
          ); 
          return map
        }
    


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
              
              const files = {origin:"google", entries:resp.data.files}
              
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
    return this.authorize(client => _getCapacity(client))

    function _getCapacity(client) {
        return new Promise ( (res, rej) => {
        client.about.get({
            fields:"storageQuota"            
        }, (err, resp) => {
            console.log("google capacity", resp)
            const sq = resp.data.storageQuota
            if(!err) res({name:"google", capacity:sq.limit, allocated:sq.usage})
            rej(err)
        })
        })
    }

}

google_Auth.prototype.test = function() {
    console.log("bark")
} 

module.exports.google_client = new google_Auth()


