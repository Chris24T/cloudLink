import React, { useEffect, useRef, useState } from 'react';

//import './App.css';
import 'bootstrap/dist/css/bootstrap.css';
import FilesBrowser from "./components/FilesBrowser"
import NavBar from "./components/Navbar"
import SideBar from "./components/Sidebar"
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link,
  useLocation,
  useRouteMatch,
  useParams
} from "react-router-dom";

const { ipcRenderer, remote } = window.require('electron');

function App() {  

  useEffect(() => {
    
    return () => {
      
    }
  }, [])

  return (
    
    <div>
         <Router>
          <NavBar/>
          <FilesBrowser/>  
         </Router>
          
        <SideBar/>
    </div>
        
  );
   
}


export default React.memo(App);
