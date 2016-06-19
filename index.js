/**
    Copyright 2014-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

        http://aws.amazon.com/apache2.0/

    or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This sample shows how to create a Lambda function for handling Alexa Skill requests that:
 *
 * - Web service: communicate with an external web service to get events for specified days in history (Wikipedia API)
 * - Pagination: after obtaining a list of events, read a small subset of events and wait for user prompt to read the next subset of events by maintaining session state
 * - Dialog and Session state: Handles two models, both a one-shot ask and tell model, and a multi-turn dialog model.
 * - SSML: Using SSML tags to control how Alexa renders the text-to-speech.
 *
 * Examples:
 * One-shot model:
 * User:  "Alexa, ask History Buff what happened on August thirtieth."
 * Alexa: "For August thirtieth, in 2003, [...] . Wanna go deeper in history?"
 * User: "No."
 * Alexa: "Good bye!"
 *
 * Dialog model:
 * User:  "Alexa, open News Flash"
 * Alexa: "News Flash. What topic do you want headlines for?"
 * User:  "Brexit."
 * Alexa: "Brexit, here are today's top headlines: [...]. Want summaries? You can say first, second, third, or all"
 * User:  "First"
 * Alexa: "Paul Krugman Op-Ed column [...]. Wanna tweet?"
 * User: "Yes."
 * Alexa: "Tweeting link! Good bye!"
 */

var Twitter = require('twitter');

var client = new Twitter({
  consumer_key: '',
  consumer_secret: '',
  access_token_key: '',
  access_token_secret: ''
});

/**
 * App ID for the skill
 */
var APP_ID = undefined; //replace with 'amzn1.echo-sdk-ams.app.[your-unique-value-here]';

var https = require('https');

/**
 * The AlexaSkill Module that has the AlexaSkill prototype and helper functions
 */
var AlexaSkill = require('./AlexaSkill');

/**
 * URL prefix to download history content from Wikipedia
 */
var nytUrlPrefix = 'https://api.nytimes.com/svc/search/v2/articlesearch.json?api-key=1a2666b123d0480aab449904c016b58f&q=';

/**
 * Variable defining number of events to be read at one time
 */
var paginationSize = 3;

/**
 * Variable defining the length of the delimiter between events
 */
var delimiterSize = 2;

/**
 * NewsFlashSkill is a child of AlexaSkill.
 * To read more about inheritance in JavaScript, see the link below.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Introduction_to_Object-Oriented_JavaScript#Inheritance
 */
var NewsFlashSkill = function() {
    AlexaSkill.call(this, APP_ID);
};

// Extend AlexaSkill
NewsFlashSkill.prototype = Object.create(AlexaSkill.prototype);
NewsFlashSkill.prototype.constructor = NewsFlashSkill;

NewsFlashSkill.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    console.log("NewsFlashSkill onSessionStarted requestId: " + sessionStartedRequest.requestId
        + ", sessionId: " + session.sessionId);
    // any session init logic would go here
};

NewsFlashSkill.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    console.log("NewsFlashSkill onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
    getWelcomeResponse(response);
};

NewsFlashSkill.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    console.log("onSessionEnded requestId: " + sessionEndedRequest.requestId
        + ", sessionId: " + session.sessionId);
    // any session cleanup logic would go here
};

