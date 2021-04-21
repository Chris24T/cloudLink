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
    "createFolder-request": controller.createFolder,
    "getUsage-request": controller.getSpaceUsage,
  };

  const { data, params } = request[0].requestBody,
    reqType = request[0].requestType;

  const response = requestOptions[reqType](params, data);
  //response.then((val) => console.log("generated", val));
  return response;
}

exports.handleRequest = handleRequest;
