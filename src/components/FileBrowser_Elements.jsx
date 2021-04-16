import React from "react"
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
            <span>path {window.location.pathname}</span>
            {
            
            dStack.map(d => {
                //console.log("Directory",d[0])
                return <a key={d[1]} href="#" onMouseOver={() => console.log("hover")} onClick={() => props.func1("back", d)}> <span id="dirTxt"> {d[0]}/ </span>  </a>
            })
            }
            {/* <span id="dirTxt">{dStack[dStack.length - 1][0]}</span> */}
            {/* <span id="dirTxt">{dStack}</span> */}
        </div>

    )
}

export function FilesBrowser_Folders(props) {
    const 
    folders = props.fd,
    folderFuncs = props.fdfunc
    //console.log("render folders", folders)
    
    if (folders.length === 0) return <span>No Folders</span>
    return(
        
        <div className="FB-Folders" >
        {Object.values(folders).map( (folder) => {
            if (folder.name.includes("art#1") || folder.name.includes("art#2") || folder.name.includes("art#3") || folder.name.includes("art#4") || folder.name.includes("art#5")) {
                return null
            }
        
            return(
                
                <div    onClick={
                            () => folderFuncs.onClickChild("fwd", [folder.name, folder.id])} 
                        className="folder" key={folder.id} >
                            {originDisplay(folder)}            
                    <span>{folder.name} </span>
                </div>
        
            )
        })}

        </div>
    )

}

export function FilesBrowser_Files(props) {
    const 
    files = props.fi,
    fileFuncs = props.fifunc
    //console.log("render files", files)

    if (files.length === 0) return <span> No Files</span>
    return (

        
        <div className="FB-Files"> 
        {Object.values(files).map( (file) => {

        if (file.name.includes("art#1") || file.name.includes("art#2") || file.name.includes("art#3") || file.name.includes("art#4") || file.name.includes("art#5")) {
           return null             
        }

        if (file.name.includes("art#0")) file.name = file.name.slice(0, -11)+".txt"

            return (
                <Card 
                className="mb-2 File"
                key={file.id}                
                bg="light" 
                >

                <Card.Header style={{height:"50px", resize:"none"}}>{file.name} {originDisplay(file)} </Card.Header>

                <Card.Body style={{textAlign:"center"}}>                
                    
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
                <Card.Footer style={{width:"100%", height:"50px", bottom:"0px"}}>
                    <ButtonBar id="btnbar" 
                        funcDownload={() => fileFuncs.download(file)} 
                        funcDelete={() => fileFuncs.delete(file.id)}
                        style={{
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
                
            </div>
        </div>
    )
}



function toggleClass(el, className) { 
    el.classList.toggle(className) 
};

function originDisplay({origin="other"}) {
    
    const c = drivesStyle[origin].color
    // return a dot per location,
    // styled to above colour
    return (
        <div className="originsDisplay">
            
              {
                
                <span className="dot" style={{backgroundColor:c}} ></span>

              }  
            
        </div>

    )

}

function buttonBox (props) {
    return (

        <div>
            <span></span>
            <input type="checkbox" />
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

