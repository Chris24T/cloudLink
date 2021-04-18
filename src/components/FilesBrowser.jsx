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

    const {dirStack, allFiles:fileTree, displayFiles:displayedFiles, setDisplayFiles, activePartition=true} = useContext(browserContentContext)
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
      console.log("partigion", isPartition)
      //https://medium.com/@everdimension/how-to-handle-forms-with-just-react-ac066c48bd4f
      //https://css-tricks.com/html5-meter-element/
      return (
        <div className="folderForm">
          <span><h4>{isPartition ? "Create A Partition" : "Create A Folder"} </h4></span>
          <form id="createFolder" onSubmit={handleCreateFolderFormSubmit}>
            <label for="folderName"> Name your new {isPartition ? "Partition" : "Folder"} </label>
            <input onChange={() => {console.log("edit")}} type="text" name="folderName" defaultValue="MyFolder"/><br></br>

            <label for="isSmart"> Select The Drives To Connect </label>
            <label for="driveSelect-google"> Google </label>
            <input type="checkbox"  id="driveSelect-google" value="google" name="isSmart"/>
            <meter></meter>
            <label for="driveSelect-dropbox"> Dropbox </label>
            <input type="checkbox"  id="driveSelect-dropbox" value="dropbox" name="isSmart"/>
            <meter></meter>
          
            {isPartition ? partitionForm() : ""}

            <button type="submit" ></button>
          </form>
        </div>
      )

      function partitionForm() {
        //https://stackoverflow.com/questions/28438485/change-form-contents-dynamically
        return (
          <React.Fragment>
            <label for="mode"> Select The RAID mode of this partition </label>
          
            <select name="mode" id="mode-Form"> 
              <option value="0" disabled="true">Span</option>
              <option value="1">Mirror</option>
              <option value="2">Stripe</option>
              <option value="3">Stipe-Mirror</option>
            </select>

            <label for="isSmart"> Enable Smart Uploads on this partition </label>
            <label for="isSmart-enabled"> Enabled </label>
            <input type="radio"  id="isSmart-enabled" value="1" name="isSmart"/>
            <label for="isSmart-disabled"> Disabled </label>
            <input type="radio"  id="isSmart-disabled" value="0" name="isSmart"/>
          </React.Fragment>  
        )
      }
      
    }

  function HomeView({content, dirStack}) {
    console.log("Rendering Content:", content)
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
              console.log("Rendering", Object.values(content).length, "files")
              
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
    console.log(event)

    const dir = dirStack.current
    const target = fileTree.current[dir[dir.length - 1][1]].origin
    const name = event.name

    const requestBody = {
        params: {        
          targetDrive: target || "google",
          targetPath: dir,                  
        },
        data: {
          name
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
      newItem.originSet = [item.origin]
      if(item.name.includes("__") && item.isFolder) {        
        if(item.name.includes("foreign")) {          
          newItem.isHidden = true
        }
        else {
          newItem.name = item.name.slice(2, item.name.length) //slicing off "__" identifier
          //check if item appears in the foreign folder set, to accumulate "origins"
          for(const [owner, folder] of Object.entries(foreigns)) {
            
            const foreignParts = allFiles[folder[1]].children
            for(const {name} of Object.values(foreignParts)) {
              const trimName = name.slice(2, name.length)
              if(item.name.includes(trimName)) newItem.originSet.push(owner) 
            }

            
            
                       
          }
        }
        //Found a parts folder
        // want to convert to a file representation
        newItem.isFolder = false
      }

      newDisplay[item.id] = newItem
    }
    console.log("generatedDisplay", newDisplay)
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
      ipcRenderer.on("FileBrowser-Render-Response", (evnt, response) => {
        
        fileTree.current = JSON.parse(response)
        

        //console.log("byId", fileTree.current)
        //console.log("byPath", fileTreeByPath.current)
        
        // Setting based on list file response
        let currentDirId = (dirStack.current[dirStack.current.length - 1])[1]
        
        //console.log("tree", fileTree.current, "displaying ", currentDirId)
        //onsole.log("ToDisplay", fileTree.current[currentDirId])
        //console.log("AllocationTable:", fileTree.current)
       console.log("displye", response)
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
          let dIsFound = 0

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
      console.log("tree", fileTree.current)
      setDisplayedFiles(fileTree.current[dId].children)

    }

    function findItem({dStr, dId}) {}
      // Search - string/ id

    }

  export default FilesBrowser;

  
  