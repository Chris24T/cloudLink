const { createReadStream } = require("fs");
const crypto = require("crypto");

const FILEPATH =
  "/home/chris/Desktop/test/OuterFolder/InnerFolder/testFile.jpg";

//inclusive
const y = createReadStream(FILEPATH, { start: 0, end: 5325 });
const x = createReadStream(FILEPATH, { start: 0, end: 5326 });
const z = createReadStream(FILEPATH, { start: 0, end: 5327 });

const a = createReadStream(FILEPATH, { start: 0, end: 5328 });

//exclusive end
const b = createReadStream(FILEPATH, { start: 0, end: 5329 });

const c = createReadStream(FILEPATH, { start: 0, end: 10000 });

function genContentHash(rs) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("md5");

    rs.on("error", (err) => reject(err));
    rs.on("data", (chunk) => hash.update(chunk));
    rs.on("end", () => resolve(hash.digest("hex")));
  });
}

const print = async () => {
  console.log("y", await genContentHash(y));

  console.log("x", await genContentHash(x));

  console.log("z", await genContentHash(z));

  console.log("a", await genContentHash(a));

  console.log("b", await genContentHash(b));

  console.log("c", await genContentHash(c));
};

print();
