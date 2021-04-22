
import React from "react"
import { CodeSlash } from "react-bootstrap-icons"
import Card from 'react-bootstrap/Card'
import ButtonBar from "./ButtonBar"

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
    return (

        <div className="FB-Directory">
            <span>Path: {window.location.pathname}</span>
            {
            
            dStack.map(d => {
                //console.log("Directory",d[0])
                return <a key={d[1]} href="#" onMouseOver={() => console.log("hover")} onClick={() => props.func1("back", d)}> <span id="dirTxt"> {d[0].includes("p_") ? d[0].slice(2, d[0].length) : d[0]}/ </span>  </a>
            })
            }
            {/* <span id="dirTxt">{dStack[dStack.length - 1][0]}</span> */}
            {/* <span id="dirTxt">{dStack}</span> */}
        </div>

    )
}

export function FilesBrowser_Folders(props) {
    const 
    {folders, isPartitionLevel} = props.fd,
    folderFuncs = props.fdfunc
    //console.log("render folders", folders)
    
    // if (folders.length === 0) return (
    // <div className="FB-Folders">
    //     <span>No Folders</span>
    // </div>)
    return(
        
        <div className="FB-Folders" >
        {Object.values(folders).map( (folder) => {            
        
            return(
                
                
                <div    onClick={
                            () => folderFuncs.onClickChild("fwd", [folder.name, folder.mergedIDs])} 
                        className="folder" key={folder.id} >
                            {optionMenu(folder)}
                            {originDisplay(folder)}            
                    <span>{folder.displayName || folder.name} </span>
                </div>
        
            )
        })}
        <div className="folder" data-bs-toggle="modal" data-bs-target="#createFolderModal" onClick={() => folderFuncs.onCreateFolder("NEW")}>
        <span>Create New {isPartitionLevel ? "Partition" : "Folder"} </span>
        </div>
        </div>
    )

}

function optionMenu(folder) {
    return (
        <div className="detailButton" style={{ position:"absolute", left:"0%", top:"0px", padding :"0px", margin:"0px"}}>
            
            <div class="btn-group dropstart" style={{}}>
            <button type="button" style={{padding:0,margin:0, backgroundColor:"black", borderRadius:"5px"}} class="btn btn-secondary" data-bs-toggle="dropdown" onClick={(e)=> e.stopPropagation()}aria-expanded="false">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-three-dots" viewBox="0 0 16 16">
                <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
                </svg>
            </button>
            <ul class="dropdown-menu">
            <li><button className="dropdownButton" style={{}} onClick={(e)=> {e.stopPropagation(); deleteItem(folder)} }>Delete</button></li>
            <li><button className="dropdownButton" onClick={(e)=>{e.stopPropagation(); showDetailToggle()}}>View Details</button></li>
            <li><button className="dropdownButton" onClick={(e)=>{e.stopPropagation(); downloadItem(folder)}}>Download</button></li>
            </ul>
            </div>
        </div>

    )
}

function downloadItem() {
    // send message to backend to download this
}

function showDetailToggle() {
    // toggle visibilty of detail div
}

function deleteItem(item)
 {
    console.log("delete", item)
    //add to folder named "rubbish"
    // just mark as rubbish = hidden
 }
export function FilesBrowser_Files(props) {
    const 
    files = props.fi,
    fileFuncs = props.fifunc
    //console.log("Rendering Files HERE", files)

    //if (files.length === 0) return <span> No Files</span>
    return (

        
        <div className="FB-Files"> 
        {Object.values(files).map( (file) => {

        

            return (
                <Card 
                className="mb-2 File"
                key={file.id}                
                bg="light" 
                >

                <Card.Header style={{height:"50px", resize:"none"}}>
                    <span>
                    {file.name}
                    </span> {originDisplay(file)} </Card.Header>

                <Card.Body style={{textAlign:"center", padding:0}}>                
                    
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
                    <ButtonBar id="btnbar" className="btnBar" 
                        funcDownload={() => fileFuncs.download(file)} 
                        funcDelete={() => fileFuncs.delete(file.id)}
                        style={{
                            display:"flex",
                        position:"relative",
                        width:"150px",
                        }}>
                    </ButtonBar >
                </Card.Footer>
            </Card>
            )
        })}
        </div>
    )
}

export function Control_Bar(props) {
    return (
        <div id="ControlBar">
            <div class="connectedDrives">
                <div id="googleConn" onClick={()=>toggleClass(document.getElementById('googleConn'), "disabled")}>Google</div>
                <div id="dropboxConn" onClick={()=>toggleClass(document.getElementById('dropboxConn'), "disabled")}>Dropbox</div>
                <div id="megaConn" class="disabled" onClick={() => toggleClass(document.getElementById('megaConn'), "disabled")}>Mega</div>
            
                <select id="mode-select">
                    <option value="-1" >Select Upload Mode:</option>
                    <option value="span" >Span</option>
                    <option value="mirror" >Mirror</option>
                    <option value="stripe" >Stripe</option>
                    <option value="parity" >Parity</option>
                </select>

                <button onClick={() => props.setConfig(document.getElementsByClassName("connectedDrives")) }>apply changes</button>
            </div>

            <div id="buttons">
                <button id="smartBtn" onClick={props.toggleSmartUpload}>Smart Upload Disabled</button>
                <button onClick={props.back}>Back</button>
                <button onClick={props.refresh}>Refresh</button>
                <button onClick={props.toggleDisplayMode}>Toggle DisplayMode</button>
                
            </div>
        </div>
    )
}



function toggleClass(el, className) { 
    el.classList.toggle(className) 
};

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

