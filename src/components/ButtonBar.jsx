import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.css';


function ButtonBar(props) {

    return (
        <React.Fragment>
        <div className="btnbar" /*style={{textAlign:"center", height:"15px"}}*/   >
            
            <div class="btnbarElem">
                <svg style={{position:"absolute"}} /*display="inline-block" height="20px"*/ viewBox="0 0 16 16" className="bi bi-three-dots" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
                </svg>
            </div>

            <div class="btnbarElem">
                <svg onClick={props.funcDownload} /*margin="auto" display="inline-block" height="20px" width="20px"*/ viewBox="0 0 16 16" className="bi bi-cloud-arrow-down-fill" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M8 2a5.53 5.53 0 0 0-3.594 1.342c-.766.66-1.321 1.52-1.464 2.383C1.266 6.095 0 7.555 0 9.318 0 11.366 1.708 13 3.781 13h8.906C14.502 13 16 11.57 16 9.773c0-1.636-1.242-2.969-2.834-3.194C12.923 3.999 10.69 2 8 2zm2.354 6.854l-2 2a.5.5 0 0 1-.708 0l-2-2a.5.5 0 1 1 .708-.708L7.5 9.293V5.5a.5.5 0 0 1 1 0v3.793l1.146-1.147a.5.5 0 0 1 .708.708z"/>
                </svg>
            </div>

            <div class="btnbarElem">
                <svg onClick={props.funcDelete} /*style={{right:"20px", position:"absolute"}}left="30px" height="20px" width="20px"*/ viewBox="0 0 16 16" className="bi bi-x-circle" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                    <path fillRule="evenodd" d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                </svg>
            </div>

            

            
          

        
            

            
        
        </div>


         

  
        </React.Fragment>



    )
}



export default ButtonBar