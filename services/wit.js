'use strict'

var Config = require('../config')
var FB = require('../connectors/facebook')
var Wit = require('node-wit').Wit
var request = require('request')


var firstEntityValue = function (entities, entity) {
	var val = entities && entities[entity] &&
		Array.isArray(entities[entity]) &&
		entities[entity].length > 0 &&
		entities[entity][0].value

	if (!val) {
		return null
	}
	return typeof val === 'object' ? val.value : val
}


var actions = {
	say (sessionId, context, message, cb) {
		// Bot testing mode, run cb() and return
		if (require.main === module) {
			cb()
			return
		}

		console.log('WIT WANTS TO TALK TO:', context._fbid_)
		console.log('WIT HAS SOMETHING TO SAY:', message)
		console.log('WIT HAS A CONTEXT:', context)

		if (checkURL(message)) {
			FB.newMessage(context._fbid_, message, true)
		} else {
			FB.newMessage(context._fbid_, message)
		}

		
		cb()
		
	},

	merge(sessionId, context, entities, message, cb) {
		// Reset the weather story
		delete context.forecast
		delete context.temp

		// Retrive the location entity and store it in the context field
		var loc = firstEntityValue(entities, 'location')
		if (loc) {
			context.loc = loc
		}

		// Retrieve the sentiment
		var sentiment = firstEntityValue(entities, 'sentiment')
		if (sentiment) {
			context.ack = sentiment === 'positive' ? 'Glad you liked it!' : 'Aww, that sucks.'
		} else {
			delete context.ack
		}

		//Retrieve greetings
		var greeting = firstEntityValue(entities, 'greeting')
		if (greeting) {
			context.hi = 'Hello!' 
		} else {
			delete context.hi
		}

		cb(context)
	},

	error(sessionId, context, error) {
		console.log(error.message)
	},

	// list of functions Wit.ai can execute
	['fetch-weather'](sessionId, context, cb) {
		
		if (context.loc) {
			getWeather(context.loc)
		 		.then(function (forecast) {
		 			context.forecast = forecast
		 		})
		 		.catch(function (err) {
		 			console.log(err)
		 		})
		}



		cb(context)
	},

	['fetch-directions'](sessionId, context, cb) {
		
		if (context.origin && context.dest) {
			getDirections(context.origin, context.dest)
		 		.then(function (forecast) {
		 			context.directions = directions
		 		})
		 		.catch(function (err) {
		 			console.log(err)
		 		})
		}


		cb(context)
	},
}

// SETUP THE WIT.AI SERVICE
var getWit = function () {
	console.log('GRABBING WIT')
	return new Wit(Config.WIT_TOKEN, actions)
}

module.exports = {
	getWit: getWit,
}

// BOT TESTING MODE
if (require.main === module) {
	console.log('Bot testing mode!')
	var client = getWit()
	client.interactive()
}
//Check if URL contains attachment
var checkURL = function (url){
	return(url.match(/\.(jpeg|jpg|gif|png)$/) != null);
}


// GET WEATHER FROM API
var getWeather = function (location) {
	return new Promise(function (resolve, reject) {
		var url = 'http://api.openweathermap.org/data/2.5/find?q='+ location +'&units=imperial&appid=94f38a7a1a91948b0e04e86d5d4d2ef3'
		request(url, function (error, response, body) {
		    if (!error && response.statusCode == 200) {
		    	var jsonData = JSON.parse(body)
			var condition = jsonData.list[0].weather.main
			var temp = jsonData.list[0].main.temp
		    	var forecast = "Currently: " + condition + " in " + location + " with a temperature of " + temp + " degrees"
		      	console.log('WEATHER API SAYS.... ', forecast)
		      
			return forecast
			
			
		    }
			})
	})
}
// GET DIRECTIONS FROM API
var getDirections = function (origin, dest) {
	return new Promise(function (resolve, reject) {
		var url = 'https://maps.googleapis.com/maps/api/directions/json?origin='+ origin + '&destination='+ destination + '4&key=AIzaSyB_oDSmms54zH3Ffb8hHv6854VcWCFKr24'
		request(url, function (error, response, body) {
		    if (!error && response.statusCode == 200) {
		    	var jsonData = JSON.parse(body)
		    	var directions = jsonData.query.routes.legs.steps[0].text
		      console.log('DIRECTIONS API SAYS....', jsonData.query.routes.legs.steps[0].text)
		      return directions
		    }
			})
	})
};

