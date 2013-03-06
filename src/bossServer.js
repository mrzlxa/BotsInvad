var http = require('http');
var path = require("path");
var express = require('express');
var app = express();
var forever = require('forever-monitor');

var child = new (forever.Monitor)("/home/frostik/bubble/js/server.js", {
  max: 100500,
  silent: true,
  options: []
});

var started = false;

child.on('exit', function () {
  console.log('bubble server.js has exited after 100500 restarts');
});

app.post("/start", function(req, res){
	console.log("Start request");
	started = true;
	child.start();
	res.json({success: true});
});

app.post("/restart", function(req, res){
	console.log("Restart request");
	child.restart();
	res.json({success: true});
});

app.post("/stop", function(req, res){
	console.log("Stop request");
	started = false;
	child.stop();
	res.json({success: true});
});


var server = http.createServer(app);
server.listen(7777);