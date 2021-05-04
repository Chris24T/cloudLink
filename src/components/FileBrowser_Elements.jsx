
import React, {useContext} from "react"

import Card from 'react-bootstrap/Card'
import ButtonBar from "./ButtonBar"
import {browserContentContext } from "../Contexts/browserContentContext"
import { ProgressBarsBox } from "./ProgressBarsBox"
const { ipcRenderer} = window.require('electron');


const drivesStyle = {
    "google":{
        color:"yellow"
    },
    "dropbox":{
        color:"blue"
    },
    "other":{
        color:"grey"
    }
}

export function FilesBrowser_PWD(props) {
    const dStack = props.d    

    if(!dStack) return <span> error:no directory found</span>
    if(dStack.length === 1) return <div className="FB-Directory"><span>Pick A Partition To Work in, Or Create a New One</span></div>
    return (

        <div className="FB-Directory">
            <span>Path: {window.location.pathname}</span>
            {
            
            dStack.map(d => {
                //console.log("Directory",d[0])
                return <a key={d[1]} href="#" /*onMouseOver={() => console.log("hover")}*/ onClick={() => props.func1("back", d)}> <span id="dirTxt"> {d[0].includes("p_") ? d[0].slice(2, d[0].length) : d[0]}/ </span>  </a>
            })
            }
            {/* <span id="dirTxt">{dStack[dStack.length - 1][0]}</span> */}
            {/* <span id="dirTxt">{dStack}</span> */}
        </div>

    )
}

export function FilesBrowser_Folders(props) {
    const {allFiles:fileTree, convertUnits} = useContext(browserContentContext)

    const 
    {folders, isPartitionLevel} = props.fd,
    folderFuncs = props.fdfunc
    //console.log("render folders", folders)
    
    // if (folders.length === 0) return (
    // <div className="FB-Folders">
    //     <span>No Folders</span>
    // </div>)
    return(
        <React.Fragment>
            
        <div className="FB-Folders" >
        {Object.values(folders).map( (folder) => {            
        
            return(
                
                
                <div    onClick={
                            () => folderFuncs.onClickChild("fwd", [folder.name, folder.mergedIDs])} 
                        className={isPartitionLevel ? "folder partition" : "folder"} key={folder.id} >
                            {optionMenu(fileTree.current, folder)}
                            {originDisplay(folder)}
                                        
                    <h6 class="card-title">{folder.displayName || folder.name} </h6>
                            { isPartitionLevel ? moreDetailDisplay(fileTree.current, folder.name, convertUnits) : "" }
                </div>
        
            )
        })}
        <div className="folder" data-bs-toggle="modal" data-bs-target="#createFolderModal" onClick={() => {}}>
        <span>Create New {isPartitionLevel ? "Partition" : "Folder"} </span>
        </div>
        </div>

            
            </React.Fragment>
    )

}

export function FilesBrowser_Files(props) {
    const 
    files = props.fi,
    fileFuncs = props.fifunc
    
    
    return (

        
        <div className="FB-Files"> 
        {Object.values(files).map( (file) => {

            return ( <div className="File"> 
                {optionMenu({}, file)}
                {originDisplay(file)}
                <div className="File-Thumbnail">
                {/* <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-file-earmark-richtext-fill" viewBox="0 0 16 16">
                <path d="M9.293 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.707A1 1 0 0 0 13.707 4L10 .293A1 1 0 0 0 9.293 0zM9.5 3.5v-2l3 3h-2a1 1 0 0 1-1-1zM7 6.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm-.861 1.542 1.33.886 1.854-1.855a.25.25 0 0 1 .289-.047l1.888.974V9.5a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V9s1.54-1.274 1.639-1.208zM5 11h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1zm0 2h3a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1z"/>
                </svg> */}
                <img 
                        className="img-thumbnail"
                        style={{ top:"25%", 
                            margin:"0px", 
                            padding:"0px", 
                            transform:"translate(-50%, -20%)", 
                            width:"80%", 
                            height:"60%", 
                            borderRadius:"8px", 
                            position:"absolute"}}
                        src={"defaultFileIcon.svg"} 
                        alt={"No Image"}>
                    </img> 
                </div>
                <div className="File-Title"> <span>
                    {file.name}
                    </span> </div>
            </div>)


            return (
                <Card 
                className="mb-2 File"
                key={file.id}                
                bg="light" 
                style={{overflow:"hidden"}}
                >

                

                <Card.Body style={{textAlign:"center", padding:0}}>                
                    <div>
                            {optionMenu({}, file)}
                            {originDisplay(file)}
                    </div>
                    <img 
                        className="img-thumbnail"
                        style={{ top:"35%", 
                            margin:"0px", 
                            padding:"0px", 
                            transform:"translate(-50%, -20%)", 
                            maxWidth:"50%", 
                            maxHeight:"50%", 
                            borderRadius:"8px", 
                            position:"absolute"}}
                        src={props.thumbnail} 
                        alt={"Failed to Get "/*+props.thumbnail*/}>
                    </img> 
                    
                </Card.Body>
                <Card.Footer style={{position:"absolute", width:"100%", height:"50px", bottom:"0px", padding:0}}>
                <span>
                    {file.name}
                    </span> 
                </Card.Footer>
            </Card>
            )
        })}
        </div>
    )
}

