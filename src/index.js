'use strict';

// Imports dependencies and set up http server
require('dotenv').config();//.env
const express = require('express'),
    bodyParser = require('body-parser'),
    app = express().use(bodyParser.json()),
    puppeteer = require('puppeteer');


const PORT = process.env.PORT;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// Creates the endpoint for our webhook 
app.post('/webhook', (req, res) => {
    let body = req.body;

    // Checks this is an event from a page subscription
    if (body.object === 'page') {

        // Iterates over each entry - there may be multiple if batched
        body.entry.forEach(function (entry) {
            // Gets the body of the webhook event
            let webhook_event = entry.messaging[0];
            console.log(webhook_event);

            // Get the sender PSID
            let sender_psid = webhook_event.sender.id;
            console.log('Sender PSID: ' + sender_psid);

            // Check if the event is a message or postback and
            // pass the event to the appropriate handler function
            if (webhook_event.message) {
                handleMessage(sender_psid, webhook_event.message);
            } else if (webhook_event.postback) {
                handlePostback(sender_psid, webhook_event.postback);
            }
        });

        // Returns a '200 OK' response to all requests
        res.status(200).send('EVENT_RECEIVED');
    } else {
        // Returns a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }

});

const callSendAPI = (sender_psid, response) => {
    // Construct the message body
    let request_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": response
    }
    let uri = "https://graph.facebook.com/v2.6/me/messages";
    // Send the HTTP request to the Messenger Platform
    // request({
    //     uri,
    //     "qs": { "access_token": PAGE_ACCESS_TOKEN },
    //     "method": "POST",
    //     "json": request_body
    // }, (err, res, body) => {
    //     if (!err) {
    //         console.log('message sent!')
    //     } else {
    //         console.error("Unable to send message:" + err);
    //     }
    // });
    (async () => {
        // Create browser instance, and give it a first tab
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        // Allows you to intercept a request; must appear before
        // your first page.goto()
        await page.setRequestInterception(true);

        // Request intercept handler... will be triggered with 
        // each page.goto() statement
        page.on('request', interceptedRequest => {
            // Here, is where you change the request method and 
            // add your post data
            var data = {
                'method': 'POST',
                'postData': request_body
            };

            // Request modified... finish sending! 
            interceptedRequest.continue(data);
        });

        // Navigate, trigger the intercept, and resolve the response
        const response = await page.goto(`${uri}?access_token=${PAGE_ACCESS_TOKEN}`);
        const responseBody = await response.text();
        console.log(responseBody);

        // Close the browser - done! 
        await browser.close();
    })();
}

const handleMessage = (sender_psid, received_message) => {
    let response;

    // Checks if the message contains text
    if (received_message.text) {
        // Create the payload for a basic text message, which
        // will be added to the body of our request to the Send API
        response = {
            "text": `You sent the message: "${received_message.text}". Now send me an attachment!`
        }
    } else if (received_message.attachments) {
        // Get the URL of the message attachment
        let attachment_url = received_message.attachments[0].payload.url;
        response = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": [{
                        "title": "Is this the right picture?",
                        "subtitle": "Tap a button to answer.",
                        "image_url": attachment_url,
                        "buttons": [
                            {
                                "type": "postback",
                                "title": "Yes!",
                                "payload": "yes",
                            },
                            {
                                "type": "postback",
                                "title": "No!",
                                "payload": "no",
                            }
                        ],
                    }]
                }
            }
        }
    }

    // Send the response message
    callSendAPI(sender_psid, response);
}

const handlePostback = (sender_psid, received_postback) => {
    let response;

    // Get the payload for the postback
    let payload = received_postback.payload;

    // Set the response based on the postback payload
    if (payload === 'yes') {
        response = { "text": "Thanks!" }
    } else if (payload === 'no') {
        response = { "text": "Oops, try sending another image." }
    }
    // Send the message to acknowledge the postback
    callSendAPI(sender_psid, response);
}

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {
    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    // Checks if a token and mode is in the query string of the request
    if (mode && token) {

        // Checks the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {

            // Responds with the challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);

        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
});

// Sets server port and logs message on success
app.listen(PORT || 1337, () => console.log('webhook is listening'));