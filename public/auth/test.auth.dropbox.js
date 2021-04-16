const fetch = require("node-fetch");
const fs = require("fs");

const hostname = 'localhost';
const port = 3000;
const TOKEN_PATH = "tokenDropbox.json"

const { Dropbox } = require('dropbox');
const { auth } = require("googleapis/build/src/apis/abusiveexperiencereport");
const { fstat } = require("fs");


async function getAccessTokenFromFile() {

    const DROPBOX_ACESSTOKEN = new Promise( (res, rej) => {
        fs.readFile(TOKEN_PATH, (err, token) => {
            if (err) {
                console.log("bad token read")
                rej(err)
            }
            res(JSON.parse(token).access_token)
        })
    })

    return DROPBOX_ACESSTOKEN

}

async function authorize(callback) {
    // Builds auth object
    // callback is desired API call

    const config = {
        fetch,
        clientId: process.env.DROPBOX_OAUTH_APP_ID || "02tods18cnx57pc",
        clientSecret: process.env.DROPBOX_OAUTH_APP_SECRET || "8q61w8tuf46givk",
        accessToken: await getAccessTokenFromFile()
    };
    
    const dbx = new Dropbox(config);

    return callback(dbx)
}

/**
 * @param {string} filesPath Path of the folder contents are to be listed. Default = "root"
 * 
 */
function listFiles(folderPath="") {

    let res = authorize( client => _listFiles(client, folderPath))

    return res

    function _listFiles(client, path) {
        return client.filesListFolder({
            path,
            recursive:true
        })
    }    
}

/**
 * 
 * @param {array} files Holds array of file objects, expected properties: fileId or filePath
 */
function deleteFiles(files) {
    let res;
   
    if(files.length > 1) {
        // Batch

        let batchArg = []
        files.forEach( file => {
            batchArg[batchArg.length - 1] = file.id || file.path
        })

        res = authorize( client => _deleteFileBatch(client, batchArg))


    } else {
        // Single

        res = authorize( client => _deleteFileV2(client, files[0]))
    }

    return res

    /**
     * 
     * @param {*} client 
     * @param {*} files
     * NOTES:
     * will need to convert "files" array to array of FilesDeleteBatchArg 
     */
    async function _deleteFileBatch(client, files) {
        return client.filesDeleteBatch(files)
    }

    /**
     * 
     * @param {*} client 
     * @param {*} file
     * NOTES:
     * DEPRECIATED - use _deleteFileV2 
     */
    async function _deleteFile(client, file) {
        return client.filesDelete({
            path:file.path || file.id
        })
    }

    /**
     * 
     * @param {*} client 
     * @param {*} file 
     */
    function _deleteFileV2(client, file) {
        client.filesDeleteV2({
            path:file.path || file.id
        })
    }
}

function uploadFiles(auth, files) {

    for (let i = 0; i < files.length; i++) {
        let 
        file = files[i],
        res;

        //150MB
        if(file.size < 157286400) {
            // Simple Upload

            res = authorize( client => _uploadFileSimple(client, file))

        } else {
            // Session Upload - batch?

            const fileSession = {
                contents:file.contents,
                close:false,
                session_type:{
                    ".tag":"sequential" // options: 'sequential'(default) | 'concurrent' | 'other'
                }
            }
            res = authorize( client => _uploadFileSession(client, fileSession))
        }

        return res
    }
    
    
    async function _uploadFileSimple(client, file) {
        return client.filesUpload({
            contnets:file.content,
            path:file.id || file.path,
            mode: {
                ".tag":"update", 
                update:true
            }
        })
    }

    async function _uploadFileSession(client, file) {
        client.filesUploadSessionStart(file)
    }
}

function downloadFiles(files) {
    //maybe return array of promises which resolve on good response, fail otherwise

    let responsePromises = []

    for (let i = 0; i < files.length; i++) {
        const file = files[i],
        res = authorize(client => _downloadFile(client, file))

        responsePromises[responsePromises.length] = res
    }

    return responsePromises

    async function _downloadFile(client, file) {
        return client.filesDownload({
            path:file.id || file.path
        })
    }
}

function getCapacity() {
    return authorize()

    async function _getCapacity(client) {
        let res = await client.userGetSpaceUsage();
        return {
            used:res.result.used,
            allocated:res.result.allocation.allocated
        }

        
    }
}

async function initDropbox() {

    const config = {
        fetch,
        clientId: process.env.DROPBOX_OAUTH_APP_ID || "02tods18cnx57pc",
        clientSecret: process.env.DROPBOX_OAUTH_APP_SECRET || "8q61w8tuf46givk",
        accessToken: await getAccessTokenFromFile()
    };
    
    const dbx = new Dropbox(config);
    console.log(dbx)
    
    const redirectUri = `http://${hostname}:${port}/auth`;
    const authUrl = dbx.auth.getAuthenticationUrl(redirectUri, null, 'code', 'offline', null, 'none', false);
    
    dbx.filesListFolder({path:"", recursive:true})
        .then( res => {
            console.log(res.result.entries)
        })
        .catch(err => {
            console.log(err)
        })

    dbx.filesDownload({path:"id:2iQeWisa3doAAAAAAAAACQ"}) //or by aboslute path
        .then( res => {
            console.log("downloadResponse", res)
        })
        .catch(err => {
            console.log("downloadError", err)
        })

    dbx.filesUpload({
        contents: "not sure what contents are tbh, nowww+updateact?",
        path:"id:2iQeWisa3doAAAAAAAAAGQ", //or by aboslute path
        autorename:true, // cant figure out "update" - db assumes its a conflict of name/id
        mode:{".tag":"update", update:true} //enables file overwrite rather than rename(above)
        //may also have to include "update":rev - a file property, enables updates done in correct order
        
    })

    dbx.usersGetSpaceUsage().then( res => {
        console.log("user space", res.result.used, "out of", res.result.allocation.allocated)
    })

}

initDropbox()

/**
 * DOCS: 
 * https://dropbox.github.io/dropbox-sdk-js/Dropbox.html#filesDownload__anchor
 * 
 * DOC ARGS:
 * https://dropbox.github.io/dropbox-sdk-js/global.html#FilesDownloadArg
 * 
 * SDK:
 * https://github.com/dropbox/dropbox-sdk-js/blob/main/examples/javascript/download/index.html
 */



