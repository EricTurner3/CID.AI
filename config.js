'use strict';

const WIT_TOKEN = process.env.WIT_TOKEN
if (!WIT_TOKEN) {
  throw new Error('Missing WIT_TOKEN. Go to https://wit.ai/docs/quickstart to get one.')
}


var FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
if (!FB_PAGE_TOKEN) {
	throw new Error('Missing FB_PAGE_TOKEN. Go to https://developers.facebook.com/docs/pages/access-tokens to get one.')
}

var FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;

var FB_APP_SECRET = process.env.FB_APP_SECRET;

//API KEYS
var GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
var WU_KEY = process.env.WU_KEY;
var OWM_KEY = process.env.OWM_KEY;
module.exports = {
  WIT_TOKEN: WIT_TOKEN,
  FB_PAGE_TOKEN: FB_PAGE_TOKEN,
  FB_VERIFY_TOKEN: FB_VERIFY_TOKEN,
  FB_APP_SECRET:FB_APP_SECRET,
  GOOGLE_API_KEY:GOOGLE_API_KEY,
  WU_KEY:WU_KEY,
  OWM_KEY:OWM_KEY
}