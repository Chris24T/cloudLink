import { PersonPlus } from "react-bootstrap-icons"

function UploadWindow(props) {

return (
    <div 
        style={{
            position:"absolute", 
            height:"100%", 
            width:"100%", 
            backgroundColor:"gray", 
            opacity:"50%"
        }}
        onClick={props.toggleDisplay}
    >
        
        <input type="file"/>

    </div>    
)

}

export default UploadWindow