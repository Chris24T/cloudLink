import React from 'react';
import ReactDOM from 'react-dom';
import App from "./App"
import './index.css';
import reportWebVitals from './reportWebVitals';

const { ipcRenderer, remote } = window.require('electron');

/** Define channel name and message */
const CHANNEL_NAME = 'main';
const MESSAGE = 'ping';
 
/**
 * SYNCHRONOUS
 */  
//console.log("return: "+ipcRenderer.sendSync(CHANNEL_NAME, MESSAGE)); // send request and show response 

/**
 * ASYNCHRONOUS
 */  
//ipcRenderer.send(CHANNEL_NAME, "getContext"); // send request
//ipcRenderer.on(CHANNEL_NAME, (event, data) => { // IPC event listener
//  console.log(data+"front"); // show the response data
//});

ReactDOM.render(
  <React.StrictMode>
    <App/>
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
