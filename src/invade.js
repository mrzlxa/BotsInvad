var http = require('http');
var path = require("path");
var express = require('express');
var app = express();
var Cookie = require(path.join(__dirname, '../modules/cookie'));
var CookieJar = require(path.join(__dirname, '../modules/cookie/jar'));
var request = require("request");
// var request = require("request");
var url = "ec2-23-20-152-59.compute-1.amazonaws.com"
var data = JSON.stringify({
	'important' : 'data'
});
var EXCEPTION = false;

var cookie = 'something=anything'

var BOSS_ENABLED = true;

var bots = [];

var USERS_COUNT = 500; 
var BOTS_COUNT = 70;

var authDelays = [];
var reqDelays = [];
var ssDelays = [];

var testResults = [];
var curTestName = "theTest";
var progress = 0;
var progressMax = 5;
/*
 * result = { name: "" resDelays: [] }
 * 
 */

app.set("port", 12121);
app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'ejs');
app.use(express.bodyParser());

app.use("/startTest", function(req, res) {
//	globalTest(50, function() {
//		res.render("wait");
//	});
	res.render("wait");
	process.nextTick(function(){
		globalSwitch(1000, function(){

		});
	});


});

app.post("/progress", function(req, res) {
	// console.log("progress req: ", progress);
	if(EXCEPTION){
		res.redirect("/results");
	}
	res.json({
		testName : curTestName,
		progress : progress,
		max : progressMax
	});
	// progress++;
});

app.use("/results", function(req, res) {
	var names = [];
	for ( var i = 0; i < testResults.length; i++) {
		names.push(testResults[i].name);
	}
	res.render("results", {
		result : testResults
	});
});

app.use("/", function(req, res) {
	res.render("index");
});

function Bot(userId) {
	this.userId = userId;
	this.jars = [];
};

Bot.prototype.addCookie = function(cookie) {
	if (!cookie) {
		console.log("FALSE:", this.userId);
		return;
	}
	var jar = request.jar();
	jar.add(new Cookie(cookie));
	// console.log("jar created: ", jar);
	this.cookie = jar;
	// console.log("this.cookie=jar=", this.cookie);

};

Bot.prototype.initRequest = function(callback) {
	var options = {
		method : 'GET',
		uri : 'http://' + url + "/?viewer_id=" + this.userId + "&isSafari=false",
		followRedirect : false,
		jar : false
	}
	var that = this;
//	console.log("this.userId", this.userId);
	var addCookie = function(c) {
		that.addCookie(c);
	}
	var entryTime = Date.now();
	request(options, function(error, response, body) {
		var dt = Date.now() - entryTime;
		// console.log(that.userId+"====="+response.headers['set-cookie']);
		if (Array.isArray(response.headers['set-cookie']))
			response.headers['set-cookie'].forEach(addCookie)
		else
			that.addCookie(response.headers['set-cookie'])
			// console.log("Cookies created: ", that.cookie);

		if (callback) {
			process.nextTick(function(){
				callback(dt);
			});
		}
	});
};

Bot.prototype.authRequest = function(callback) {
	var options = {
		method : "POST",
		uri : "http://" + url + "/auth",
		jar : this.cookie
	}
	var entryTime = Date.now();
	request(options, function(error, response, body) {
		var dt = Date.now() - entryTime;
		try{
			var obj = JSON.parse(body);
		}catch(e){
			console.log("error reading body: ", body);
		}
		
		if (callback) {
			process.nextTick(function(){
				callback(dt, obj);
			});
		}
		
	});
};

Bot.prototype.sendCommand = function(command, args, callback) {
	var that = this;
	var obj = {
		command : command,
		args : args
	};
	var options = {
		method : 'POST',
		uri : 'http://' + url + "/command",
		jar : this.cookie,
		json : obj
	}
	var entryTime = Date.now();
	request(options, function(error, response, body) {
		var dt = Date.now() - entryTime;
//		process.nextTick(function(){
		if (callback) {
			callback(dt, body)
		}
//		});
	});
};

