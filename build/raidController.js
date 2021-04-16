const authController = require("./auth.js");
const FileManager = require('file-manager'); 
const fs = require("fs");
const Path = require("path");
const { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } = require("constants");
const { file } = require("googleapis/build/src/apis/file");


/**
 * Controls the interpreting of data to/from the APIs
 * Enables abstraction of multiple drives into one
 */
function raidController() {
     
     // span, raid copy, raid split, raid parity
    this.config = {
        modes:[0,1,2,3],
        mode:0,
        SmartSync_enabled:false,
        clients:{    // all are active from start for dev purposes
            dropboxClient:require("./auth/dropbox.js").dropbox_client,
            googleClient: require("./auth/google.js").google_client
        }
    }
    
    this.config.clients.googleClient.test()
    
    this.manager = new FileManager(Path.join(__dirname, 'data'))
    
    //"this" effectively attaches it to the (controller) object scope, rather than function scope
    // the function scope stops existing after execution, so this makes it persist
    //modes: Spanned, Raid0, Raid1, SmartSync

    //test function (private)
    this.test = function() {
        console.log("test")
    }
}

//write
raidController.prototype.uploadFiles = function(fileArr) {

    switch (this.config.mode) { //does mode really need a state? - why not pass "upload type" in request
        case 0: uploadFiles_Span(fileArr)
            break;
        case 1: uploadFiles_Stripe(fileArr)
            break;
        case 2: uploadFiles_Mirror(fileArr)
            break;
        case 3: uploadFiles_Parity(fileArr)
            break;
        default: uploadFiles_Span(fileArr)
    }    

    async function uploadFiles_Span(file) {

        const driveCapacities = await this.getCapacities(),
        clients = this.config.clients

        for (let i = 0; i < Object.keys(driveCapacities).length; i++) {
            const driveStorage = Object.keys(driveCapacities)[i];

            if (driveStorage.remaining > file.size) {
                clients[i].uploadFiles(file)
                return
            }
            else if (i === Object.keys(driveCapacities).length - 1) console.log("UPLOAD.SPAN ERROR - Not enough drive space found in connected drives")
            else continue
            
        }
    }

    function uploadFiles_Stripe(file) {

    }

    async function uploadFiles_Mirror(file) {
        const driveCapacities = await this.getCapacities(),
        clients = this.config.clients

        for (let i = 0; i < Object.keys(driveCapacities).length; i++) {
            const driveStorage = Object.keys(driveCapacities)[i];
            
            if (driveStorage.remaining > file.size) clients[i].uploadFiles(file)
            else console.log("UPLOAD.MIRROR ERROR - Not enough drive space found in current drive, skipping")            

        }
    }

    function uploadFiles_Parity(file) {

    }

    // fileArr.forEach(async file => {
    //     file.data = fs.createReadStream(file.path)
    //     console.log("Initiating Upload Request for", file.fileId)
    //     await this.auth.google.google.uploadFile(file) //think this will cause sequential upload
    //     console.log("Upload Request Successful")
    // });
}

raidController.prototype.getClient = function(clientName) {
    return this.config.clients[clientName]
}

