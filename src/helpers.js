const crypto = require("crypto");
const emitter = require("events").EventEmitter;
const fs = require("fs");

const em = new emitter();

module.exports = {
  computeChecksum(path) {
    return genContentHash(fs.createReadStream(path));
  },
  eventChannel: em,
};

function genContentHash(rs, type) {
  return new Promise((resolve, reject) => {
    let hash;

    switch (type) {
      case "md5":
        hash = crypto.createHash("md5");
        break;
      case "sha256":
        hash = crypto.createHash("sha256");
        break;
      default:
        hash = crypto.createHash("md5");
    }

    rs.on("error", (err) => reject(err));
    rs.on("data", (chunk) => hash.update(chunk));
    rs.on("end", () => resolve(hash.digest("hex")));
  });
}
