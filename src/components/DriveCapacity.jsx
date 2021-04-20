import React, { useEffect, useState, useContext } from 'react';
import {browserContentContext } from "../Contexts/browserContentContext"

function DriveCapacity(props) {
    const {dirStack, allFiles:fileTree, currentFolderSize  } = useContext(browserContentContext)
    // useEffect()
    // useState()

    return (

        <div id="capBox" className="expand" >
            <button id="capBoxGrow" onClick={growCapBox}style={{transition:"0.5s", position:"absolute", left:"50%", transform:"translate(-50%, -50%)"}}>minmize</button>
            <span>{currentFolderSize}</span>
            <div id="capacityBar" style={{backgroundColor:"#f2f2f2", height:"75px"}}></div>
            <div id="capcityDrives" style={{overflow:"hidden"}}>Drive Capacity Bars</div>
        </div>

    )


}

function growCapBox() {    

    document.getElementById("capBox").classList.toggle("expand")    
    
   
}

export default DriveCapacity