//read (blob)
raidController.prototype.downloadFiles = function downloadFiles(filesObj) {
    
    // data:{

    //     fileId:{
    //       google:[idpart1, idpart2, idpartx]
    //       dropbox:[idpart3, idparty]
    //     },
    //     fileId2 {
    
    //     }
    // }
    console.log("filesData", filesObj)

    Object.keys(filesObj).forEach( fileKey => {
        let filePartsLocations = filesObj[fileKey]
        Object.keys(filePartsLocations).forEach (location => {
            const client = this.getClient(location+"Client"),
                  parts = filePartsLocations[location]
            parts.forEach( partId => {
                downloadFile.apply(this, [partId, client])
            })
        })
    })

    function downloadFile(id, client) {

        console.log("Initiating Download Request for", id)  
        console.log(this)      
        
            switch (this.config.mode) { //should be by "file-uploadType"
            case 0: return downloadFile_Span(client, id)
                break;
            case 1: return downloadFile_Stripe(client, id)
                break;
            case 2: return downloadFile_Mirror(client, id)
                break;
            case 3: return downloadFile_Parity(client, id)
                break;
            default: return downloadFile_Span(client, id)
            }

        async function downloadFile_Span(client, id) {
            
            try {
                
                let 
                response = await client.downloadFiles(id),
                blob
            
                console.log("Download Successfully Performed")
            
                blob = Buffer.from(response.data, "utf8").toString("base64")
                parent.manager.saveFile("testText.txt", blob)
            
                } catch(e) {
                    console.log("Error Finalising Download Request.\nError :: ", e)
                }
            
                return {}
        }

        function downloadFile_Stripe({filepartLocations, }){

        }

        function downloadFile_Mirror() {

        }

        function downloadFile_Parity() {

        }

    }
}
function _mergeTreesOLD(x, y, ...trees) {
    //console.log("tres", ...trees)

    let 
    xRoot = x["root"],
    yRoot = y["root"]

    const newRoot = Object.assign(xRoot.children, yRoot.children)
    console.log("root combine", newRoot)

    const newTreeNoRoot = Object.assign(xRoot, yRoot)
    console.log("newTree", newTreeNoRoot)


    //const rs2 = Object.assign({root:rs}, y)
    //delete rs2["root"]

    //console.log("x initial", x, "combine", {"root":rs}, "combine2", rs2)

    // return {root:{
    //     id:"root",
    //     name:"root",
    //     children:rs2}}
}

function _formatDropbox(fileList) {
    let     
    tree = {},
    list = {}   

    convertToTree(fileList)
    //console.debug("dbxTree", tree)
    convertToList(tree)
    //console.debug("dbxList", list)

    function convertToList(fileTree) {

        let
            rs = JSON.parse(JSON.stringify(fileTree))


        traverseObjectFamilyTree(rs["root"], (fileObj) => {
            // bring folder to object top level
            if(fileObj[".tag"] === "folder") {
                fileObj.isFolder = true
                //fileObj.origin = "dropbox"                    
                list[fileObj.id] = fileObj                
            }
            // "root" is artificial folder, has no ".tag", must identify it as a folder manually
            if (fileObj.name === "root") {
                list["root"] = fileObj
            } 
        }) 

        // traverses object tree, converting from index by name to index by id,
        // callback operates on each tree node
        function traverseObjectFamilyTree(obj, cb) {
            if (obj.children) {
                Object.values(obj.children).forEach( (child) => {
                    child.origin = "dropbox"
                    // convert from byName to byId
                    if (!obj.children[child.id]) {                    
                        delete obj.children[child.name]                    
                        obj.children[child.id] = child                        
                    }
                    
                    // recurse to children
                    traverseObjectFamilyTree(child, cb)                                
                })

                cb(obj)
                        
            }
        }
        
    }

    return list

    function convertToTree(fileList) {

            //Generates Traversable tree - by path (name) -> also want to be able to find by id
        fileList.entries.forEach( file => {
            file.path_display.split("/").reduce((acc, name, i, a) => {     
                // convert "" to "root"
                if (name === "") name = "root"
                
                // if file not in acc, add with chilren property
                if (!acc[name]) {                                         
                    acc[name] = {name, children:{}}                
                }

                // end of path => reached file
                if (i === a.length - 1) {                    
                    let children = acc[name].children
                    acc[name] = file
                    file.children = children                                
                }                    
                
                return acc[name].children
            }, tree)
        })
    }
}

