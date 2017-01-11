'use strict';

// Messenger API integration example
// We assume you have:
// * a Wit.ai bot setup (https://wit.ai/docs/quickstart)
// * a Messenger Platform setup (https://developers.facebook.com/docs/messenger-platform/quickstart)
// You need to `npm install` the following dependencies: body-parser, express, request.
//
// 1. npm install body-parser express request
// 2. Download and install ngrok from https://ngrok.com/download
// 3. ./ngrok http 8445
// 4. WIT_TOKEN=your_access_token FB_APP_SECRET=your_app_secret FB_PAGE_TOKEN=your_page_token node examples/messenger.js
// 5. Subscribe your page to the Webhooks using verify_token and `https://<your_ngrok_io>/webhook` as callback URL.
// 6. Talk to your bot on Messenger!

const bodyParser = require('body-parser');
const crypto = require('crypto');
const express = require('express');
const fetch = require('node-fetch');
const request = require('request');

var Config = require('./config')

let Wit = null;
let log = null;
try {
    // if running from repo
    Wit = require('../').Wit;
    log = require('../').log;
} catch (e) {
    Wit = require('node-wit').Wit;
    log = require('node-wit').log;
}

// Webserver parameter
const PORT = process.env.PORT || 8445;

// Wit.ai parameters
const WIT_TOKEN = Config.WIT_TOKEN;


//Sender ID of Facebook User
var FB_SENDER_ID;

// Messenger API parameters
const FB_PAGE_TOKEN = Config.FB_PAGE_TOKEN;
if (!FB_PAGE_TOKEN) {
    throw new Error('missing FB_PAGE_TOKEN')
}
const FB_APP_SECRET = Config.FB_APP_SECRET;
if (!FB_APP_SECRET) {
    throw new Error('missing FB_APP_SECRET')
}
const FB_VERIFY_TOKEN = Config.FB_VERIFY_TOKEN;

//Google API Key

const GOOGLE_API_KEY = Config.GOOGLE_API_KEY;


//Weather API Keys

//Weather Underground Key for Radar
const WU_KEY = Config.WU_KEY;

//OpenWeatherMap Key for Weather Information
const OWM_KEY = Config.OWM_KEY;


/*
//Use Crypto to Generate a new verify token each time
let FB_VERIFY_TOKEN = null;
crypto.randomBytes(8, (err, buff) => {
  if (err) throw err;
  FB_VERIFY_TOKEN = buff.toString('hex');
  console.log(`/webhook will accept the Verify Token "${FB_VERIFY_TOKEN}"`);
});
*/

// ----------------------------------------------------------------------------
// Messenger API specific code

// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference

const fbMessage = (id, text) => {
    const body = JSON.stringify({
        recipient: {
            id
        },
        message: {
            text
        },
    });
    const qs = 'access_token=' + encodeURIComponent(FB_PAGE_TOKEN);
    return fetch('https://graph.facebook.com/v2.6/me/messages?' + qs, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body,
        })
        .then(rsp => rsp.json())
        .then(json => {
            if (json.error && json.error.message) {
                throw new Error(json.error.message);
            }
            return json;
        });
};

function fbAttachmentMessage(sender, messageData) {
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages?access_token=' + encodeURIComponent(FB_PAGE_TOKEN),
        method: 'POST',
        json: {
            recipient: {
                id: sender
            },
            message: messageData,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });
};


// ----------------------------------------------------------------------------
// Wit.ai bot specific code

// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}
const sessions = {};

const findOrCreateSession = (fbid) => {
    let sessionId;
    // Let's see if we already have a session for the user fbid
    Object.keys(sessions).forEach(k => {
        if (sessions[k].fbid === fbid) {
            // Yep, got it!
            sessionId = k;
        }
    });
    if (!sessionId) {
        // No session found for user fbid, let's create a new one
        sessionId = new Date().toISOString();
        sessions[sessionId] = {
            fbid: fbid,
            context: {}
        };
    }
    return sessionId;
};

const firstEntityValue = (entities, entity) => {
    const val = entities && entities[entity] &&
        Array.isArray(entities[entity]) &&
        entities[entity].length > 0 &&
        entities[entity][0].value;
    if (!val) {
        return null;
    }
    return typeof val === 'object' ? val.value : val;
};

// Our bot actions
const actions = {
    send({
        sessionId
    }, {
        text
    }) {
        // Our bot has something to say!
        // Let's retrieve the Facebook user whose session belongs to
        const recipientId = sessions[sessionId].fbid;
        if (recipientId) {
            // Yay, we found our recipient!
            // Let's forward our bot response to her.
            // We return a promise to let our bot know when we're done sending
            return fbMessage(recipientId, text)
                .then(() => null)
                .catch((err) => {
                    console.error(
                        'Oops! An error occurred while forwarding the response to',
                        recipientId,
                        ':',
                        err.stack || err
                    );
                });
        } else {
            console.error('Oops! Couldn\'t find user for session:', sessionId);
            // Giving the wheel back to our bot
            return Promise.resolve()
        }
    },
    // You should implement your custom actions here
    // See https://wit.ai/docs/quickstart

    ['fetchWeather'](request) {
        var context = request.context;
        var entities = request.entities;
		var sender = FB_SENDER_ID;
		console.log("[fetchWeather] var sender = " + sender);
        var location = firstEntityValue(entities, 'location');

        delete context.forecast;
        delete context.missingLocation;
        delete context.location;

        if (location) {
            context.location = location;
            return fetch(
                    'http://api.openweathermap.org/data/2.5/find?q=' + location +
                    '&units=imperial' +
                    '&appid='+ OWM_KEY
                ) 
                .then(function(response) {
                    return response.json();
                })
                .then(function(responseJSON) {
                    context.forecast = responseJSON.list[0].weather[0].description + " with a temperature of " + responseJSON.list[0].main.temp + " degrees in " + location;
					sendWeather(sender,context.location,context.forecast);
                    return context;
                });
        } else {
            context.missingLocation = true;
            return context;
        }
    },
	

};