Bot.prototype.switchState = function(curState, newState, callback) {
	var that = this;
	that.sendCommand("switchState", [ curState, newState ], function(dt, body) {
		console.log("Switch State execution(" + curState + "=>" + newState + ") time: ", dt);
		if (callback) {
			process.nextTick(function(){
				callback(dt, body);
			});
		
		}
	});
};

Bot.prototype.runSwitchState = function(index, supercb) {
	this.switchState(this.mapStateId, this.gameStateId, function(dt, body) {
		// that.switchState(that.gameStateId, that.mapStateId, function(dt,
		// body){
		ssDelays.push(dt);
		if (index == BOTS_COUNT - 1) {
			supercb();
		}
		// });
	});
};




Bot.prototype.runTest = function(index, supercb) {
	var that = this;
	that.initRequest(function(initReqTime) {
		progress++;
		console.log("[" + that.userId + "]init request time: ", initReqTime);
		reqDelays.push(initReqTime);
		setTimeout(function() {
			that.authRequest(function(authTime, authUpdate) {
				progress++;
				authDelays.push(authTime);
				console.log("[" + that.userId + "]Authorization time: ", authTime);
				// console.log("AuthUpdate: ", authUpdate );
				that.accountId = authUpdate.accountId;
				that.initialState = authUpdate.initUpdate[that.accountId].initialState;
				for ( var id in authUpdate.initUpdate) {
					if (authUpdate.initUpdate[id].class == "MapState") {
						that.mapStateId = id;
						that.gameStateId = authUpdate.initUpdate[id].gamestate;
					}
				}
				if (index == BOTS_COUNT - 1) {
					var sumAuth = 0, sumReq = 0;

					// for(var i = 0;i<reqDelays;i++){
					// sumAuth += authDelays[i];
					// sumReq += reqDelays[i];
					// }

					reqDelays.forEach(function(value) {
						sumReq = sumReq + value;
					});
					authDelays.forEach(function(value) {
						sumAuth = sumAuth + value;
					});

					console.log("sumdelays: ", sumAuth, ";", sumReq);
					var avAuth = sumAuth / authDelays.length;
					var avReq = sumReq / reqDelays.length;

					supercb(avReq, avAuth);
				}
			});
		}, 1000);

	});
};

function timeoutForEach(timeout, arr, func) {
	var i = 0;
	function nextTimeout(counter) {
		if (counter < arr.length) {
			setTimeout(function() {
				process.nextTick(function(){
					func(counter, arr[counter]);
					counter++;
					nextTimeout(counter);
				});
			}, timeout);
		}
	}

	nextTimeout(i);
};


function authorizeBots(count, cb){
	bots = [];
	
	for ( var i = 0; i < count; i++) {
		bots.push(new Bot(i));
	};


	function chainAuth(index, bot) {
		process.nextTick(function() {
			setTimeout(function() {
				if (index == count) {
					if (cb) {
						cb();
					}
					return;
				};
				bot.initRequest(function(initReqTime) {
					setTimeout(function(){
						console.log("[" + bot.userId + "]init request time: ", initReqTime);
						reqDelays.push(initReqTime);
						bot.authRequest(function(authTime, authUpdate) {
							progress++;
							console.log("[" + bot.userId + "]auth request time: ", authTime);
							bot.accountId = authUpdate.accountId;
							bot.initialState = authUpdate.initUpdate[bot.accountId].initialState;
							for ( var id in authUpdate.initUpdate) {
								if (authUpdate.initUpdate[id].class == "MapState") {
									bot.mapStateId = id;
									bot.gameStateId = authUpdate.initUpdate[id].gamestate;
								}
							}
							process.nextTick(function() {
								chainAuth(index + 1, bots[index + 1]);
							});

						});
					}, 500);
					
				});
			}, 200);
		});
	};
	
	chainAuth(0, bots[0]);
//	
//	timeoutForEach(500, bots, function(index, bot){
//		bot.initRequest(function(initReqTime) {
//			console.log("[" + bot.userId + "]init request time: ", initReqTime);
//			reqDelays.push(initReqTime);
//			bot.authRequest(function(authTime, authUpdate) {
//				progress++;
//				bot.accountId = authUpdate.accountId;
//				bot.initialState = authUpdate.initUpdate[bot.accountId].initialState;
//				for ( var id in authUpdate.initUpdate) {
//					if (authUpdate.initUpdate[id].class == "MapState") {
//						bot.mapStateId = id;
//						bot.gameStateId = authUpdate.initUpdate[id].gamestate;
//					}
//				}
//				if(index == count){
//					if(cb){
//						cb();
//					}
//				}
//			});
//		});
//	});
	
};