function _formatGoogle(fileList) {
    let 
    list = {},
    tree = {}

    list = convertToList(fileList)
    //console.log("gglList",  JSON.parse(JSON.stringify(list)))
    tree = fatten(list)
    //console.log("ggltree", tree)

    function convertToList(fileList) {

    fileList[fileList.length] = {id:"root"}
    let fileTree = {}
    
    //console.log("Converting To Tree ", fileList)
    // Extracting *Folders* only - mapping
    // maps existing folders to their index in filelist
    let folderIdMapping = fileList.entries.reduce( (acc, el, i) => {
        if(el.mimeType === 'application/vnd.google-apps.folder' || el[".tag"] === "folder") {
            el.children = {}
            el.isFolder = true;
            el.origin = "google"
            acc[el.id] = el;
            
            return acc
        }
        return acc
    }, { 'root':{id:"root", children:{}}})  //root is not a concept in the list, so must create it
    
    fileList.entries.forEach(file => {
        file.origin = "google"
        //console.log("currentFile: ", file.name, file.id, file.parents)
        // Skip shared files (for now), skip root (as it top - cant have parents)
        if(file.shared || file.id === "root") return        
        // If parent cant be found, set parent to root
        let parent = folderIdMapping[file.parents[0]] || folderIdMapping.root   
        //console.log("found parent", parent)     
        // Set parents children to [previous children, current file]
        parent.children[file.id] = file
        folderIdMapping[parent.id] = parent        
    });

    //console.log("gglTree", fatten(folderIdMapping))
  
    //console.log("FolderMap ", folderIdMapping)
    
    //return fileList
    //console.log("rootCheck", folderIdMapping["root"])

    //let treeByPath = fatten(folderIdMapping)
    //onsole.log("Google Files", fatten(folderIdMapping))

    //console.log("gglTree", folderIdMapping)
    return folderIdMapping

    }

    return list
}

function _merge(el1, el2, ...elx) {

    /**
     * if element is type list
     * extract the root object of each list,
     * combine them with assign (on children)
     * delete the old root objects from either list
     * add the new root object in its place
     * 
    */

    //console.log("el1", el1, "el2", el2)
    
    if(el1.type === "list") {
        // main work to be moved to here
    }    
    
    let 
    r1 = el1["root"].children,
    r2 = el2["root"].children,    

    r = Object.assign(r1, r2)    

    delete el1["root"]
    delete el2["root"]    

    let el = Object.assign(el1, el2)    

    el.root = {id:"root", children:r}


    //console.log("el1", el1, "el", el, "el root", el.root)

    return el


}

//read (meta)
raidController.prototype.listFiles = function listFiles() {
    //console.log("Listing files...")
    const clients = this.config.clients
    let clientResponses = []
    Object.keys(clients).forEach(clientKey => {
        const client = clients[clientKey]
        clientResponses[clientResponses.length] = client.listFiles()
    });

    return Promise.all(clientResponses).then( clientFiles => {
        
        let 
        dbxList = _formatDropbox(clientFiles[0]),
        gglList = _formatGoogle(clientFiles[1])
        
        //console.log("dbx", dbxTree["root"], "ggle", ggleTree["root"])
        
        return _merge(gglList, dbxList)
    })

    switch (this.config.mode) { //should be by "file-uploadType"
        case 0: return listFiles_Span(fileArr)
            break;
        case 1: return listFiles_Stripe(fileArr)
            break;
        case 2: return listFiles_Mirror(fileArr)
            break;
        case 3: return listFiles_Parity(fileArr)
            break;
        default: return listFiles_Span(fileArr)
        }

    async function listFiles_Span() {
       
    }

    function listFiles_Stripe({filepartLocations, }){

    }

    function listFiles_Mirror() {

    }

    function listFiles_Parity() {

    }

    
    // return convertToTree(this.config.clients.googleClient.listFiles())
}

//delete
raidController.prototype.deleteFiles = function deleteFiles(fileId) {
    this.auth.google.deleteFile(fileId)
    //issue here with response, but request works
}

raidController.prototype.getCapacities = function() {
    const clients = this.config.clients
    let res = {}
    Object.keys(clients).forEach(clientKey => {
        res.clientKey = clients[clientKey].getCapacity()
    });

    return res
}

//test function (public)
raidController.prototype.test2 = function test2() {
    
}

/**
 * Accepts a file array of meta-data,
 * converts it to a tree structure for easier user navigation.
 * 20 01 21 will only work for google "list" files currently
 * @param {arrayPromise} fileList 
 */
