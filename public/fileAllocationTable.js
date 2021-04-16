//! REDUNDANT CLASS !
class fileAllocationTable {    

    getTable() {
       
        return this.table
    }
        
    //() => this.add({id:"123", name:"testAdd"})

    //this.table.then( res => console.log(res))

    async get(selector) {
            //empty is whole table, otherwise return specific entries

        let table = await this.table

        // {
        //     head: file meta,
        //     body:{
        //          dropbox:[{name, content:rs, origin, nextpart}],
        //          google:[{name, rs},{name, rs}]
        //          }

        let parentFolder = table[selector.parentid]
        const {head, body} = parentFolder.children[selector.id]

        this.connectedDrives.callClients( ({key, client}) => {
            client.downloadFiles(body[key])
        })
    }

    findFile(tablePath, localPath) {
        //use tablePath to get "containting" folder - i.e. the parent
        //then use the HASH of the LOCALPATH as the id or name, search the parents children
        // for any other HIDDEN folders mathching this
        // check for the largest "ref"
    }

    

    async add(filemeta, file, isSmart) {
        //console.log("file", file)
        
        const googleParentId = await this.verifyRealPath(filemeta, file, isSmart)
        //console.log("paths built")
        //console.log("uplaoding to parent", googleParentId)
        //console.log("dropboxInstallPath", file["dropboxinstallPath"])
        this.connectedDrives.callClients( ({key, client}) => {
            //console.log("uplaod")
            //client.uploadFiles(file[key], key==="google"? googleParentId: file["dropboxInstallPath"])
            
        })
        
        // this.connectedDrives.callClients( ({key, client}) => {
        //     const path = file[key+"installPath"]
        //     //client.uploadFiles(file[key])
        // })













        // file.actual_path = generateActualPath(file.path, cfg.dir)
        // let constructedPath = [getHiddenDir(file.app), ...file.app_path]
        // let filePath = file.head.app_path
        // for(let i = 0; i < filePath.length; i++) {
        //     constructedPath+="/"+filePath[i]
        // }

        // constructedPath += "/f_"+file.head.name
        // if (cfg.mode === "stripe") {
        //     constructedPath += "/f_0"
        // }        

        // console.log(constructedPath)

        // const meta = file.head
        // const content = file.body
        // const parent = (await this.table)[file.app_path.reverse()[1][1]],
        // child = parent.children["f_0"]    

        // //console.log("parent", parentFolder)

        // // will update ONLY if same file is uploaded to same dir
        // child ? this.update(child, file) : this.create(file, constructedPath)
    
    }

    async listFolderChildren(folderId) {
        
        let tbl = await this.table,
        id = await folderId

        
        return tbl[id].children
    }
    
    async buildHash(file) {
        console.log("Hasing Local File")
        console.log(file)
        const dixt = ["dropbox", "google"]
        let counter = 0
        const parts = partHandler.splitReader((part)=>{
            part = part.name
            part.origin = dixt[counter % 2]
        }, file)

        console.log("parts", await parts)
        return (await parts).google

        
    }

    generateChunkHashes() {

    }

    

    async compareResources(localHashes, remoteHashes) {
    localHashes = await localHashes
    remoteHashes = await remoteHashes

        console.log("local",  localHashes)
        console.log("remote",  remoteHashes)

        let commonParts = []
        let toDeleteCloud = []  //ids
        let toUploadCloud = []  //parts
        
        // if a cloud hash doesnt exist locally delete it
        // if a cloud hash does exist locally remove it from parts to upload
        console.log("google", remoteHashes["google"])
        let remoteParts = {...(remoteHashes["google"].children), ... (remoteHashes["dropbox"].children)}
        console.log("remote parts to searc", remoteParts)
        console.log("kids", localHashes)
        let locals = []
        let remotes = []
        for( let localPart in localHashes["dropbox"].children) {           
            
            (localHashes)["dropbox"].children[localPart].toUpload = true
        }
        
        console.log("kids2", localHashes["dropbox"].children)

        for( let localPart in  localHashes) {           
            console.log("local", localPart)
            localHashes[localPart].toDelete = true           
        }

        

        for( let remotePart in  remoteHashes) {           
            console.log("remote", remotePart)
            remoteHashes[remotePart].toDelete = true           
        }
        console.log("hehehehheheheheh")
        
        //console.log(remoteHashes,  localHashes)
        

        for( let localKey in  localHashes) {
            let local = ( localHashes)[localKey]
            for( let remoteKey in  remoteHashes) {
                let remote = ( remoteHashes)[remoteKey]
                //console.log("remote", remote)
                if(remote.name.includes(local.checksum)) {
                    console.log("found a common part - no action required on part")
                    ( remoteHashes)[remoteKey].toDelete = false
                    ( localHashes)[localKey].toUpload = false
                }
            }
        }

        //console.log("here", localHashes, remoteHashes)
       

        


        
        

        //all others than common part still need to be uploaded if local or deleted if cloud

        

    }

