require("dotenv").config();

const partitionDB = require("node-localdb")("./partitions.json");
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { handleRequest } = require("./requestHandler");

function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    title: "cloudLinker",
    frame: true,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  win.loadURL("http://localhost:3000/");

  // hide electron toolbar menu (file, options etc.)
  //win.setMenu(null)
}

function openDialogue() {
  const win2 = new BrowserWindow({ width: 800, height: 600 });
  const options = {
    properties: ["openFile", "multiSelections"],
    title: "selectFile",
  };

  dialog.showOpenDialog({ properties: ["openFile", "multiSelections"] });

  let filePaths = dialog.showOpenDialog(win2, options);
  filePaths.then((p) => console.log("Paths", p));
  console.log("paths", filePaths);
}

/**
 * Initialize the application
 */
const init = () => {
  /** Create app window */
  createWindow();
  //openDialogue()

  /**
   * Add an IPC event listener for the channel
   */
  ipcMain.on("FileBrowser-Render-Request", async (e, messageContent) => {
    const response = await handleRequest(messageContent);

    return e.reply("FileBrowser-Render-Response", JSON.stringify(response));
  });

  ipcMain.on("shutdown", async (e, messageContent) => {
    app.exit();
  });
};

/**
 * Run the app
 */
app.on("ready", init);
