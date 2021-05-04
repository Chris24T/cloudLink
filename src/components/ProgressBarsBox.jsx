import React, {useContext, useEffect} from "react"
import {ProgressBarItem} from "./ProgressBarItem";
import {browserContentContext } from "../Contexts/browserContentContext"



export function ProgressBarsBox(props) {
    
    const { onGoingDownloads, onGoingUploads} = useContext(browserContentContext)
    
    const downloads = onGoingDownloads.current
    const uploads = onGoingUploads.current

    useEffect(() => {
        
        return () => {
            
        }
    }, [Object.keys(onGoingUploads).length, Object.keys(onGoingDownloads).length])

  

    return(
        <div id="progressBox">
            <div id="progress_uploads">
                {Object.entries(uploads).map( file => {
                    
                  return (<ProgressBarItem info={file}/>)
                })}
            </div>

            <div id="progress_downloads">

            </div>
        

        </div>
    )


}

function hideElement(ID) {
    let e = document.getElementById(ID)
    e.style.display = "none"
 }

 function showElement(ID) {
    let e = document.getElementById(ID)
    e.style.display = "block"
 }

function toggleHideElement(ID) {
    let e = document.getElementById(ID)
    if(e.style.display === "none") {
        e.style.display = "block"
    } else {
        e.style.display = "none"
    }
 }

 