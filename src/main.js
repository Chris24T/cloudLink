require("dotenv").config();

const partitionDB = require("node-localdb")("./partitions.json");
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { handleRequest } = require("./requestHandler");
const { eventChannel } = require("./helpers.js");

function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 820,
    minHeight: 500,
    title: "cloudLinker",
    frame: true,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  win.loadURL("http://localhost:3000/");

  eventChannel.on(
    "tracked_File_Mismatch",
    (fileInfo, partitionInfo, targetInfo) => {
      console.log("Main Detected");
      win.webContents.send("simulate-drop", [
        fileInfo,
        partitionInfo,
        targetInfo,
      ]);
    }
  );
  // hide electron toolbar menu (file, options etc.)
  //win.setMenu(null)
}

/**
 * Initialize the application
 */
const init = () => {
  /** Create app window */
  createWindow();
  //openDialogue()

  /**
   * Add an IPC event listeners for the channel
   */
  ipcMain.on("FileBrowser-Render-Request", async (e, messageContent) => {
    const response = await handleRequest(messageContent);

    return e.reply("FileBrowser-Render-Response", JSON.stringify(response));
  });

  ipcMain.on("FileBrowser-Usage-Request", async (e, messageContent) => {
    const response = await handleRequest(messageContent);

    return e.reply("FileBrowser-Usage-Response", JSON.stringify(response));
  });

  ipcMain.on("FileBrowser-Download-Request", async (e, messageContent) => {
    const response = await handleRequest(messageContent);

    return e.reply("FileBrowser-Download-Response", JSON.stringify(response));
  });

  ipcMain.on("FileBrowser-Delete-Request", async (e, messageContent) => {
    const response = await handleRequest(messageContent);

    return e.reply("FileBrowser-Delete-Response", JSON.stringify(response));
  });

  ipcMain.on("shutdown", async (e, messageContent) => {
    app.exit();
  });
};

/**
 * Run the app
 */
app.on("ready", init);
