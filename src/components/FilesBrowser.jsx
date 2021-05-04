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

    const {dirStack, onGoingDownloads, onGoingUploads, convertUnits, globalUsage, setCurrentFolderSize, currentFolderSize,usageStatistics:usage, allFiles:fileTree, displayFiles:displayedFiles, setDisplayFiles, activePartition=true} = useContext(browserContentContext)
    const [displayMode, setDisplayMode] = useState("advanced")
    const [displayForm, setDisplayForm] = useState(true)
    const [viewDetailModel, setViewDetailModal] = useState(true)
    
    let
    //[displayedFiles, setDisplayedFiles] = useState([]), //all handling meta data, only handle reall data at donwload or upload (not read)
    
    setDisplayedFiles = setDisplayFiles      
    //dirStack = dirStack,  //name, id
    //fileTree = useRef({}),
    //fileTree = allFiles,
    
    // config = useRef({
    //   displayType:displayMode,
    //   partitionConfig:"",
    //   mode:{
    //     uploadType:2, 
    //     isSmart:0},      
    //     connectedDrives: ["dropbox","google"], //order here decides who gets frist part - must match target drive
    //     blockWidth:2000
    // })   

    useEffect(() => {
      console.log("init render")      
      const intvl = updateLoop()      
      //clearInterval(intvl) //disables drive polling
      
    
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

      if(dStack.length > 1 && !currentDirName.includes("Unpartitioned")) {
        //console.log("dstacj", dStack)
        const partitionName = dStack[1][0]
        //console.log("parition", fileTree.current[partitionName])
        const partitionLimits = fileTree.current[partitionName].partitionConfig.fulfillmentValue[0].targets
        const capacity = getFolderSize(partitionName)
        //console.log(partitionLimits)
        usage = [[(partitionLimits["google"]?.limit) || -1, (capacity.google)||-1], [(partitionLimits["dropbox"]?.limit) || -1, (capacity?.dropbox || -1)]]
        
      } else {
        const {google, dropbox} = getFolderSize("home")
        usage = [[1000, google],[1000, dropbox]]
      }

      
      
      //console.log("usage", usage)
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
    function findExistingFileData(toFind, simDir) {
      //default search space is global search space - recursive almost
      // want to change to currentDir
      
      // want to find existing existing data 
      // am looking for parts - mode will decide whether to look for "__name" folder or just "name" file 

      const directoryStack = simDir || dirStack.current
      const allFiles = fileTree.current
	  
	  let uploadType = 0

      const existingData = {
        //file:google[id], dropbox[id] -> id set can be empty
      }

      if(directoryStack.length > 1) {
        //in a partition, restirct search just to working partitoion
		// set upload type to correct from config
		const partitionName = directoryStack[1][0]
		const partition = allFiles[partitionName]
		uploadType = partition.partitionConfig.fulfillmentValue[0].mode.uploadType
		const searchFolder = allFiles[directoryStack[directoryStack.length-1][0]]
		_search(toFind, /*partition*/ searchFolder)

      } else {
        // not in partition, must search unpartitioned folder children (top level only) for a copy

        const partition = allFiles["p_Unpartitioned Files"]
        _search(toFind, partition)
	}

	return existingData

      function _search(files, container, r=0) {
		
        for( const findFile of files) {
			const info = {name:findFile.name, path:findFile.path, size:findFile.size}
			const existingFileData = {container, parts:{}, isSimple:true, isData:false}
			existingData[findFile.name] = {info, existingFileData}
				
			for(const existingFile of Object.values(container.children)) {
				
				if(parseInt(uploadType) === 0 || parseInt(uploadType) === 1) {
					//looking for file
					console.log("Looking for file")
					if(findFile.name === existingFile.name && !existingFile.isFolder) {
						console.log("FB-ExistsData: ", existingFile)
						//found simple copy
						existingData[findFile.name].existingFileData.isData = true
						for ( const [driveName, IDset] of Object.entries(existingFile.mergedIDs)) {
												
							existingData[findFile.name].existingFileData.parts[driveName] =  existingData[findFile.name].existingFileData.parts[driveName] || []
							existingData[findFile.name].existingFileData.parts[driveName].push([findFile.name, IDset])
							
						}
					}

				} else {
					//looking for __ part container
					
					console.log("FB-StripedExistingContainer: ", existingFile, findFile)
					if(existingFile.name.includes(findFile.name) && existingFile.isFolder) {
						//found "split" copy part container
							
							const partContainer = allFiles[existingFile.name]
							existingData[findFile.name].existingFileData.isSimple = false
							existingData[findFile.name].existingFileData.isData = true
							existingData[findFile.name].existingFileData.container = partContainer
							console.log("FB-PartCOntainer", partContainer)
							for(const part of Object.values(partContainer.children)) {
								for(const [driveName, IDset] of Object.entries(part.mergedIDs)) {
									existingData[findFile.name].existingFileData.parts[driveName] =  existingData[findFile.name].existingFileData.parts[driveName] || []
									existingData[findFile.name].existingFileData.parts[driveName].push([part.name, IDset, part.path])
								}
							}


					}
				}

				if(r && existingFile.isFolder) {
				//recursive
					container = files[existingFile.name] 
					_search(files, container, 1)
				}

			}
        }
      }

	  return existingData

        

    }

    function partitionHasSpace(files) {
      //if total size of files is too big, dont allow
      console.log("dile", files)
      let toUploadBytes = files.reduce( (acc, el) => {
        acc += el.size || 0
        return acc
      }, 0)


      if(dirStack.current.length > 1) {
      const partitionName = dirStack.current[1][0]
      const partitionCFG = fileTree.current[partitionName].partitionConfig.fulfillmentValue[0]

      const partitionUsage = Object.values(getFolderSize(partitionName)).reduce( (acc, el) => {
        acc += parseInt(el)
        return acc
      }, 0)
      //console.log("pusage ", partitionUsage)
      const partitionLimit = getPartitionLimit(partitionCFG)
      //console.log("plimit", partitionLimit)
      //console.log("uploadingBytes", toUploadBytes, "remaining", partitionLimit - partitionUsage)
      if(toUploadBytes < (partitionLimit - partitionUsage)) return true
      else return false
      
      }

      
    }

    function getPartitionLimit(cfg) {
      return Object.values(cfg.targets).reduce( (acc, el) => {
        
        const {limit} = el
        acc += limit
        return acc
      }, 0)
    }

    const simOnDrop = ( (fileInfo, partitionInfo, targetInfo) => {
      console.log("tgt", targetInfo)
      const toUpload = findExistingFileData([fileInfo], targetInfo.droppedPath)
      
      uploadFiles(toUpload, partitionInfo, targetInfo)
    })

    function testDrop() {



      let paths = [{path:"/home/chris/Work/programs/yr3Project/testFiles/test7", name:"test7", size:83886080    }]

      

      onDrop(paths)
    }

    const onDrop = useCallback ( (droppedFiles) => {
		const directory = dirStack.current
		const partitionName = directory.length

    const toUpload = findExistingFileData(droppedFiles)
	  console.log("FB: Existing Data Result", toUpload)
    if (partitionHasSpace(droppedFiles)) uploadFiles(toUpload)
    else {console.log("Not Enough Space")}  
    })    

    return (
      
      <React.Fragment>   
      <Route exact path="/"> 
           
      <HomeView test={() => testDrop()} content={displayMode === "advanced" ? displayedFiles : buildDisplay(displayedFiles, findForeignFolders(),fileTree.current)} dirStack={dirStack}/>
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
        <span >Trash Page - Under Construction</span>
        </div>
      )
    }
  
    function SettingsView() {
      return (
        <div id="FileBrowser-Container" >
        <span >Settings Page - Under Construction</span>
        </div>
      )
    }
  
    function DrivesView() {
      return (
        <div id="FileBrowser-Container" >
          <span>Drive Page - Under Construction</span>
        </div>
      )
    }

    function propsDetails() {
      
    }

    function formMoreDetailView() {
      return (
        <div class="modal fade" id="moreDetailModel" tabindex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="exampleModalLabel">Modal title</h5>
        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      <div class="modal-body">
        ...
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
        <button type="button" class="btn btn-primary">Save changes</button>
      </div>
    </div>
  </div>
</div>

      )
    }

    function formCreateFolderView(isPartition) {
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

        

        <form className="needs-validation" id="createFolder" onSubmit={(e) => handleCreateFolderFormSubmit(e)}>

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
                <input type="text" class="form-control" id="folderName" placeholder={"My"+toCreateStr} required/>
                
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
        //console.log("width", googleWidth, dropboxWidth)
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
              
              
              <div className="row pt-4">

                <div className="col-12">Configure Partition Type:</div>

              </div>

              <div className="row pt-2">
                
                <div className="col-7">

                <select id="raidTypeSelect" class="form-select" aria-label="Default select example" required>
                <option selected disabled value="">Partition RAID Type</option>
                <option value="0">Span</option>
                <option value="1">Mirror</option>
                <option value="2">Stripe</option>
                <option value="3">Mirror-Stripe</option>
                <option value="4" disabled="true" >Parity (Not Yet Supported)</option>
              </select>
              <div class="invalid-feedback">
                Please select a valid state.
              </div>

                </div>

                <div className="col-5">

                <div class="form-check">
                  <input onChange={() => reflectChangeInForm("deltaButton")} class="form-check-input" type="checkbox" value="1" id="flexCheckSmart"/>
                  <label class="form-check-label" for="flexCheckDefault">
                    Enable Smarter Uploads
                  </label>
                </div>

                </div>


              </div>

              <p style={{paddingTop:"5px"}}>
              <button  onClick={() => toggleAdvOptions()} class="btn btn-primary btn-sm" type="button" data-toggle="collapse" data-target="#advOptions" aria-expanded="false" aria-controls="collapseExample">
                Toggle More Settings
              </button>
              </p>
              

              <div class="collapse" id="advOptions">
                <div class="card card-body">
                <div class="input-group mb-3">
                    <div style={{width:"100%"}}>Track Contents
                    <input id="trackContents_input" style={{width:"50%"}} type="checkbox" /> 
                    </div>                   
                  </div>
                  <div class="input-group mb-3">
                    <div style={{width:"100%"}}>Target Segment Size</div>
                    <input id="chunkSize_input" style={{width:"50%"}} type="number" class="form-control" max="256" min="1" placeholder="16" aria-label="Recipient's username" aria-describedby="basic-addon2" />
                    <div style={{width:"50%"}} class="input-group-append">
                      <span class="input-group-text" id="basic-addon2">KB</span>
                    </div>
                  </div>
                  <div class="input-group mb-3">
                  <div style={{width:"100%"}}>Recovery Density</div> 
                    <input id="recoveryDensity_input" style={{width:"50%"}} max="100" min="1" type="number" class="form-control" placeholder="100" aria-label="Recipient's username" aria-describedby="basic-addon2" />
                    <div style={{width:"50%"}} class="input-group-append">
                      <span class="input-group-text" id="basic-addon2">%</span>
                    </div>
                  </div>                
                </div>
              </div>


            
              
          </React.Fragment>  
        )
      }
      
    }

    function toggleAdvOptions() {
      document.getElementById("advOptions").classList.toggle("collapse")
      
    }

    function reflectChangeInForm(type) {
      //if smart selected, set raid field to stripe if is not already

      if(type === "deltaButton") {  
        const element = document.getElementById("raidTypeSelect")
        element.value = "2"
      }

      // all types can access multiple drives
      // so no action needed on type change



    }

    function getReserved() {
      //sum across limits of every partition
      let googleReserved = 0,
      dropboxReserved = 0

      for (const folder of Object.values(fileTree.current)) {
        if(folder.isPartitionFolder) {
          
          googleReserved += parseInt(folder.partitionConfig?.fulfillmentValue[0]?.targets?.google?.limit || 0)
          dropboxReserved += parseInt(folder.partitionConfig?.fulfillmentValue[0]?.targets?.dropbox?.limit || 0)
        }
      }
      return {googleReserved, dropboxReserved}
    }

    function updateAllocation({googleRemaining:googleTotal=1000, dropboxRemaining:dropboxTotal=1000}) {     
      const inputs = document.getElementsByClassName("form-number-input")
      // const type = document.getElementById()
      // console.log("googs", googleTotal)
      const gglAlloc = (inputs[0].value * 1024 * 1024) || 0
      const dbxAlloc = (inputs[1].value * 1024 * 1024)|| 0

      // console.log("Width", Math.floor((gglAlloc/googleTotal)*100))

      document.getElementById("allocationBar-Google-Input").style.width = Math.floor((gglAlloc/googleTotal)*100)+"%"
      document.getElementById("allocationBar-Dropbox-Input").style.width = Math.floor((dbxAlloc/dropboxTotal)*100)+"%"

      //flip parttiion type to span if not already chosen one

    }

  function HomeView({content, dirStack, test}) {
    //console.log("Rendering Content:", content)
    const {getRootProps, getInputProps, isDragActive} = useDropzone({onDrop})

    const onGoingUploads = useRef([])
    const onGoingDownloads = useRef([])

    // if(dirStack.current.length === 1) return (
    //   <div>

                   

    //   </div>
    // )

    if(!activePartition) return <div></div>

    return (
      
      <div {...getRootProps( {onClick: e => e.stopPropagation(), id:"FileBrowser-Container"})} style={{}}>
          <input {...getInputProps()} />
          {/* <button style={{left:"50px", width:"50px", height:"25px", zIndex:"10"}} onClick={test}>Test</button>   */}

          {            
            //isDragActive ? <p>drop here</p> : <p>drag and drop a file anywhere to upload</p>
            // set to true when click on "create folder " button
            // set to false on complete or exit form
            displayForm ? formCreateFolderView(dirStack.current.length === 1) : ""
            
          }

          {
            formMoreDetailView()
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
                      "onCreateFolder": createFolderForm,
                      // "onDetailView":createDetailViewModal
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

            <ControlBar toggleDisplayMode={() => toggleDisplayMode()} onGoingUploads={""} onGoingDownloads={""}></ControlBar>
          
        </div>

    )
  }
  function toggleDisplayMode() {
    
    if(displayMode === "simple") return setDisplayMode("advanced")
    setDisplayMode("simple")
    
  }

  function createViewDetailModal() {
    setViewDetailModal(true)
  }

  function createFolderForm(name) {
    setDisplayForm(true)
  }

  function handleCreateFolderFormSubmit(event) {
    event.preventDefault()
    console.log("Form Submitted:", event)
    const [folderName, GGLAlloc, DBXAlloc, mode, isSmart, , isTracked, chunkSize, recDensity]= event.target

    document.getElementById("modalClose").click()

    console.log("Creating Folder with name", folderName.value)
    
    const dir = dirStack.current
    const target = fileTree.current[dir[dir.length - 1][0]].mergedIDs

    let blockWidth = chunkSize?.value || chunkSize?.placeholder 
    blockWidth = parseInt(blockWidth)*1024 //form KB to B
    let recoveryDensity = recDensity?.value || recDensity?.placeholder
    recoveryDensity = parseInt(recoveryDensity)/100
    
    const requestBody = {
        params: {        
          targetDrive: target || "google",
          targetPath: dir,                  
        },
        data: {
          name:folderName.value,
          isPartition: dir.length === 1,
          allocation:{
            "google":{limit:(parseInt(GGLAlloc?.value))*1024*1024, usage:0},
            "dropbox":{limit:(parseInt(DBXAlloc?.value))*1024*1024, usage:0}
          },
          blockWidth,
          isTracked: isTracked?.checked,
          recoveryDensity,
          mode: {
            uploadType: parseInt(mode?.value),
            isSmart: isSmart?.checked
          }
          
        }
      }

      const request = {
        requestType:"createFolder-request",        
        requestBody
      }

    ipcRenderer.send(CHANNEL_NAME_REQ, [request])
  }

  function buildDisplay(toDisplay) {
    
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
   
   
  }

    //Eventually, make these changes appear locally before server acknowledges 
    //to make it seem faster/less hang time

    //send file list to server side
    function uploadFiles(files, partitionInfo, targetInfo ) {

      let dc, dp
      //let {droppedContainer:dc, droppedPath:dp} = targetInfo ;
      dc = targetInfo?.droppedContainer
      dp = targetInfo?.droppedPath

      const dStack = dirStack.current
      const fullWorkingDir = dirStack.current // current working directory stack
      const containingDirId = fullWorkingDir[fullWorkingDir.length-1][0] // Top level directory (wokring directory) id
      const containingDir = fileTree.current[containingDirId] // Get the containing folder by workingdir id
      
	  // generic toplevel drop config
      let config = {          
          mode:{
            uploadType:0, 
            isSmart:0},      
          targets: {google:"", dropbox:""}, //order here decides who gets frist part - must match target drive
          blockWidth:2000
        }
      

      if(fullWorkingDir.length > 1) {
        const partiionDir = fileTree.current[dStack[1][0]]
        const partitionCfg = partiionDir.partitionConfig.fulfillmentValue[0]
        config = partitionCfg 
      }
      
      //simulating drop from backend, needs to sim being in a partition
      if(partitionInfo) {
        config = partitionInfo
      }
	  
	  console.log("FB Upload Files Config:", config)

      //const paritionID = fileTree[fullWorkingDir[1][1]].partition
      
      const requestBody = {
        params: {
          config,
          droppedContainer: dc || containingDir,
          droppedPath: dp || fullWorkingDir,
                    
        },
        data: Object.values(files).map( ({info, existingFileData}) => {
          return (
            {              
              fileInfo:info, // from os              
              existingFileData
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

    function updateOnGoingUploads(requests) {
      
      requests.forEach(request => {
        const name = request.fileInfo.name
        onGoingUploads.current[name] = [0, request.fileInfo.size, 0]
      })

      
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
    // init function
    function updateLoop() { //check for changes by repeatedly querying back end
      fetchFileData()
      //console.log("listener Set")
      ipcRenderer.on("simulate-drop", (e, toDrop) => {
        //console.log("Front: Sim Drop")
        //console.log("items: ", toDrop)
        simOnDrop(toDrop[0], toDrop[1], toDrop[2])
      })

      ipcRenderer.on("FileBrowser-Usage-Response", (event, response) => {
        response = JSON.parse(response)
        //console.log("usage res[psme ", response)
        usage.current = response
        globalUsage.current = response
      })

      ipcRenderer.on("FileBrowser-Render-Response", (evnt, response) => {
        
        fileTree.current = JSON.parse(response)
        // Setting based on list file response
        let currentDirId = (dirStack.current[dirStack.current.length - 1])[0]        
        const {google, dropbox} = getFolderSize(currentDirId)
        
        setDisplayedFiles(fileTree.current[currentDirId].children)        
        
      })
      return setInterval(() => {
        if(document.body.classList.contains("modal-open") ) {
         //stops re renders occuring if modal is open (due to modal bug - non disappearing overlay)
          return
        }
        
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
      //console.log("tree, nav", fileTree.current, dstr)
      
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

  
  /*
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
              */