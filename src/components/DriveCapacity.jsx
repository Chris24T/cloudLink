import React, { useEffect, useState, useContext } from 'react';
import {browserContentContext } from "../Contexts/browserContentContext"

function DriveCapacity(props) {
    const {dirStack, allFiles:fileTree, currentFolderSize, usageStatistics:globalUsage, convertUnits  } = useContext(browserContentContext)
    // useEffect()
    // useState()
    let len = Object.keys(globalUsage.current).length
    useEffect( () => {
        // console.log(globalUsage.current)
       // console.log("render")
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
        const driveusage = globalUsage.current
        //console.log("globalUsage", driveusage)
        const googleWidth = (Math.floor((100*(driveusage?.google?.used||1)/driveusage?.google?.allocated||100))||1)+"%"
        const dropboxWidth =( Math.floor(( 100*(driveusage?.dropbox?.used||1)/driveusage?.dropbox?.allocated||100)) || 1)+"%"

        const googleUsed =( driveusage?.google?.used||1)
        const dropboxUsed = (driveusage?.dropbox?.used)
        const googleAlloc = (driveusage?.google?.allocated||100)
        const dropboxAlloc = (driveusage?.dropbox?.allocated||100)

        
        const totalAllocMerge = dropboxAlloc+googleAlloc
        
        const totalUsedMerge = googleUsed+dropboxUsed


        //console.log("ggl", googleWidth)
        return (
            <React.Fragment>
            <div id="capacity-Merged">
                <span>Total Space Use {convertUnits(totalUsedMerge)} of availible {convertUnits(totalAllocMerge)}</span>
                <div style={{width:"100%", borderStyle:"solid", borderWidth:"2px"}} class="progress" id="allocationBar">
                    <div class="progress-bar" id="allocaltionBar-Google" role="progressbar" style={{width:googleWidth, backgroundColor:"yellow", borderRight:"1px solid black"}} aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div>
                    <div class="progress-bar" id="allocationBar-Dropbox" role="progressbar" style={{width:dropboxWidth, backgroundColor:"blue", borderRight:"1px solid black"}} aria-valuenow="30" aria-valuemin="0" aria-valuemax="100"></div>               
                </div>
            </div>
            
            <div id="cacpity-individual" style={{overflow:"hidden"}}>
            <span>Google Total Usage: {convertUnits(googleUsed)} of availible {convertUnits(googleAlloc)} </span>
                <div style={{width:"100%", borderStyle:"solid", borderWidth:"2px"}} class="progress" id="allocationBar">
                    <div class="progress-bar" id="allocaltionBar-Google" role="progressbar" style={{width:googleWidth, backgroundColor:"yellow", borderRight:"1px solid black"}} aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
            <span>Dropbox Total Usage: {convertUnits(dropboxUsed)} of availible {convertUnits(dropboxAlloc)} </span>
                <div style={{width:"100%", borderStyle:"solid", borderWidth:"2px"}} class="progress" id="allocationBar">                
                    <div class="progress-bar" id="allocationBar-Dropbox" role="progressbar" style={{width:dropboxWidth, backgroundColor:"blue", borderRight:"1px solid black"}} aria-valuenow="30" aria-valuemin="0" aria-valuemax="100"></div>               
                </div>            
            </div>
            </React.Fragment>
        )
          
        
    }
    
    function PartitionCapacity() {
        const partitionName = dirStack.current[1][0]
        const driveusage = globalUsage.current
       
        let googleUsed = parseInt(currentFolderSize[0][1])
        let dropboxUsed = parseInt(currentFolderSize[1][1])
        const googleAlloc = parseInt(currentFolderSize[0][0])
        const dropboxAlloc = parseInt(currentFolderSize[1][0])

        if(googleUsed < 0) googleUsed = 0
        if(dropboxUsed < 0) dropboxUsed = 0

        const totalAlloc = googleAlloc+dropboxAlloc

        const googleWidth = (Math.floor((100*(googleUsed||1)/googleAlloc||100))||1)+"%"
        const dropboxWidth =( Math.floor(( 100*(dropboxUsed||1)/googleAlloc||100)) || 1)+"%"
        const mergeGoogleWidth = (Math.floor((100*(googleUsed||1)/totalAlloc||100))||1)+"%"
        const mergeDropboxWidth = (Math.floor((100*(dropboxUsed||1)/totalAlloc||100))||1)+"%"
        
        const totalAllocMerge = dropboxAlloc+googleAlloc
        
        const totalUsedMerge = googleUsed+dropboxUsed


        
        return (
            <React.Fragment>
            <div id="capacity-Merged">
                <span>Total Partition Space Use: {convertUnits(totalUsedMerge)} of Reserved {convertUnits(totalAllocMerge)}</span>
                <div style={{width:"100%", borderStyle:"solid", borderWidth:"2px"}} class="progress" id="allocationBar">
                    {googleAlloc < 1 ? "" : <div class="progress-bar" id="allocaltionBar-Google" role="progressbar" style={{width:mergeGoogleWidth, backgroundColor:"yellow", borderRight:"1px solid black"}} aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div> }
                    {dropboxAlloc < 1 ? "" : <div class="progress-bar" id="allocationBar-Dropbox" role="progressbar" style={{width:mergeDropboxWidth, backgroundColor:"blue", borderRight:"1px solid black"}} aria-valuenow="30" aria-valuemin="0" aria-valuemax="100"></div>   }            
                </div>
            </div>
            
            <div id="capacity-individual" style={{overflow:"hidden"}}>
                {googleAlloc < 1 ? "" : <div><span>Google Allocation Usage: {convertUnits(googleUsed)} of Reserved {convertUnits(googleAlloc)} </span>
                <div style={{width:"100%", borderStyle:"solid", borderWidth:"2px"}} class="progress" id="allocationBar">
                    <div class="progress-bar" id="allocaltionBar-Google" role="progressbar" style={{width:googleWidth, backgroundColor:"yellow", borderRight:"1px solid black"}} aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div>
                </div> </div>}

                {dropboxAlloc < 1 ? "" : <div> <span>Dropbox Allocation Usage: {convertUnits(dropboxUsed)} of Reserved {convertUnits(dropboxAlloc)} </span>
                <div style={{width:"100%", borderStyle:"solid", borderWidth:"2px"}} class="progress" id="allocationBar">                
                    <div class="progress-bar" id="allocationBar-Dropbox" role="progressbar" style={{width:dropboxWidth, backgroundColor:"blue", borderRight:"1px solid black"}} aria-valuenow="30" aria-valuemin="0" aria-valuemax="100"></div>               
                </div>  </div>}
            
                      
            </div>
            </React.Fragment>
        )
    }



}



function growCapBox() {    

    document.getElementById("capBox").classList.toggle("expand")    
    
   
}



export default DriveCapacity