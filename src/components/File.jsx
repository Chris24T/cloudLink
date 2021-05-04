import React, { useState } from 'react';
import Card from 'react-bootstrap/Card'
import ButtonBar from "./ButtonBar"


function File(props) {
    let fileId = props.id
    return(

        <Card 
            className="mb-2 File"
            style={{ float:"left", minWidth: "150px", maxWidth:"150px", height: "200px", margin:"5px",  fontSize:"12px", position:"relative"}}
            bg="light" 
            >

            <Card.Header style={{height:"50px", resize:"none"}}>{props.id}</Card.Header>

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
                    funcDownload={() => props.downloadFile(fileId)} 
                    funcDelete={() => props.deleteFile(fileId)}
                    style={{
                    position:"relative",
                    width:"150px",
                    }}>
                </ButtonBar >
            </Card.Footer>
        </Card>

    )
        
   

    

}



export default File