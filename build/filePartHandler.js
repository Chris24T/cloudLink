const splitFile = require('split-file');

function filePartHandler() {

    function split(dir, s=4194304) {                   //4mB default partitiion
        return splitFile.splitFileBySize(__dirname + dir, s)
    }

    async function merge(chunkarr) {
        try {
        await chunkarr
        } catch(e) {
            console.log("parts could not be resolved")
        }
        let mergeFile = splitFile.mergeFiles(chunkarr, __dirname+"/output/merge.jpg")
        return mergeFile
    }

    filePartHandler.split = split;
    filePartHandler.merge = merge;
}