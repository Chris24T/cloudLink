import React, { useEffect, useRef, useState, useCallback, useContext } from 'react';
import {browserContentContext } from "../Contexts/browserContentContext"
import {
  FilesBrowser_PWD as FB_PWD, 
  FilesBrowser_Files as FB_FILES, 
  FilesBrowser_Folders as FB_FOLDERS,
  Control_Bar as ControlBar
 } from "./FileBrowser_Elements";



import {useDropzone} from "react-dropzone"
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link,
  useLocation
} from "react-router-dom";


const { ipcRenderer, remote } = window.require('electron');
const CHANNEL_NAME_REQ = 'FileBrowser-Render-Request';
const CHANNEL_NAME_RES = 'FileBrowser-Render-Response';

function FilesBrowser(prps) {

    const {dirStack, convertUnits, setCurrentFolderSize, currentFolderSize,usageStatistics:usage, allFiles:fileTree, displayFiles:displayedFiles, setDisplayFiles, activePartition=true} = useContext(browserContentContext)
    const [displayMode, setDisplayMode] = useState("simple")
    const [displayForm, setDisplayForm] = useState(true)

    let
    //[displayedFiles, setDisplayedFiles] = useState([]), //all handling meta data, only handle reall data at donwload or upload (not read)
    
    setDisplayedFiles = setDisplayFiles,      
    //dirStack = dirStack,  //name, id
    //fileTree = useRef({}),
    //fileTree = allFiles,
    
    config = useRef({
      displayType:displayMode,
      partitionConfig:"",
      mode:{
        uploadType:2, 
        isSmart:0},      
        connectedDrives: ["dropbox","google"], //order here decides who gets frist part - must match target drive
        blockWidth:2000
    })   

    useEffect(() => {
      console.log("init render")      
      const intvl = updateLoop()      
      clearInterval(intvl) //disables drive polling
      
    
    },[])

    // useEffect( () => {
    //   const currentDir = dirStack.current[dirStack.current.length-1][0]
    //   console.log("dir", currentDir)
    //   setCurrentFolderSize(getFolderSize(currentDir))
    // }, [true])

    useEffect( () => {
      console.log("directory change")
      const dStack = dirStack.current
      const currentDirName = dirStack.current[dirStack.current.length - 1][0]
      //const {google, dropbox} = getFolderSize(currentDirName)
      let usage = []

      if(dStack.length > 1) {
        console.log("dstacj", dStack)
        const partitionName = dStack[1][0]
        console.log("parition", fileTree.current[partitionName])
        const partitionLimits = fileTree.current[partitionName].partitionConfig.fulfillmentValue[0].targets
        const capacity = getFolderSize(partitionName)
        usage = [[partitionLimits["google"].limit, capacity.google], [partitionLimits["dropbox"].limit, capacity.dropbox]]
        
      } else {
        const {google, dropbox} = getFolderSize("home")
        usage = [[1000, google],[1000, dropbox]]
      }

      
      
      console.log("usage", usage)
      //setCurrentFolderSize([google, dropbox])
      setCurrentFolderSize(usage)
    }, [dirStack.current.length])
    
    function findForeignFolders() {
      const foreignFolders = {}
      const searchDir = fileTree?.current["root"]?.children || {}

      for( const folder of Object.values(searchDir)) {
        // found a foreign folder
        if(folder.name.includes("__foreign__")) {
          foreignFolders[folder.origin] = [folder.name, folder.id, folder.origin]
        }
      }

      return foreignFolders
    }
    
    // need to return which folder specifically it exists in - append item to path (dirstack)
    //currently returning contianign folder as if target were a file, but a file can exist as a fodler itself, i need THAT fodler
    function findExistingFileData(toFind, searchSpace=fileTree.current, foreignFolders, {mode}) {
      //default search space is global search space - recursive almost
      // want to change to currentDir
	  
        console.log("Searching in", searchSpace)
     	const files = []
		  const {uploadType, isSmart} = mode
      for( const item of toFind ) {
		    const clipName =  item.name.split(".").slice(0, -1).join(".")
        let fileData = {}
		    console.log("f",Object.entries(foreignFolders))
		//search foreign folders for data
		for(const [clietnId, foreignRef] of Object.entries(foreignFolders)) {

			console.log(foreignRef)
			const foreignFolder = fileTree.current[foreignRef[1]]
			console.log("foreign", foreignFolder)
			for( const folder of Object.values(foreignFolder.children)) {

				if(folder.name.includes("__"+/*clipName*/item.name)) {
					console.log("Containing Folder Found in current foreign:",folder)
					const container = fileTree.current[folder.id]
					fileData[container.origin] = ({
						containingFolder:[container.name, container.id, container.origin],
						parts:container.children
					})
				}
			}
		}

		// search local dir for data
        for(const resource of Object.values(searchSpace)) {
			
          // found target part-container
          if(resource.name.includes("__"+clipName) && resource.isFolder && (uploadType===2 || isSmart)) {
              console.log("Containing Folder Found in current DIR:",resource)
			  const container = fileTree.current[resource.id]
              fileData[resource.origin] = ({
                containingFolder:[container.name, container.id, container.origin],
                parts: container.children
              })
			  
          }

          //found simple/standard upload copy
          if(resource.name === item.name && (!resource.isFolder) && (uploadType===0 || uploadType===1)) {
			console.log("Simple Copy Found:", resource)
			const id = resource.id
			const [dStr, dId] = dirStack.current[dirStack.current.length - 1]
			fileData[resource.origin] = ({
				containingFolder:[dStr, dId], // exists at end of dirStack
				parts: {[id]:resource}
			})
			

          }

		  // must keep going through entire search space, make sure found all copies
        }
       
        if(Object.keys(fileData).length === 0) {          
          fileData = false          
        }
        
        item.existingFileData = fileData
        files.push(item)

      }

      return files

      /**
       * return: [files, foreign folders]
       * 
       * files:         file: 
       *    [ {file1},     {  "google":{containingFolder[], parts{}}
       *      {file2},        "dropbox":{containingFolder[], parts{}}
       *      {file3}      }
       *    ]               
       * 
       * * NB: Foreign folder parent always Root
       * foreignFolders: 
       * {
       *  "google":[str, id, origin="google"]
       *  "dropbox":[str, id, origin="dropbox"]
       * }
       * 
      */

    }

    const onDrop = useCallback ( (droppedFiles, rejected) => {
      
      
      //Need to know: path/parentId of working dir and drive to uplaod to
      
      // identify if file already exists in displayed files-> reupload
      // should probably be across all files, since dont want to produce two "foreign" files of same name 
      //      e.g. (smart) upload two copies of same file to google: dbx foreign has now two copies of identical content
      //      bad since versioning might be different -> cannot just keep one of them
      // -> demands globally unique names rather than unique to current directory (latter is typical case)

      // Above problem exists because: "foreign" folders(files) are named the file name only, cant distinguish between multiple copies of same file existing in "native"
      // possible solution: 1 - globally unique names, 2 - append to repeat name "name+(copy)", 3 - create subfolder in native/filename, subfolder is named the parent - contains parts for the file in that parent
      // 3 = best but pushed problem further e.g. two same files in two same parent folders...
		const cfg = config.current
	  const dStack = dirStack.current
      const currentDirId = dStack[dStack.length - 1][1]
	  console.log(currentDirId)
      const currentDir = fileTree.current[currentDirId].children
	  const foreignFolders = findForeignFolders()
      const toUpload = [findExistingFileData(droppedFiles, currentDir, foreignFolders, cfg), foreignFolders]
      uploadFiles(toUpload)  
    })
      
      // // Extract paths
      // let dirPath = dirStack.current
      // let parentName = dirPath[-1] || dirPath[0] //parent if exists vs root

      // droppedFiles.forEach( file => {
      //   console.log(dirPath, parentName)  
      //   //file.parent = parentDir
      //   file.origin = "other"
      // })     
      
      // uploadFiles(droppedFiles)
      
      // ? Need to return: enitre dirstack (string path for dbx, parentid for ggl)
      // ? and the drive that the upload is being made to
      // ? can identify if reupload here: check working directory for file of same name as is dropped

      // ? extra: can recognise duplicate parts by name: query api for files of the same name
      // ? else: possible to have duplicate data across files (and across drives)
      
    

 
    // const loc = useLocation()
    // console.log("location", loc))
    

    return (
      
      <React.Fragment>   
      <Route exact path="/">        
      <HomeView content={displayMode === "advanced" ? displayedFiles : buildDisplay(displayedFiles, findForeignFolders(),fileTree.current)} dirStack={dirStack}/>
      </Route>

      <Route path="/trash"  >        
        <TrashView />
      </Route>

      <Route path="/settings"  >        
        <SettingsView />
      </Route>

      <Route path="/drives"  >        
        <DrivesView />
      </Route>
      
      </React.Fragment> 
    
    )
    
    // Both of the following are the same:
    // return <HomeView content={displayedFiles} dirStack={dirStack}/>
    // return HomeView(displayedFiles, dirStack) 
    
    function TrashView() {
      return (
        <div id="FileBrowser-Container" >
        <span >trashgggggggggggggggggggggggggggggggggggggggggggggggggggg</span>
        </div>
      )
    }
  
    function SettingsView() {
      return (
        <div id="FileBrowser-Container" >
        <span >Seetings</span>
        </div>
      )
    }
  
    function DrivesView() {
      return (
        <div id="FileBrowser-Container" >
          <span>drivey wivey</span>
        </div>
      )
    }

    function formView(isPartition) {
      //console.log("partigion", isPartition)
      const formType = isPartition ? " Partition" : " Folder"
      //isPartition ? "Create A Partition" : "Create A Folder"
      //https://medium.com/@everdimension/how-to-handle-forms-with-just-react-ac066c48bd4f
      //https://css-tricks.com/html5-meter-element/

      return(
        <div class="modal fade" id="createFolderModal" tabindex="-1" aria-labelledby="createFolderModal" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="exampleModalLabel">Create a New {formType}</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <div className="container" >

        

        <form id="createFolder" onSubmit={(e) => handleCreateFolderFormSubmit(e)}>

                {folderFormBody(formType)}

                {isPartition ? partitionFormBody() : ""}            

                
          </form>

        </div>
      </div>
      <div class="modal-footer">
        <button type="button" id="modalClose" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
        <button type="submit" class="btn btn-primary"  form="createFolder"  >Create</button>
      </div>
    </div>
  </div>
</div>
      )

      return (
        
        
        <div className="folderForm container">

          <div class="row">

              <div class="col-6">Left</div>
              <div class="col-6">Right</div>
          </div>
          
            <span><h4>{"Create a New"+formType} </h4></span>
            <form id="createFolder" onSubmit={handleCreateFolderFormSubmit}>

                {folderFormBody(formType)}

                {isPartition ? partitionFormBody() : ""}            

                <button onClick={() => setDisplayForm(false)}>Create</button>
                <button onClick={() => setDisplayForm(false)}>Cancel</button>
            </form>
        </div>
      )

      function folderFormBody(toCreateStr) {
        return (
          <React.Fragment>
              <div class="row pt-3">
                <div class="col-5 pt-1" >
                <label for={"Name Your New"+toCreateStr} class="form-label">{"Name Your "+toCreateStr+":"}</label>
                </div>
                <div class="col-7" >
                <input type="text" class="form-control" id="folderName" placeholder={"My"+toCreateStr}/>
                </div>
              </div>
              

          </React.Fragment>  
        )
      }

      function partitionFormBody() {
        
        const driveusage = usage.current
        
        const {googleReserved, dropboxReserved} = getReserved()
        const googleWidth = (Math.floor((100*(googleReserved||1)/driveusage?.google?.allocated||100))||1)+"%"
        const dropboxWidth =( Math.floor(( 100*(dropboxReserved||1)/driveusage?.dropbox?.allocated||100)) || 1)+"%"

        const googleUsed =( driveusage?.google?.used||1)
        const dropboxUsed = (driveusage?.dropbox?.used)
        const googleAlloc = (driveusage?.google?.allocated||100)
        const dropboxAlloc = (driveusage?.dropbox?.allocated||100)

        const googleReservedFree = convertUnits(googleAlloc - googleReserved)
        const dropboxReservedFree = convertUnits(dropboxAlloc - dropboxReserved)

        // usage here should be sum of all limits - am reserving space

        const googleRemaining = googleAlloc - googleUsed
        const dropboxRemaining = dropboxAlloc - dropboxUsed
        
        return (
          <React.Fragment>

              <div className="row pt-3"> 
                <div className="col-10"><div className="">Reserve Space For Your Parition (MB): </div></div>
              </div>

              <div className="row">

              <div className="col-3 offset-1 ">              
                <label class="form-check-label" for="flexCheckDefault">
                  Google Drive 
                </label>   
              </div>
              <div className="col-3 ">                
                <input onChange={() => updateAllocation({googleRemaining, dropboxRemaining})} style={{width:"100%"}} class="form-number-input" type="number" min="0" max={(googleRemaining/(1024*1024))} step="10" placeholder="0" id="flexCheckGoogle"/>
              </div>
              <div className="col-5 pt-1">
                <span style={{position:"absolute",top:"20px", fontSize:"small"}}>Free: {googleReservedFree}, Preallocated {convertUnits(googleReserved)}</span>
                <div class="progress" style={{width:"100%", marginTop:"5px"}} id="allocationBarGoogle">
                  <div class="progress-bar progress-bar-striped" id="allocationBar-Google" role="progressbar" style={{width:googleWidth, backgroundColor:"grey",}} aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div>
                  <div class="progress-bar " id="allocationBar-Google-Input" role="progressbar" style={{width:"0%", backgroundColor:"yellow", borderRight:"1px solid black"}} aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div>
                  
                </div>  
              </div>

              </div>

              <div className="row">

              <div className="col-3 offset-1">              
                <label class="form-check-label" for="flexCheckDefault">
                  Dropbox
                </label>   
              </div>
              <div className="col-3 ">
                <input onChange={() => updateAllocation({googleRemaining, dropboxRemaining})} style={{width:"100%"}} class="form-number-input" type="number" min="0" max={(dropboxRemaining/(1024*1024))} step="10" placeholder="0" id="flexCheckDropbox"/>
              </div>              
              <div className="col-5 pt-1">
              <span style={{position:"absolute",top:"20px", fontSize:"small"}}>Free: {dropboxReservedFree}, Preallocated {convertUnits(dropboxReserved)} </span>
                <div class="progress" style={{width:"100%", marginTop:"5px"}} id="allocationBarDropbox">
                  <div class="progress-bar progress-bar-striped" id="allocationBar-Dropbox" role="progressbar" style={{width:dropboxWidth, backgroundColor:"grey",}} aria-valuenow="20" aria-valuemin="0" aria-valuemax="100"></div>
                  <div class="progress-bar " id="allocationBar-Dropbox-Input" role="progressbar" style={{width:"0%", backgroundColor:"blue", borderRight:"1px solid black"}} aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div>
                  
                </div>  
              </div>

              </div>
              {/*
              <div className="row">

              <div className="col-10 offset-1 pt-3">              
                Allocation After Creation   
              </div>            

              </div>

              <div className="row pt-2">

              <div className="col-12 offset-3">
              <div class="progress" id="allocationBar">
                <div class="progress-bar" id="allocaltionBar-Google" role="progressbar" style={{width:"20%", backgroundColor:"yellow"}} aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div>
                <div class="progress-bar" id="allocationBar-Dropbox" role="progressbar" style={{width:"20%", backgroundColor:"blue"}} aria-valuenow="30" aria-valuemin="0" aria-valuemax="100"></div>
                <div class="progress-bar" id="allocaltionBar-GoogleAddition" role="progressbar" style={{width:"20%", backgroundColor:"red"}} aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div>
                <div class="progress-bar" id="allocationBar-DropboxAddition" role="progressbar" style={{width:"20%", backgroundColor:"green"}} aria-valuenow="30" aria-valuemin="0" aria-valuemax="100"></div>
                
              </div>   
              </div>

              <div className="col-0 ">
          
              </div>

              </div>
              */}
              
              <div className="row pt-4">

                <div className="col-12">Configure Partition Type:</div>

              </div>

              <div className="row pt-2">
                
                <div className="col-7">

                <select class="form-select" aria-label="Default select example">
                <option selected>Partition RAID Type</option>
                <option value="1">Span</option>
                <option value="2">Mirror</option>
                <option value="3">Stripe</option>
                <option value="4">Mirror-Stripe</option>
                <option value="5" disabled="true" >Parity (Not Yet Supported)</option>
              </select>

                </div>

                <div className="col-5">

                <div class="form-check">
                  <input class="form-check-input" type="checkbox" value="" id="flexCheckSmart"/>
                  <label class="form-check-label" for="flexCheckDefault">
                    Enable Smarter Uploads
                  </label>
                </div>

                </div>


              </div>

              

              

              
          </React.Fragment>  
        )
      }
      
    }

    function getReserved() {
      //sum across limits of every partition
      let googleReserved = 0,
      dropboxReserved = 0

      for (const folder of Object.values(fileTree.current)) {
        if(folder.isPartitionFolder) {
          console.log("fold", folder)
          googleReserved += parseInt(folder.partitionConfig?.fulfillmentValue[0].targets?.google?.limit || 0)
          dropboxReserved += parseInt(folder.partitionConfig?.fulfillmentValue[0].targets?.dropbox?.limit || 0)
        }
      }
      return {googleReserved, dropboxReserved}
    }

    function updateAllocation({googleRemaining:googleTotal=1000, dropboxRemaining:dropboxTotal=1000}) {     
      const inputs = document.getElementsByClassName("form-number-input")
      // console.log("googs", googleTotal)
      const gglAlloc = (inputs[0].value * 1024 * 1024) || 0
      const dbxAlloc = (inputs[1].value * 1024 * 1024)|| 0

      // console.log("Width", Math.floor((gglAlloc/googleTotal)*100))

      document.getElementById("allocationBar-Google-Input").style.width = Math.floor((gglAlloc/googleTotal)*100)+"%"
      document.getElementById("allocationBar-Dropbox-Input").style.width = Math.floor((dbxAlloc/dropboxTotal)*100)+"%"

    }

  function HomeView({content, dirStack}) {
    //console.log("Rendering Content:", content)
    const {getRootProps, getInputProps, isDragActive} = useDropzone({onDrop})

    // if(dirStack.current.length === 1) return (
    //   <div>

                   

    //   </div>
    // )

    if(!activePartition) return <div></div>

    return (
      
      <div {...getRootProps( {onClick: e => e.stopPropagation(), id:"FileBrowser-Container"})} style={{}}>
          <input {...getInputProps()} />
          

          {            
            //isDragActive ? <p>drop here</p> : <p>drag and drop a file anywhere to upload</p>
            // set to true when click on "create folder " button
            // set to false on complete or exit form
            displayForm ? formView(dirStack.current.length === 1) : ""
          }
          
          {
            
            (() => {
              let folders = [], files = []
              //console.log("Rendering", Object.values(content).length, "files")
              
              Object.values(content).forEach( file => {        
                //if (file.head) file = file.head
                if(!file.isHidden) {
                  if (file.isFolder) {                  
                    folders[folders.length] = file
                    return 
                  }
                  
                  files[files.length] = file 
                }  
                               
              })
              
              return (

                
                <React.Fragment>                                  
                  
                  

                  <FB_PWD
                    d={dirStack.current}
                    func1={ changeWorkingDirectory }/>
                 
                  <FB_FOLDERS
                    fd={{folders, "isPartitionLevel": (dirStack.current.length === 1) }}
                    fdfunc=
                    {{
                      "onClickChild":changeWorkingDirectory,
                      "onCreateFolder": createFolderForm
                    }}
                    />                    
                  
                  <FB_FILES
                    fi={files}
                    fifunc=
                    {{
                      "download": downloadFile,
                      "delete"  : deleteFile,
                      
                    }}
                    />
                  
                </React.Fragment>
              )
            })()
          }

            <ControlBar toggleDisplayMode={() => toggleDisplayMode()} toggleSmartUpload={() => toggleSmartUpload(config.current)} refresh={fetchFileData} speak={() => console.log("hello")} back={() => changeWorkingDirectory("back") }  setConfig={(e) => setConfig(e)}></ControlBar>
          
        </div>

    )
  }
  function toggleDisplayMode() {
    
    if(displayMode === "simple") return setDisplayMode("advanced")
    setDisplayMode("simple")
    
  }

  function createFolderForm(name) {
    setDisplayForm(true)
  }

  function handleCreateFolderFormSubmit(event) {
    event.preventDefault()
    console.log("Form Submitted:", event)
    const [folderName, GGLAlloc, DBXAlloc, mode, isSmart]= event.target

    document.getElementById("modalClose").click()

    console.log("Creating Folder with name", folderName.value)
    
    const dir = dirStack.current
    const target = fileTree.current[dir[dir.length - 1][0]].mergedIDs
    
    const requestBody = {
        params: {        
          targetDrive: target || "google",
          targetPath: dir,                  
        },
        data: {
          name:folderName.value,
          isPartition: dir.length === 1,
          allocation:{
            "google":{limit:GGLAlloc?.value, usage:0},
            "dropbox":{limit:DBXAlloc?.value, usage:0}
          },
          mode:mode?.value,
          isSmart:isSmart?.value
        }
      }

      const request = {
        requestType:"createFolder-request",        
        requestBody
      }

    ipcRenderer.send(CHANNEL_NAME_REQ, [request])
  }

  function buildDisplay(toDisplay, foreigns, allFiles) {
    
    const newDisplay = {}  

    for(const item of Object.values(toDisplay)) {
      const newItem = JSON.parse(JSON.stringify(item))
      // newItem.originSet = [item.origin]

      if(item.isPartitionFolder) {
        //slice off "p_"
        newItem.displayName = item.name.slice(2, item.name.length)
      }


      if(item.name.includes("__") && item.isFolder) {   
          //hide foreign folders   
        if(item.name.includes("foreign")) {          
          newItem.isHidden = true
        }
        // else {
        //   newItem.name = item.name.slice(2, item.name.length) //slicing off "__" identifier
        //   //check if item appears in the foreign folder set, to accumulate "origins"
        //   for(const [owner, folder] of Object.entries(foreigns)) {
            
        //     const foreignParts = allFiles[folder[1]].children
        //     for(const {name} of Object.values(foreignParts)) {
        //       const trimName = name.slice(2, name.length)
        //       if(item.name.includes(trimName)) newItem.originSet.push(owner) 
        //     }

            
            
                       
        //   }
        // }
        //Found a parts folder
        // want to convert to a file representation
        newItem.isFolder = false
      }

      newDisplay[item.name] = newItem
    }
    //console.log("generatedDisplay", newDisplay)
    return newDisplay
  }

  function toggleSmartUpload(cfg) {
    console.log("click")
    const btn = document.getElementById("smartBtn")
    console.log(btn)
    let text = btn.value

    if(cfg.isSmart === 1) {
      text="Smart Upload Disabled"
      cfg.isSmart = 0
    }
    else {
      text="Smart Upload Enabled"
      cfg.isSmart = 1
    }
    console.log(text)
    btn.innerHTML = text
  }

  function setConfig(el) {
    alert("Configuration Saved")

    let cfg = config.current
    let cd = []
    const g = document.getElementById("googleConn").className.includes("disabled") ? 0 : cd.push("google")
    const d = document.getElementById("dropboxConn").className.includes("disabled") ? 0 : cd.push("dropbox")
    const m = document.getElementById("megaConn").className.includes("disabled") ? 0 : cd.push("mega")
    
    const mode = document.getElementById("mode-select").value
       
    config.current.connectedDrives = cd
    config.current.mode = mode
    //config.current.lastDir = dirStack.current[dirStack.current.length - 1]

    console.log("Config Set:", config.current)
   
  }

    //Eventually, make these changes appear locally before server acknowledges 
    //to make it seem faster/less hang time

    //send file list to server side
    function uploadFiles([files, foreignFolders]) {
      const fullWorkingDir = dirStack.current // current working directory stack
      const containingDirId = fullWorkingDir[fullWorkingDir.length-1][1] // Top level directory (wokring directory) id
      const containingDir = fileTree.current[containingDirId] // Get the containing folder by workingdir id
      const reqconfig = config.current // Upload config e.g. stripe
		console.log("containingDir", containingDir)
      //What is config: dictates upload type - how?
      // isSmart, then raid mode - 
      // let config = {
      //   mode:0;
      //   connectedDrives:["google"]
      // }

      if(fullWorkingDir.length > 1) {
        //am in a partition

      }

      const paritionID = fileTree[fullWorkingDir[1][1]].partition

      const requestBody = {
        params: {
          config:reqconfig,
          targetDrive: containingDir.origin || "google" || this.connectedDrives[Math.floor(Math.random()*this.connectedDrives.length)], //!Targt set to folder file is dropped in, if root, pick randomly
          targetPath: fullWorkingDir,
          foreignFolders          
        },
        data: Object.values(files).map( ({name, path, size, existingFileData}) => {
          return (
            {              
              name, // from os
              path, // from os
              size, // from os
              // existing name, id of the same file or false if doesnt exist
              existingFileData // should be another dirstack if looking globally - taken from existing drive info (not sytem (OS) info)
              // also need the parts (names, id) - so they can be compared against
            }
          )
        })
      }

      const request = {
        requestType:"fileUpload-request",        
        requestBody
      }

      return ipcRenderer.send(CHANNEL_NAME_REQ, [request])
    }

    

    function deleteFile(id) {
      //sends signal to back end to delete file with id=id
      //should rebuilt so the sending process is less verbose and prevelent
      console.log("*** Deleting File with ID: "+id+" ***")

      const message={
        requestType:"deleteFile-request",
        requestBody:{
          data:{},
          params:{}
        }
      }

      ipcRenderer.send(CHANNEL_NAME_REQ, [message])
      ipcRenderer.on(CHANNEL_NAME_RES, (event, response) => {

        if (response[0].content) fetchFileData() //or just manually change state, this is easier => not as responsive

      })

    }

    function updateLoop() { //check for changes by repeatedly querying back end
      fetchFileData()
      return setInterval(() => {
        fetchFileData()
      }, 10000);      
    }

    function buildPartsList(file) {
      // should read from catalogue here 

      // console.log(displayedFiles)

      let fileHead = displayedFiles[file.id]

      // currently just doing it manually - based on file being in one (single/first) part
      let 
      origin = file.origin,
      part = file.id

      const response = {
        [origin]: [part]
      }

      return response      
    }

    function downloadFile(file) {
      console.log(file)
      console.log("*** Downloading file with id: ", file.id, "***")

      const id = file.id,
      partsList = buildPartsList(file)      

      const message = {
        requestType:"fileDownload-request",
        requestBody:{
          params:{},
          data:
            {
              origin: {
                [id]:partsList,            
            }
          }       
        } 
      }

      ipcRenderer.send(CHANNEL_NAME_REQ, [message])
      ipcRenderer.on("FileBrowser-Render-Response", (event, content) => {
        console.log("thanks for telling me about that, not gonna really use it tho. This is it: ")
        console.log(content)
      }

    )
  }

  
    function fetchFileData() {   
      console.log("Refreshing Content")
      //request data from backend
      const message = {requestType:"metadata-request", requestBody:{params:{}, data:{}}}
      const FILTERS = {}
    
      ipcRenderer.send(CHANNEL_NAME_REQ, [message, FILTERS])

      ipcRenderer.send("FileBrowser-Usage-Request", [{requestType:"getUsage-request", requestBody:{params:{}, data:{}}}, {}])

      ipcRenderer.on("FileBrowser-Usage-Response", (event, response) => {
        response = JSON.parse(response)
        console.log("usage res[psme ", response)
        usage.current = response
      })


      ipcRenderer.on("FileBrowser-Render-Response", (evnt, response) => {
        
        fileTree.current = JSON.parse(response)
        //console.log("Refreshed Data:", fileTree.current)
        //console.log("mix partition size:",getFolderSize("p_mix partition"))
        //console.log("byId", fileTree.current)
        //console.log("byPath", fileTreeByPath.current)
        
        // Setting based on list file response
        let currentDirId = (dirStack.current[dirStack.current.length - 1])[0]
        
        const {google, dropbox} = getFolderSize(currentDirId)
        setCurrentFolderSize([google, dropbox])
        //setCurrentFolderSize(getFolderSize(currentDirId))
        setDisplayedFiles(fileTree.current[currentDirId].children)        
        
      })
    }   

    function changeWorkingDirectory(op, dnext) {      
      let 
      d = dirStack.current, 
      dlen = dirStack.current.length,
      dstr = "home", dId = "root"

      if (dnext) [dstr, dId] = dnext      
      if(d.length === 1 && op==="back") return  
      
      switch (op) {
        case "back":        
        // clicking on back button
          if (!dnext) {
            
            if(d[d.length - 1][0] === "home") {
              console.log("already at home")
              return;
            }
            d.splice(dlen - 1, 1);
            ([dstr, dId] = d[d.length-1]);
            break;
          
          }
         

        while (dnext !== d[d.length - 1]) {
          d.pop()
          // clicking on current directory from dirpath bar
          // peek()
          // if(dnext === d[d.length - 1]) {            
          //   break;
          // }

          // // clicking on previous directory - keep popping till its found
          // const {popStr, popId} = d.pop()
          // if (popId === dId) {
          //   dIsFound = 1
          //   break
          // }
        }
          break;
        case "fwd":
          d.push(dnext)
          break;
        case "srch":          
          findItem(dnext) //just sets the stack properly - not needed for function
          break;
        default: {}
      }      
      
      // set new directory stack to the worked copy
      dirStack.current = d      

      //setting based on file tree navigation
      console.log("tree, nav", fileTree.current, dstr)
      
      setDisplayedFiles( fileTree.current[dstr] && fileTree.current[dstr].children)

    }

    function findItem({dStr, dId}) {}
      // Search - string/ id

      function getFolderSize(name) {
        //console.log("sizing folder:", name);
        const allFolders = fileTree.current;
        const toCalculateFolder = allFolders[name];
        if(!toCalculateFolder) return {google:0, dropbox:0}   
        let totalSize = {
          ...Object.keys(toCalculateFolder.mergedIDs).reduce((acc, el) => {
            acc[el] = 0;
            return acc;
          }, {}),
        };
        totalSize["google"] = 0; totalSize["dropbox"] =0
        totalSize = _getFolderSize(toCalculateFolder, totalSize);
        return totalSize;
        function _getFolderSize(folder, totalSize) {
          for (const child of Object.values(folder.children)) {
            //console.log("childname", child.name);
            if (child.isFolder) {
              //recurse
              const toCalculateFolder = allFolders[child.name];
              const { google, dropbox } = _getFolderSize(
                toCalculateFolder,
                totalSize
              );
              // console.log("folder" , child.name, "ggl dbx", google, dropbox)
              // if(google) {
              //   totalSize["google"] += google || 0
              // }
              // if(dropbox) {
              //   totalSize["dropbox"] += dropbox || 0
              // }
            } else {
              //console.log("file.name", child.name);
              // a non folder can only exist in merged form if mirrored
              // still must consider it takes up space "twice"
              for (const id of Object.keys(child.mergedIDs)) {
                totalSize[id] += parseInt(child.size) || 0;
              }
            }
            //console.log("size", totalSize["google"], totalSize["dropbox"]);
          }
          return totalSize;
        }
      }

    


    }

  export default FilesBrowser;

  
  