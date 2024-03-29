import React, { useEffect, useRef, useState, useContext } from "react";

import "bootstrap/dist/css/bootstrap.css";
import FilesBrowser from "./components/FilesBrowser";
import NavBar from "./components/Navbar";
import SideBar from "./components/Sidebar";
import { browserContentContext } from "./Contexts/browserContentContext";

import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link,
  useLocation,
  useRouteMatch,
  useParams,
} from "react-router-dom";
const { ipcRenderer, remote } = window.require("electron");

function App() {
  const dirStack = useRef([["home", "root"]]);
  const allFiles = useRef({});
  const [displayFiles, setDisplayFiles] = useState({});
  const [currentFolderSize, setCurrentFolderSize] = useState([]);
  const usageStatistics = useRef({});
  const partitionUsage = useRef([]);
  const onGoingDownloads = useRef([]);
  const onGoingUploads = useRef([]);

  const globalUsage = useRef({});
  const currentPartitionUsage = useRef({});
  useEffect(() => {
    return () => {};
  }, []);

  function shutdown() {
    //send message to backend to close window
    ipcRenderer.send("shutdown");
  }

  function refreshContent() {
    const message = {
      requestType: "metadata-request",
      requestBody: { params: {}, data: {} },
    };
    const FILTERS = {};

    ipcRenderer.send("FileBrowser-Render-Request", [message, FILTERS]);
  }

  function convertUnits(valueInBytes) {
    let usedUnit = "B";

    if (valueInBytes > 1000) {
      valueInBytes = valueInBytes / 1024;
      usedUnit = "KB";
    }
    if (valueInBytes > 1000) {
      valueInBytes = valueInBytes / 1024;
      usedUnit = "MB";
    }
    if (valueInBytes > 1000) {
      valueInBytes = valueInBytes / 1024;
      usedUnit = "GB";
    }
    valueInBytes = round(valueInBytes, usedUnit);

    return (valueInBytes += usedUnit);

    function round(value, unit) {
      if (unit === "B") return value;
      return value.toFixed(2);
    }
  }

  return (
    <div>
      <browserContentContext.Provider
        value={{
          dirStack,
          allFiles,
          displayFiles,
          setDisplayFiles,
          currentFolderSize,
          setCurrentFolderSize,
          globalUsage,
          usageStatistics,
          convertUnits,
          currentPartitionUsage,
          partitionUsage,
          onGoingDownloads,
          onGoingUploads,
        }}
      >
        <Router>
          <NavBar />

          <FilesBrowser />

          <SideBar actions={{ shutdown, refreshContent }} />
        </Router>
      </browserContentContext.Provider>
    </div>
  );
}

export default React.memo(App);