function convertToTreeDropbox(fileList) {
    //console.log("filelist", fileList)
    let result = {}

        //Generates Traversable tree - by path (name) -> also want to be able to find by id
    fileList.entries.forEach( file => {
        file.path_display.split("/").reduce((acc, name, i, a) => {     
            // convert "" to "root"
            if (name === "") name = "root"
            
            // if file not in acc, add with chilren property
            if (!acc[name]) {                                         
                acc[name] = {name, children:{}}                
            }

            // end of path => reached file
            if (i === a.length - 1) {                    
                let children = acc[name].children
                acc[name] = file
                file.children = children                                
            }                    
            
            return acc[name].children
        }, result)
    })
 
    //console.log("tree formatte", result)
    
    let listVersion = {},
    rs = JSON.parse(JSON.stringify(result))


    traverseObjectFamilyTree(rs["root"], (fileObj) => {
        // bring folder to object top level
        if(fileObj[".tag"] === "folder") {
                                
            listVersion[fileObj.id] = fileObj                
        }
        // "root" is artificial folder, has no ".tag", must identify it as a folder manually
        if (fileObj.name === "root") {
            listVersion["root"] = fileObj
        } 
    }) 

    // traverses object tree, converting from index by name to index by id,
    // callback operates on each tree node
    function traverseObjectFamilyTree(obj, cb) {
        if (obj.children) {
            Object.values(obj.children).forEach( (child) => {
                
                // convert from byName to byId
                if (!obj.children[child.id]) {                    
                    delete obj.children[child.name]                    
                    obj.children[child.id] = child
                }
                
                // recurse to children
                traverseObjectFamilyTree(child, cb)                                
            })

            cb(obj)
                       
        }
    }
    

        //From index-by-name to index-by-id
    function changeToById(directory) {

    }
        
    
    //console.log("updatedList", listVersion)
    //console.log("result", result)           
    return listVersion
    
}

function flatten(objectList) {


    function _flatten() {

    }
}

function fatten(objectList) {
    
    let firstObj = objectList["root"]

    let result = _fatten(firstObj) 

    function _fatten(obj) {        
        if(obj.children === {} || obj.children === undefined) return obj
        
        let childrenKeys = Object.keys(obj.children)        
        
       childrenKeys.forEach(childKey => {
            let child = obj.children[childKey]

            obj.childKey = _fatten(child)
        });
        return obj
    }

    return result
}

function convertToTree(fileList) {
    
    fileList[fileList.length] = {id:"root"}
    let fileTree = {}
    
    //console.log("Converting To Tree ", fileList)
    // Extracting *Folders* only - mapping
    // maps existing folders to their index in filelist
    let folderIdMapping = fileList.entries.reduce( (acc, el, i) => {
        if(el.mimeType === 'application/vnd.google-apps.folder' || el[".tag"] === "folder") {
            el.children = {}
            acc[el.id] = el;
            
            return acc
        }
        return acc
    }, { 'root':{id:"root", children:{}}})  //root is not a concept in the list, so must create it
    // console.log("Mappping",folderIdMapping)
    fileList.entries.forEach(file => {
        //console.log("currentFile: ", file.name, file.id, file.parents)
        // Skip shared files (for now), skip root (as it top - cant have parents)
        if(file.shared || file.id === "root") return        
        // If parent cant be found, set parent to root
        let parent = folderIdMapping[file.parents[0]] || folderIdMapping.root   
        //console.log("found parent", parent)     
        // Set parents children to [previous children, current file]
        parent.children[file.id] = file
        folderIdMapping[parent.id] = parent        
    });
  
    //console.log("FolderMap ", folderIdMapping)
    
    //return fileList
    //console.log("rootCheck", folderIdMapping["root"])

    //let treeByPath = fatten(folderIdMapping)
    //onsole.log("Google Files", fatten(folderIdMapping))
    return folderIdMapping

}


module.exports = raidController

/*

Some key features that you will have to decide on when selecting a hardware RAID controller include:

SATA and/or SAS interface (and related throughput speeds)
RAID levels supported
Operating system compatibility
Number of devices supported
Read/write performance
IOPs rating
Cache size
PCIe interface
Encryption capabilities
Power consumption

https://searchstorage.techtarget.com/definition/RAID-controller

*/