const raidController = require("./raidController.js")


const {app, BrowserWindow, ipcMain} = require('electron')


const Blob = require("cross-blob");
const { fstat } = require("fs");


  
function createWindow () {   
    // Create the browser window.     
    const win = new BrowserWindow({
        width: 800, 
        height: 600,
        title: "cloudLinker",
        frame:true,
        webPreferences: {
            nodeIntegration: true
        }
    }) 
    
    // hide electron toolbar menu (file, options etc.)
    //win.setMenu(null)

    // and load the index.html of the app.     
    win.loadURL('http://localhost:3000/')
}

/**
 * Initialize the application
 */
const init = () => {
    
    
    let controller = new raidController()
    

    /** Create app window */
    createWindow();
    
        
    /**
     * Add an IPC event listener for the channel
     */ 
    ipcMain.on( "FileBrowser-Render-Request", (e, messagecontent) => {
        let 
        reqBody = messagecontent[0].requestBody,
        reqType = messagecontent[0].requestType,
        respDataP //Response data promise        
        
        switch(reqType) {
            case "metadata-request":        respDataP = controller.listFiles() //refresh request
                break;
            case "fileDownload-request":    controller.downloadFiles(reqBody.data)                                        
                break;
            case "deleteFile-request":      controller.deleteFile(reqBody.fileId)
                break;
            case "fileUpload-request":      controller.uploadFiles(reqBody.fileList)
                break;
            default:                        return "error"
                
        }
        
        //Tell front end the result of operation (success/failure) - not neccessary due to polling, 
        console.log("Response:",respDataP)
        if(reqType === "fileDownload-request") {
            console.log("Download Response Completed")
            respDataP = undefined }
        if(reqType === "metadata-request") console.log("listFiles Response Completed")
        if (respDataP) {
            respDataP.then( (val) => {            
            
            // not currently telling front end if download is successfull i.e. no response

            const response = {
                type:reqType.replace("request", "response"),
                content: val
            }
            //console.log("responsedata: ", val)
                                                                //ISSUE: cant seem to send the response back again - failed to serialize, 
            e.reply("FileBrowser-Render-Response", [response])  //if is file download request, just want to call api and save file, 
                                                                //in future will send an array of promises - each 4MB chunk, as they resolve, add to progress bar
        }).catch((err) => console.error(err))}
        respDataP = undefined
    })    
  };
  
  /**
   * Run the app
   */
  app.on('ready', init);

  