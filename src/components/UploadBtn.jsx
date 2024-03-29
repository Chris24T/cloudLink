import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.css';
import { PersonPlus } from 'react-bootstrap-icons';

function UploadBtn (props) {

    return (
        <div id="upload-btn" /*onClick={props.toggleDisplay}*/ style={{position:"absolute", right:"30px", bottom:"30px"}}>

            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-upload" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
            <path fill-rule="evenodd" d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
            </svg>
            <label for="select-file" id="upload-label">{"Upload File"}</label>
            <form>
                <input type="file" id="file-upload" multiple onChange={() => {

                    const files=document.getElementById("file-upload").files;
                    props.uploadFiles(files) }}
                >
                </input>                
            </form>
        </div>
    )
}

export default UploadBtn