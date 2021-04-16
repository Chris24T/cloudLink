const fetch = require("node-fetch");
const fs = require("fs");

const hostname = 'localhost';
const port = 3000;
const TOKEN_PATH = "tokenDropbox.json"

const { Dropbox } = require('dropbox');

function dropbox_Auth() {

}

function getAccessTokenFromFile() {

    let DROPBOX_ACESSTOKEN = new Promise( (res, rej) => {
        fs.readFile(TOKEN_PATH, (err, token) => {
            if (err) {
                console.log("Bad Token Read - Dropbox")
                rej(err)
            }
            res(JSON.parse(token).access_token)
        })
    })

    return DROPBOX_ACESSTOKEN

}

dropbox_Auth.prototype.authorize = function(callback){
    // Builds auth object
    // callback is desired API call
    const result = (async () => {
    const config = {
        fetch,
        clientId: process.env.DROPBOX_OAUTH_APP_ID || "02tods18cnx57pc",
        clientSecret: process.env.DROPBOX_OAUTH_APP_SECRET || "8q61w8tuf46givk",
        accessToken: await getAccessTokenFromFile()
    };
    
    const dbx = new Dropbox(config);

    return callback(dbx)
    })();

    return result
}

/**
 * @param {string} filesPath Path of the folder contents are to be listed. Default = "root"
 * 
 */
dropbox_Auth.prototype.listFiles = function(folderPath="") {

    let resp = this.authorize( client => _listFiles(client, folderPath))
    return resp.then( v => {
        let entries = v.result.entries
        Object.keys(entries)
        v.result.entries = {driveName:"dropbox", entries:v.result.entries}
        return v.result.entries
    }
        

    )
    

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
dropbox_Auth.prototype.deleteFiles= function(files) {
    let res;
   
    if(files.length > 1) {
        // Batch

        let batchArg = []
        files.forEach( file => {
            batchArg[batchArg.length - 1] = file.id || file.path
        })

        res = this.authorize( client => _deleteFileBatch(client, batchArg))


    } else {
        // Single

        res = this.authorize( client => _deleteFileV2(client, files[0]))
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

dropbox_Auth.prototype.uploadFiles = function(files) {

    for (let i = 0; i < files.length; i++) {
        let 
        file = files[i],
        res;

        //150MB
        if(file.size < 157286400) {
            // Simple Upload

            res = this.authorize( client => _uploadFileSimple(client, file))

        } else {
            // Session Upload - batch?

            const fileSession = {
                contents:file.contents,
                close:false,
                session_type:{
                    ".tag":"sequential" // options: 'sequential'(default) | 'concurrent' | 'other'
                }
            }
            res = this.authorize( client => _uploadFileSession(client, fileSession))
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

dropbox_Auth.prototype.downloadFiles = function(files) {
    //maybe return array of promises which resolve on good response, fail otherwise

    let responsePromises = []

    for (let i = 0; i < files.length; i++) {
        const file = files[i],
        res = this.authorize(client => _downloadFile(client, file))

        responsePromises[responsePromises.length] = res
    }

    return responsePromises

    async function _downloadFile(client, file) {
        return client.filesDownload({
            path:file.id || file.path
        })
    }
}

dropbox_Auth.prototype.getCapacity = function() {
    return this.authorize(client =>_getCapacity(client))

    async function _getCapacity(client) {
        let res = await client.userGetSpaceUsage();
        return {
            used:res.result.used,
            allocated:res.result.allocation.allocated
        }

        
    }
}

module.exports.dropbox_client = new dropbox_Auth()