NewsFlashSkill.prototype.intentHandlers = {
    "GetFirstEventIntent": function (intent, session, response) {
        handleFirstEventRequest(intent, session, response);
    },

    "SearchIntent": function(intent, session, response) {
        handleFirstEventRequest(intent, session, response);
    },

    "GetSummaryIntent": function (intent, session, response) {
        handleNextEventRequest(intent, session, response);
    },

    "ShareArticleIntent": function (intent, session, response) {
        handleTweetRequest(intent, session, response);
    },

    "GetPositiveNewsIntent": function(intent, session, response) {
        handlePositiveNewsRequest(intent, session, response);
    },

    "EndIntent": function(intent, session, response) {
        handleEndRequest(intent, session, response);
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
        var speechText = "With News Flash, you can get current event headlines for any topic.  " +
            "For example, you could say Brexit, Donald Trump, or NBA Finals. Now, which topic do you want?";
        var repromptText = "Which topic do you want?";
        var speechOutput = {
            speech: speechText,
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        var repromptOutput = {
            speech: repromptText,
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.ask(speechOutput, repromptOutput);
    },

    "AMAZON.StopIntent": function (intent, session, response) {
        var speechOutput = {
                speech: "Goodbye",
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.tell(speechOutput);
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
        var speechOutput = {
                speech: "Goodbye",
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.tell(speechOutput);
    }
};

/**
 * Function to handle the onLaunch skill behavior
 */

function getWelcomeResponse(response) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    var cardTitle = "News Flash Current Events";
    var repromptText = "With News Flash, you can get current event headlines for any topic.  For example, you could say Brexit, Donald Trump, or NBA Finals. Now, which topic do you want?";
    var speechText = "<p>News Flash Current Events.</p> <p>What news topic do you want headlines for?</p>";
    var cardOutput = "News Flash. What news topic do you want headlines for?";
    // If the user either does not reply to the welcome message or says something that is not
    // understood, they will be prompted again with this text.

    var speechOutput = {
        speech: "<speak>" + speechText + "</speak>",
        type: AlexaSkill.speechOutputType.SSML
    };
    var repromptOutput = {
        speech: repromptText,
        type: AlexaSkill.speechOutputType.PLAIN_TEXT
    };
    response.askWithCard(speechOutput, repromptOutput, cardTitle, cardOutput);
}

var globalArticles = "";
var articleToTweet = null;

/**
 * Gets a poster prepares the speech to reply to the user.
 */
function handleFirstEventRequest(intent, session, response) {
    var querySlot = intent.slots.Query;
    var repromptText = "With News Flash, you can get current event headlines for any topic. For example, you could say today, or August thirtieth. Now, which day do you want?";
    var sessionAttributes = {};
    // Read the first 3 events, then set the count to 3
    sessionAttributes.index = paginationSize;
    var topic = "";

    if (querySlot && querySlot.value) {
        topic = querySlot.value;
    } else {
        topic = "Angelhack Brooklyn";
    }

    var prefixContent = "<p>Headlines for " + topic + ", </p>";
    var cardContent = "Headlines for " + topic + ", ";

    var cardTitle = "Headlines for " + topic;

    getJsonArticlesFromNYTimes(topic, function (articles) {
        var speechText = "",
            i;
        globalArticles = articles;
        sessionAttributes.text = articles;
        session.attributes = sessionAttributes;
        if (articles.length == 0) {
            speechText = "There is a problem connecting to New York Times article search at this time. Please try again later.";
            cardContent = speechText;
            response.tell(speechText);
        } else {
            for (i = 0; i < paginationSize; i++) {
                cardContent = cardContent + articles[i].headline + " ";
                speechText += "Article " + (i + 1) + ": <p>" + articles[i].headline + "</p> ";
            }
            speechText = speechText + " <p>Want a summary on article 1, 2, or 3?</p>";
            var speechOutput = {
                speech: "<speak>" + prefixContent + speechText + "</speak>",
                type: AlexaSkill.speechOutputType.SSML
            };
            var repromptOutput = {
                speech: repromptText,
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
            };
            response.askWithCard(speechOutput, repromptOutput, cardTitle, cardContent);
        }
    });
}

/**
 * Gets a poster prepares the speech to reply to the user.
 */
function handleNextEventRequest(intent, session, response) {
    var number = intent.slots.Number.value;
    var article;

    if (number === "one" || number === "1") {
        article = globalArticles[0];
        articleToTweet = 0;
    } else if (number === "two" || number === "2") {
        article = globalArticles[1];
        articleToTweet = 1;
    } else if (number === "three" || number === "3") {
        article = globalArticles[2];
        articleToTweet = 2;
    } else {

    }

    var cardTitle = "Here is the summary:",
        sessionAttributes = session.attributes,
        result = sessionAttributes.text,
        speechText = "",
        cardContent = "",
        repromptText = "Do you want to hear the summary for this article?",
        i;

    var speechText = "Summary for " + article.headline + ": " + article.summary;
    speechText += ". What else can I help with?"
    var speechOutput = {
        speech: "<speak>" + speechText + "</speak>",
        type: AlexaSkill.speechOutputType.SSML
    };
    var repromptOutput = {
        speech: repromptText,
        type: AlexaSkill.speechOutputType.PLAIN_TEXT
    };
    response.askWithCard(speechOutput, repromptOutput, cardTitle, cardContent);
}

// TODO finish function
function handleTweetRequest(intent, session, response) {
    var article = globalArticles[articleToTweet || 1]
      , articleUrl = article.url;

    client.post('statuses/update', {status: 'Cool article: ' + articleUrl},  function(error, tweet, response){
      if(error) throw error;
      console.log(tweet);  // Tweet body.
      console.log(response);  // Raw response object.
    });

}

// TODO finish function
function handlePositiveNewsRequest(intent, session, response) {

}

// TODO finish function
function handleEndRequest(intent, session, response) {

}

function getJsonEventsFromWikipedia(day, date, eventCallback) {
    var url = urlPrefix + day + '_' + date;

    https.get(url, function(res) {
        var body = '';

        res.on('data', function (chunk) {
            body += chunk;
        });

        res.on('end', function () {
            var stringResult = parseJson(body);
            eventCallback(stringResult);
        });
    }).on('error', function (e) {
        console.log("Got error: ", e);
    });
}

function getJsonArticlesFromNYTimes(query, eventCallback) {
    var url = nytUrlPrefix + query;

    https.get(url, function(res) {
        var body = '';
        res.on('data', function(chunk) {
            body += chunk;
        });

        res.on('end', function() {
            var articlesList = parseNYTJson(JSON.parse(body));
            eventCallback(articlesList);
        });
    }).on('error', function(e) {
        console.log('Got error: ', e);
    });
}

// TODO: finish this method
function parseNYTJson(jsonObj) {
    var retArr = [];

    var length = 3;
    for (var i = 0; i < length; i++) {
        var item = {}
        item.headline
        retArr.push({
            headline: jsonObj.response.docs[i].headline.main,
            summary: jsonObj.response.docs[i].abstract || jsonObj.response.docs[i].lead_paragraph,
            url: jsonObj.response.docs[i].web_url
        });
    }
    return retArr;
}

function parseJson(inputText) {
    // sizeOf (/nEvents/n) is 10
    var text = inputText.substring(inputText.indexOf("\\nEvents\\n")+10, inputText.indexOf("\\n\\n\\nBirths")),
        retArr = [],
        retString = "",
        endIndex,
        startIndex = 0;

    if (text.length == 0) {
        return retArr;
    }

    while(true) {
        endIndex = text.indexOf("\\n", startIndex+delimiterSize);
        var eventText = (endIndex == -1 ? text.substring(startIndex) : text.substring(startIndex, endIndex));
        // replace dashes returned in text from Wikipedia's API
        eventText = eventText.replace(/\\u2013\s*/g, '');
        // add comma after year so Alexa pauses before continuing with the sentence
        eventText = eventText.replace(/(^\d+)/,'$1,');
        eventText = 'In ' + eventText;
        startIndex = endIndex+delimiterSize;
        retArr.push(eventText);
        if (endIndex == -1) {
            break;
        }
    }
    if (retString != "") {
        retArr.push(retString);
    }
    retArr.reverse();
    return retArr;
}

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    // Create an instance of the HistoryBuff Skill.
    var skill = new NewsFlashSkill();
    skill.execute(event, context);
};

