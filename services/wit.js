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
					var weather = weatherInfo()
		 			context.forecast = weather[0]
					context.temp = weather[1]
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
		var url = 'https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20weather.forecast%20where%20woeid%20in%20(select%20woeid%20from%20geo.places(1)%20where%20text%3D%22'+ location +'%22)&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys'
		request(url, function (error, response, body) {
		    if (!error && response.statusCode == 200) {
			var weatherInfo = function(){
		    		var jsonData = JSON.parse(body)
		    		var condition = jsonData.query.results.channel.item.condition[0].text
				var temp = jsonData.query.results.channel.item.condition.temp[0].text
		      		console.log('WEATHER API SAYS.... CURRENTLY:', jsonData.query.results.channel.item.condition[0].text, 'TEMP: ',jsonData.query.results.channel.item.condition.temp[0].text)
		      
				return [condition,temp]
			}
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

