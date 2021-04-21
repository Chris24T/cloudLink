import React, { useEffect, useState, useContext } from 'react';
import {browserContentContext } from "../Contexts/browserContentContext"

function DriveCapacity(props) {
    const {dirStack, allFiles:fileTree, currentFolderSize, usageStatistics:usage, convertUnits  } = useContext(browserContentContext)
    // useEffect()
    // useState()
    let len = Object.keys(usage.current).length
    useEffect( () => {
        console.log("render")
    }, [len])

    return (

        <div id="capBox" className="expand" >
            <button id="capBoxGrow" onClick={growCapBox}style={{transition:"0.5s", backgroundColor:"darkgrey",borderStyle:"none",  height:"15px", width:"100%", position:"absolute", left:"50%", transform:"translate(-50%, -80%)"}}><span style={{position:"relative", top:"-5px"}}>Detail</span></button>
            {/* <span>{currentFolderSize}</span> */}
            
                {dirStack.current.length > 1 ? PartitionCapacity() : OverallCapacity()}
            
            
            {/* <div id="capacityBar" style={{backgroundColor:"#f2f2f2", height:"75px"}}></div>
            <div id="capcityDrives" style={{overflow:"hidden"}}>Drive Capacity Bars</div> */}
        </div>

    )

    function OverallCapacity() {
        const driveusage = usage.current
        console.log("usage", driveusage)
        const googleWidth = (Math.floor((100*(driveusage?.google?.used||1)/driveusage?.google?.allocated||100))||1)+"%"
        const dropboxWidth =( Math.floor(( 100*(driveusage?.dropbox?.used||1)/driveusage?.dropbox?.allocated||100)) || 1)+"%"

        const googleUsed =( driveusage?.google?.used||1)
        const dropboxUsed = (driveusage?.dropbox?.used)
        const googleAlloc = (driveusage?.google?.allocated||100)
        const dropboxAlloc = (driveusage?.dropbox?.allocated||100)

        
        const totalAllocMerge = dropboxAlloc+googleAlloc
        
        const totalUsedMerge = googleUsed+dropboxUsed


        console.log("ggl", googleWidth)
        return (
            <React.Fragment>
            <div id="capacity-Merged">
                <span>Merged Drive: total used {convertUnits(totalUsedMerge)} of availible {convertUnits(totalAllocMerge)}</span>
                <div style={{width:"100%", borderStyle:"solid", borderWidth:"2px"}} class="progress" id="allocationBar">
                    <div class="progress-bar" id="allocaltionBar-Google" role="progressbar" style={{width:googleWidth, backgroundColor:"yellow", borderRight:"1px solid black"}} aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div>
                    <div class="progress-bar" id="allocationBar-Dropbox" role="progressbar" style={{width:dropboxWidth, backgroundColor:"blue", borderRight:"1px solid black"}} aria-valuenow="30" aria-valuemin="0" aria-valuemax="100"></div>               
                </div>
            </div>
            
            <div id="cacpity-individual" style={{overflow:"hidden"}}>
            <span>Google Usage: {convertUnits(googleUsed)} of availible {convertUnits(googleAlloc)} </span>
                <div style={{width:"100%", borderStyle:"solid", borderWidth:"2px"}} class="progress" id="allocationBar">
                    <div class="progress-bar" id="allocaltionBar-Google" role="progressbar" style={{width:googleWidth, backgroundColor:"yellow", borderRight:"1px solid black"}} aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
            <span>Dropbox Usage: {convertUnits(dropboxUsed)} of availible {convertUnits(dropboxAlloc)} </span>
                <div style={{width:"100%", borderStyle:"solid", borderWidth:"2px"}} class="progress" id="allocationBar">                
                    <div class="progress-bar" id="allocationBar-Dropbox" role="progressbar" style={{width:dropboxWidth, backgroundColor:"blue", borderRight:"1px solid black"}} aria-valuenow="30" aria-valuemin="0" aria-valuemax="100"></div>               
                </div>            
            </div>
            </React.Fragment>
        )
          
        
    }
    
    function PartitionCapacity() {
        const partitionName = dirStack.current[1][0]

        const driveusage = usage.current
        console.log("usage", driveusage)
      
        console.log("parition ise", currentFolderSize)
        const googleUsed = parseInt(currentFolderSize[0][1])
        const dropboxUsed = parseInt(currentFolderSize[1][1])
        const googleAlloc = parseInt(currentFolderSize[0][0])
        const dropboxAlloc = parseInt(currentFolderSize[1][0])

        const totalAlloc = googleAlloc+dropboxAlloc

        const googleWidth = (Math.floor((100*(googleUsed||1)/googleAlloc||100))||1)+"%"
        const dropboxWidth =( Math.floor(( 100*(dropboxUsed||1)/googleAlloc||100)) || 1)+"%"
        const mergeGoogleWidth = (Math.floor((100*(googleUsed||1)/totalAlloc||100))||1)+"%"
        const mergeDropboxWidth = (Math.floor((100*(dropboxUsed||1)/totalAlloc||100))||1)+"%"
        
        const totalAllocMerge = dropboxAlloc+googleAlloc
        console.log("alloc", totalAllocMerge)
        const totalUsedMerge = googleUsed+dropboxUsed


        console.log("ggl", googleWidth)
        return (
            <React.Fragment>
            <div id="capacity-Merged">
                <span>Merged Drive: total used {convertUnits(totalUsedMerge)} of availible {convertUnits(totalAllocMerge)}</span>
                <div style={{width:"100%"}} class="progress" id="allocationBar">
                    <div class="progress-bar" id="allocaltionBar-Google" role="progressbar" style={{width:mergeGoogleWidth, backgroundColor:"yellow"}} aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div>
                    <div class="progress-bar" id="allocationBar-Dropbox" role="progressbar" style={{width:mergeDropboxWidth, backgroundColor:"blue"}} aria-valuenow="30" aria-valuemin="0" aria-valuemax="100"></div>               
                </div>
            </div>
            
            <div id="cacpity-individual" style={{overflow:"hidden"}}>
            <span>Google Usage: {convertUnits(googleUsed)} of availible {convertUnits(googleAlloc)} </span>
                <div style={{width:"100%"}} class="progress" id="allocationBar">
                    <div class="progress-bar" id="allocaltionBar-Google" role="progressbar" style={{width:googleWidth, backgroundColor:"yellow"}} aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
            <span>Dropbox Usage: {convertUnits(dropboxUsed)} of availible {convertUnits(dropboxAlloc)} </span>
                <div style={{width:"100%"}} class="progress" id="allocationBar">                
                    <div class="progress-bar" id="allocationBar-Dropbox" role="progressbar" style={{width:dropboxWidth, backgroundColor:"blue"}} aria-valuenow="30" aria-valuemin="0" aria-valuemax="100"></div>               
                </div>            
            </div>
            </React.Fragment>
        )
    }



}

function growCapBox() {    

    document.getElementById("capBox").classList.toggle("expand")    
    
   
}



export default DriveCapacity