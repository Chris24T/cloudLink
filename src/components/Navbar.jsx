import React, { useEffect, useState } from 'react';
import {
    BrowserRouter as Router,
    Switch,
    Route,
    Link,
    useLocation,
    useRouteMatch,
    useParams
  } from "react-router-dom";
import DriveCapacity from "./DriveCapacity"

function Navbar () {

    return (
        

            <div id="Navbar" style={{ position:"fixed", minWidth:"250px", maxWidth:"250px", backgroundColor:"#2D3436", bottom:"0px", top:"0px", paddingTop:"60px"}}>
                <nav>
                <Link to="/" onClick={ () => console.log("click")} className="navbtn">Home</Link>
                <Link to="/trash" className="navbtn">Deleted Files</Link>
                <Link to="/settings" className="navbtn">Settings</Link>
                <Link to="/drives" className="navbtn">Drives</Link>

                <DriveCapacity></DriveCapacity>
                </nav>
            </div>

        
    )
}

export default Navbar;