//Use Google Maps API to retrieve lat/long from any location
var getCoordinates = function(loc){
	console.log("getCoordinates: Generating Coordinates from " + loc);
	return fetch(
                    'https://maps.googleapis.com/maps/api/geocode/json?address=' + loc +
                    '&key='+ GOOGLE_API_KEY
                )
                .then(function(response) {
					console.log("getCoordinates: JSON Data Recieved from " + 'https://maps.googleapis.com/maps/api/geocode/json?address=' + loc + '&key='+ GOOGLE_API_KEY);
					
					console.log("");
                    return response.json();
                })
                .then(function(responseJSON) {
                    var clat = responseJSON.results[0].geometry.location.lat;
					var clong = responseJSON.results[0].geometry.location.lng;
					var coordinates = "centerlat="+ clat + "&centerlon="+ clong;
					console.log("getCoordinates: Coordinates Found! Latitude = " + clat + ", Longitude = " + clong);
					
					return coordinates;
                });
};

var radarMap = function(loc){
	return new Promise (function (resolve, reject){
		
	var coordinates = getCoordinates(loc)
		.then(function(coords){
			var mapLink = "http://api.wunderground.com/api/"+ WU_KEY + "/radar/image.gif?"+ coords +"&radius=50&width=280&height=280&newmaps=1";
			console.log("radarMap: Map Link Generated: " + mapLink);
			return resolve(mapLink);
		});
	});

};
function sendWeather(sender,location,weather) {

	var rMap = radarMap(location)
		.then(function(mpLink){
			var imageLink = mpLink;
			var messageData = {
				"attachment": {
					"type": "template",
					"payload": {
						"template_type": "generic",
						"elements": [{
							"title": "Weather in " + location,
							"image_url": '"' + imageLink + '"',
							"subtitle": '"' + weather + '"' ,
						}]
					}
				}
			}
			console.log("[fetchWeather]: sendWeather(): Sending via fbAttachmentMessage()...");
			fbAttachmentMessage(sender,messageData);
		});
}


// Setting up our bot
const wit = new Wit({
    accessToken: WIT_TOKEN,
    actions,
    logger: new log.Logger(log.INFO)
});

// Starting our webserver and putting it all together
const app = express();
app.use(({
    method,
    url
}, rsp, next) => {
    rsp.on('finish', () => {
        console.log(`${rsp.statusCode} ${method} ${url}`);
    });
    next();
});
app.use(bodyParser.json({
    verify: verifyRequestSignature
}));

// Webhook setup
app.get('/webhooks', (req, res) => {
    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
        res.send(req.query['hub.challenge']);
    } else {
        res.sendStatus(400);
    }
});

// Message handler
app.post('/webhooks', (req, res) => {
    // Parse the Messenger payload
    // See the Webhook reference
    // https://developers.facebook.com/docs/messenger-platform/webhook-reference
    const data = req.body;

    if (data.object === 'page') {
        data.entry.forEach(entry => {
            entry.messaging.forEach(event => {
                if (event.message && !event.message.is_echo) {
                    // Yay! We got a new message!
                    // We retrieve the Facebook user ID of the sender
                    const sender = event.sender.id;
					FB_SENDER_ID = sender;

                    // We retrieve the user's current session, or create one if it doesn't exist
                    // This is needed for our bot to figure out the conversation history
                    const sessionId = findOrCreateSession(sender);

                    // We retrieve the message content
                    const {
                        text,
                        attachments
                    } = event.message;

                    if (attachments) {
                        // We received an attachment
                        // Let's reply with an automatic message
                        fbMessage(sender, 'Sorry I can only process text messages for now.')
                            .catch(console.error);
                    } else if (text) {
                        // We received a text message

                        // Let's forward the message to the Wit.ai Bot Engine
                        // This will run all actions until our bot has nothing left to do
                        wit.runActions(
                                sessionId, // the user's current session
                                text, // the user's message
                                sessions[sessionId].context // the user's current session state
                            ).then((context) => {
                                // Our bot did everything it has to do.
                                // Now it's waiting for further messages to proceed.
                                console.log('Waiting for next user messages');

                                // Based on the session state, you might want to reset the session.
                                // This depends heavily on the business logic of your bot.
                                // Example:
                                if (context['done']) {
                                    delete sessions[sessionId];
                                }

                                // Updating the user's current session state
                                sessions[sessionId].context = context;
                            })
                            .catch((err) => {
                                console.error('Oops! Got an error from Wit: ', err.stack || err);
                            })
                    }
                } else {
                    console.log('received event', JSON.stringify(event));
                }
            });
        });
    }
    res.sendStatus(200);
});

/*
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
    var signature = req.headers["x-hub-signature"];

    if (!signature) {
        // For testing, let's log an error. In production, you should throw an
        // error.
        console.error("Couldn't validate the signature.");
    } else {
        var elements = signature.split('=');
        var method = elements[0];
        var signatureHash = elements[1];

        var expectedHash = crypto.createHmac('sha1', FB_APP_SECRET)
            .update(buf)
            .digest('hex');

        if (signatureHash != expectedHash) {
            throw new Error("Couldn't validate the request signature.");
        }
    }
}

app.listen(PORT);
console.log('Listening on :' + PORT + '...');