function moreDetailDisplay(fileTree, fileName,convert) {

    let partitionType = "Span",
    smartEnabled="",
    segSize="N/A",
    recDensity="N/A"    

    let showseg = false,
    showRecD = false

    if(!fileName.includes("p_Unpartitioned")) {
        const {blockWidth, mode, recoveryDensity} = fileTree[fileName].partitionConfig.fulfillmentValue[0]
        const {uploadType, isSmart} = mode

        switch(uploadType) {
            case 0: partitionType = "Span"; break;
            case 1: partitionType = "Mirror";break;
            case 2: partitionType = "Stripe";break;
            case 3: partitionType = "Mirror-Stripe";break;
            default: partitionType = "Unknown"
        }

        if(uploadType > 1 || isSmart)
            smartEnabled = isSmart ? "Enabled" : "Disabled"
            if(uploadType > 1) showseg = true
            if(isSmart) showRecD = true
            segSize = convert(Math.round(blockWidth*100)/100)
            recDensity = recoveryDensity
            
        

    }
    

    return ( 

        <div class="detailBox container">
            <div class="row h-10">

                <div class="col-3"> <small style={{}}> Type:  </small></div>
                <div class="col-9" style={{marginTop:"0px"}}><small style={{}}>{partitionType}</small></div>
            </div>

            {smartEnabled !== "" ? printSmartUpload(smartEnabled) : ""}

            

            
           
            {/* <div class="col-6"> <small> Smarter Uploads: {smartEnabled} <br/></small></div>
            {showseg ? (function () {return (<small> Target Segment Size: {segSize} <br/></small>)})() : ""}
            {showRecD ? (function () {return (<small> Recovery Density: {recDensity || "100%"} <br/></small>)})() : ""} */}
            
            
            
            
        </div>

    )
        function printSmartUpload(option) {
           
            return(
                <div class="row h-10 pt-3">

                <div class="col-6"> <small> Smarter Uploads:  </small></div>
                <div class="col-6"> <small style={{}}>{option}</small></div>
                </div>
            )
            
        }
}

function optionMenu(fileTree, resource) {
    return (
        
        <div className="detailButton" style={{ position:"absolute", left:"0%", top:"0px", padding :"0px", margin:"0px"}}>
            
            <div className="btn-group dropstart" style={{}}>
            <button type="button" style={{padding:0, paddingLeft:"10px", margin:0, backgroundColor:"transparent", borderColor:"transparent", borderRadius:"5px"}} className="btn btn-secondary" data-bs-toggle="dropdown" onClick={(e)=> e.stopPropagation()}aria-expanded="false">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="grey" class="bi bi-three-dots" viewBox="0 0 16 16">
                <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
                </svg>
            </button>
            <ul class="dropdown-menu">
            <li><button className="dropdownButton" style={{}} onClick={(e)=> {e.stopPropagation(); deleteItem(resource.isFolder, resource)} }>Delete</button></li>
            {/* <li><button className="dropdownButton" data-bs-toggle="modal" data-bs-target="#partitionDetailModal" onClick={{showDetailView}}>View Details</button></li> */}
            <li><button className="dropdownButton" onClick={(e)=>{e.stopPropagation(); downloadItem(fileTree, resource)}}>Download</button></li>
            </ul>
            </div>
        </div>
    )

    function showDetailView() {
        document.getElementById("")
    }

    function closeDetailView() {
        document.body.className = document.body.className.replace("modal-open","");
        
        document.getElementsByClassName("modal-backdrop fade show")[0].remove()
        // const modal = document.getElementsByClassName("modal-dialog")[2]
        // console.log("ca", modal)
    }
}