    async recoverData(fileMeta, file, cloudHashChain ) {
       
        cloudHashChain = await cloudHashChain
        console.log("filedata", cloudHashChain)
        let localHashChain = this.buildHash(fileMeta) //array
        const {newParts, toDeleteById} = this.compareResources(localHashChain, cloudHashChain)

        this.connectedDrives( ({key, client}) => {
            // client.deleteFolderContents(toDeleteById[key])
            // client.uploadFiles(newParts)
        })

        //chunk file again, but check that the hash exists in the children





    }

    verifyRealPath(filemeta, file, isSmart=false) {
        
        //need to return parent id of install path

        


        return new Promise( async resolve => {

        let fileCloudChildren = new Promise( res => {
        let fileInfo = {}        
        this.connectedDrives.callClients( async ({key, client}) => {
            
            let path = file[key+"installPath"]
            // path.replace(/("root")/g, (a) => {
            //     return "data"
            // })
            if (key==="google") {
                //console.log("path", path)
            const invalidDirs = await client.listFiles(path)
            console.log("path", path)
            console.log("invalid", invalidDirs)
            let parentId =  client.createFolders(invalidDirs) //ggl - get parent id
            let children =  this.listFolderChildren(parentId)
            //console.log("children", await children)
            if(!isSmart) client.deleteFolderContents(await children)
            
            fileInfo["google"]={
                pid:await parentId,
                children:await children
            }

            
            
            //else this.recoverData(file, parentId, children, "google")
            

            
            resolve(parentId)
            //res(1)
            } else {    //dbx

                const installDir = client.listFiles(file[key+"installPath"])
                //console.log("dbx installdir", await installDir)

                if(!isSmart) {
                    //delete all in the parent folder
                    client.deleteFiles(installDir.entries) 
                    client.deleteFiles((await installDir).entries) 
                } else {
                    let entries = (await installDir).entries
                    let parent,
                    children=[];
                    //console.log("isARray", entries)
                    for(let entry of await entries) {
                        //console.log("dbx enry", entry)
                        if(!parent) parent = entry
                        else children.push(entry)
                    }
                    //console.log("dbx recoveringData")
                    fileInfo["dropbox"] = {
                        pid:parent.id,
                        children:children
                    }
                    
                    //this.recoverData(file, parent.id, children, "dropbox")
                }


                
                //client.create(path)
            } //dbx - dont need to, can return
            if(fileInfo["dropbox"] && fileInfo["google"]) res(fileInfo)
        }) 
        
    })
        console.log("attempting to recover data")
        console.log("children", fileCloudChildren)
        if(isSmart) this.recoverData(filemeta, file, fileCloudChildren)
        
    })

    
    }

    update(oldFile, newFile) {
        oldFile = newFile
    }

    create(file, path) {
        const content = file.body
        //console.log("content", content)        
        // note: want to remove the "content field" whilst in table ( only need content for upload)
        // also kind of only adding "head" - correct?
        
        // add to local table
        
        //parentFolder.children[file.id ||file.name] = file

        // add (upload) to relevent drive if it has content
        if (content) {
            this.connectedDrives.callClients( ({key, client}) => {
                                
                if (content[key]) client.uploadFiles(content[key], path)
            })
        }        
    }   

    delete(file) {
        // delete from parents children
        // if folder: delete from table   

        const table = this.table
        const parentId = file.parent
        
        // delete current file from existing reference in parents children
        delete table[parentId].children[file.id]

        // delete current file from table - might make orphan files
        delete table[file.id]

        this.table = new Promise( res => res(table))
    }

    async loadTable(tableP) {
        this.table = tableP
        }

    
    constructor() {
        
    }
}
