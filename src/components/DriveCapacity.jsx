import React, { useEffect, useState } from 'react';


function DriveCapacity(props) {

    // useEffect()
    // useState()

    return (

        <div id="capBox" className="expand" >
            <button id="capBoxGrow" onClick={growCapBox}style={{transition:"0.5s", position:"absolute", left:"50%", transform:"translate(-50%, -50%)"}}>minmize</button>
            
            <div id="capacityBar" style={{backgroundColor:"#f2f2f2", height:"75px"}}></div>
            <div id="capcityDrives" style={{overflow:"hidden"}}>Drive Capacity Bars</div>
        </div>

    )


}

function growCapBox() {    

    document.getElementById("capBox").classList.toggle("expand")    
    
   
}

export default DriveCapacity