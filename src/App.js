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

  return (
    <div>
      <browserContentContext.Provider
        value={{
          dirStack,
          allFiles,
          displayFiles,
          setDisplayFiles,
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
