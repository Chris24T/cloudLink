const fetch = require("node-fetch");




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
    console.log("listing from path", folderPath)
    let resp = this.authorize( client => _listFiles(client, folderPath))
    return resp.then( v => {
        let entries = v.result.entries
        Object.keys(entries)
        v.result.entries = {origin:"dropbox", entries:v.result.entries}
        return v.result.entries
    }
        

    )
    

     function _listFiles(client, path) {

        try {
        if (!path) {
            return client.filesListFolder({
                path,
                recursive:true
            })
        }

        return new Promise( async (res, rej) => {
            console.log("dbx getting", path)
        
            path = ""+path
            const path3 = path.substring(1)
            client.filesListFolder({
                path,
                recursive:true
            }).then( resp => {console.log(resp); res(resp)})
            .catch( e => {console.log(e); rej(e) })
            
            
            
        }) 
     } catch (e) {console.log(e)}
        
        
        
        return 
        
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
        console.log("dropbox deleting old files")
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

dropbox_Auth.prototype.uploadFiles = function(file , path) {
        console.log("files", file)
        let subpartCounter = 1, res
        const subpartTotal  = Object.keys(file).length

        console.log("Dropbox Upload Initiated")

        file.forEach( part => {
            console.log("part id: ", part.id || part.name)
            console.log("part number: [", subpartCounter, "/", subpartTotal, "]")
        
            res = this.authorize(client => _uploadFileSimple(client, part, path))
            subpartCounter++
        })
        
        return res

        // file.content = content            
        // let res;

        // //150MB
        // if(file.size < 157286400) {
        //     // Simple Upload

        //     res = this.authorize( client => _uploadFileSimple(client, file))

        // } else {
        //     // Session Upload - batch?

        //     const fileSession = {
        //         //contents
        //         close:false,
        //         session_type:{
        //             ".tag":"sequential" // options: 'sequential'(default) | 'concurrent' | 'other'
        //         }
        //     }
        //     res = this.authorize( client => _uploadFileSession(client, fileSession.content))
        // }

        // return res
    
}
    
    async function _uploadFileSimple(client, file, path) {
        
                let name = "/"+file.name
                const commonDir = "cloudLink"
                console.log("dbx path", path)    
                return client.filesUpload({                    
                    contents:file.content,                    
                    path: file.installPath+"/"+file.name || path || commonDir+(name || file.id || file.path)
                    // mode: {
                    //     ".tag":"update", 
                    //     update:true
                    // }
                }).then( response => console.log("Dropbox Upload: Success") )
                  .catch ( err => console.log("Dropbox Upload: Failure \n Error:", err.error.error.reason) )       
    }

    async function _uploadFileSession(client, file) {
        client.filesUploadSessionStart(file)
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
        let res = await client.usersGetSpaceUsage();
        console.log("dropbox capacity", res)
        const sq = res.result
        return {
            name:"dropbox",
            capacity:sq.used,
            allocated:sq.allocation.allocated
        }

        
    }
}

module.exports.dropbox_client = new dropbox_Auth()