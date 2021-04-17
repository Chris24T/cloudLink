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

function App() {
  useEffect(() => {
    return () => {};
  }, []);

  return (
    <div>
      <browserContentContext.Provider value={{}}>
        <Router>
          <NavBar />
          <FilesBrowser />
        </Router>

        <SideBar />
      </browserContentContext.Provider>
    </div>
  );
}

export default React.memo(App);
