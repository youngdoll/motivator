var http = require("http");
var fs = require("fs");
var path = require("path");
var root = __dirname;
var mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".mp4": "video/mp4", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
http.createServer(function (req, res) {
  var f = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  var p = path.join(root, f);
  fs.readFile(p, function (err, data) {
    if (err) { res.writeHead(404); res.end("404"); return; }
    var ext = path.extname(f);
    res.writeHead(200, { "Content-Type": mime[ext] || "text/plain", "Cache-Control": "no-cache" });
    res.end(data);
  });
}).listen(3000, function () { console.log("http://localhost:3000"); });
