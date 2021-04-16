import React from "react"

function Folder(props) {

    return(

        <div onClick={() => props.onClick(props.id)} class="folder">            
            <span>{props.name}</span>
        </div>

    )

}

export default Folder