function downloadItem(files, item) {
    // send message to backend to download this
    let toDownload = {}
    console.log("item", item)
    if(item.isFolder) {
        const folder = files[item.name]
        if(item.name.includes("__")) {
            //part container
            toDownload = {
                fileInfo:item,
                partSources: buildDownloadList(Object.entries(folder.children) , false)
            }

            console.log("toDownlaod", toDownload)
            
        } else {
            //normal folder - just pass folder ID and path
            // can download by folder in api (better than recursively downloading contents)
            // not downloading this
        }
    } else {
        //just a file, return id for download
        console.log("dwnload ", item)

        toDownload ={
            fileInfo:item,
            partSources:buildDownloadList([[item.name, item]], true)
        }
    }

    const requestBody = {
        data:[toDownload]
    }

    const request = {
        requestType:"fileDownload-request",
        requestBody
    }
    console.log("sending request", request)
    ipcRenderer.send("FileBrowser-Download-Request", [request])

    //renderer send download request
    //payload of "toDownload"
        

    console.log(files[item.name])
    console.log(item)
    // if(isFolder && name.includes("__")) {
        //have container folder
        //need to get its children name and id
        // use name to get positoin


    //}

   function buildDownloadList(parts, isSimple) {
    const container = {}

    parts.forEach(( [partName, part] )=> {
        let position = 0
        if(!isSimple) position = partName.split("||")[1]
         
        Object.entries(part.mergedIDs).forEach(([vendorId, IDSet]) => {
            container[vendorId] = container[vendorId] || []
            container[vendorId].push([position, IDSet[0]])
        }) 
    })

    return container
   }


}

function showDetailToggle() {
    // toggle visibilty of detail model


}

function deleteItem(isFolder, item)
 {
     console.log("deleting Item", item)
    //just flat out delete
    const toDelete = {partSources:Object.entries(item.mergedIDs).reduce((acc, [driveId, IDSet]) => {
        acc[driveId] = [[item.name, IDSet]]
        return acc
    }, {})}

    const requestBody ={
        data:[toDelete]
    }

    const request = {
        requestType:"deleteFile-request",
        requestBody
    }

    

    ipcRenderer.send("FileBrowser-Delete-Request", [request])

 }


export function Control_Bar(props) {
    //need to update props on new download or upload
    let {uploads, downloads, toggleDisplayMode} = props
    uploads = ["a", 1 ,2, 2]
    downloads = [1, 2, 3, 4]
    return (
        <div style={{position:"sticky"}}id="ControlBar">
            
            <ProgressBarsBox />

            <div id="buttons" style={{width:"100%"}}>
                
                <button className="btn btn-primary" onClick={toggleDisplayMode}>Toggle DisplayMode</button>
                
                <div style={{display:"flex", flexDirection:"column", width:"150px", position:"absolute", right:"20px", bottom:"15px", borderStyle:"solid"}}>
                    Key
                    <div>
                    <div className="dot" style={{backgroundColor:"yellow"}}></div>
                    Google
                    </div>
                
                <div>
                <div className="dot" style={{backgroundColor:"blue"}}></div>Dropbox
                </div>
                
                </div>
                

            </div>
        </div>
    )
}



function toggleClass(el, className) { 
    el.classList.toggle(className) 
};

function removeClass(el, className) {
    el.remove(className)
}

function originDisplay({mergedIDs}) {
    const originSet = Object.keys(mergedIDs).sort()
    return(
        <div className="originsDisplay">
                {originSet.map( originID => {
                    return (
                    <span className="dot" style={{ backgroundColor:drivesStyle[originID].color }}> </span>
                    )
                })}
            </div>
    )
}


//Ui versions to be called immediatly after prop version is called
// (act before the server acknowledges)
// e.g. confirmation box?
// 22 01 21 No use yet
function deleteFilePress() {

}

function downloadFilePress() {

}

function uploadFilePress() {

}