function testSwitch(botsCount, cb){
	bots = [];
	
	ssDelays = [];
	
	BOTS_COUNT = botsCount;
	authorizeBots(botsCount, function(){
		timeoutForEach(60, bots, function(index, bot){
			bot.switchState(bot.mapStateId, bot.gameStateId, function(dt, body){
				progress++;
				ssDelays.push(dt);
				if(index == botsCount){
					cb();
				}
			});
		});
	});
};

function testUnit(botsCount, supercb) {
	bots = [];

	reqDelays = [];
	authDelays = [];

	BOTS_COUNT = botsCount;
	for ( var i = 0; i < botsCount; i++) {
		bots.push(new Bot(i));
	};

	
	timeoutForEach(Math.ceil(1000/botsCount)+4, bots, function(index, bot){
		bot.runTest(index, supercb);
	});
}

process.on("uncaughtException", function(){
	EXCEPTION = true;
});


function globalSwitch(botsCount, beforeTest, cb){
	result = {
			name : "switchState",
			values : []
		};
	testResults.push(result);

	progressMax = botsCount*2;
	console.log("Started globalSwitch.");
	beforeTest(progressMax);
	testSwitch(botsCount, function(){
		result.values = ssDelay;
		if(cb){
			cb();
		}
	});
};

function globalTest(maxCount, beforeTest) {
	testResults.push({
		name : "initRequest",
		values : []
	});
	testResults.push({
		name : "authRequest",
		values : []
	});

	progressMax = 0;
	for ( var i = 1; i < maxCount + 1; i++) {
		progressMax += i * 2;
	}
	console.log("Started globalTest.");
	function callTestUnit(botsCount) {
		console.log("Calling testUnit on botsCount=", botsCount);
		if (botsCount > maxCount) {
			console.log("all results: ", testResults);
//			bossStop();
			return;
		}
		testUnit(botsCount, function(dtReq, dtAuth) {
			console.log("datReq=%s;dtAuth=%s  at botsCount=%s", dtReq, dtAuth, botsCount);
			for ( var i = 0; i < testResults.length; i++) {
				if (testResults[i].name == "initRequest") {
					testResults[i].values[botsCount - 1] = dtReq;
				}
				if (testResults[i].name == "authRequest") {
					testResults[i].values[botsCount - 1] = dtAuth;
				}
			}
			resetRequest(function() {
				console.log("Re-init of server sucess.");
				callTestUnit(botsCount + 1);
			});
		});
	};
	beforeTest(progressMax);
	callTestUnit(1);

};

function resetRequest(callback){
	var options = {
			method : "POST",
			uri : "http://" + url + "/reset"
		};
	request(options, function(error, response, body) {
		body = JSON.parse(body);
		if (!body["ready"]) {
			console.log("Smth wrong on reset");
			return;
		}
		if (callback) {
			callback();
		}
	});
};


var server = http.createServer(app);
server.listen(app.get("port"), function() {
	console.log("TestServer started on " + app.get("port"));
});

// http.get("http://ec2-23-20-152-59.compute-1.amazonaws.com/?viewer_id=0&isSafari=false",
// function(res) {
// console.log("Got response: " + res.statusCode);
// }).on('error', function(e) {
// console.log("Got error: " + e.message);
// });
