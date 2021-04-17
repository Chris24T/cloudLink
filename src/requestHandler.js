const controller = require("./raidController.js");

/**
 * @param request request body *
 */
function handleRequest(request) {
  const requestOptions = {
    "metadata-request": controller.listFiles,
    "fileDownload-request": controller.downloadFiles,
    "deleteFile-request": controller.deleteFiles,
    "fileUpload-request": controller.uploadFiles,
  };

  const { data, params } = request[0].requestBody,
    reqType = request[0].requestType;
  console.log("recieved", data);
  const response = requestOptions[reqType](params, data);

  return response;
}

exports.handleRequest = handleRequest;
