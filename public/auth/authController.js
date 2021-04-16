
const clients = {
    dropbox:require("./dropboxAuth.js").dropbox_client,
    google: require("./googleAuth.js").google_client
}

/**
     * 
     * @param {function} cb gives access to: vendor ID, and vendor client  
     * @param {array} drives array of drives being called. By key e.g. "google", "dropbox" - default = all
*/
const callClients = (cb, recipients=Object.keys(clients)) => {
    recipients.forEach( clientId => {
        cb( clientId, clients[clientId] )
    })   
} 



exports.callClients = callClients