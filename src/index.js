'use strict';

// Imports dependencies and set up http server
require('dotenv').config();//.env
const express = require('express'),
    bodyParser = require('body-parser'),
    app = express().use(bodyParser.json()),
    https = require('https'),
    cheerio = require('cheerio');

const { fetchData } = require('./ncovid-crawler')
const PORT = process.env.PORT;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

app.get('/api/ncovid', async (req, response) => {
    await fetchData().then((res) => {
        const html = res.data;
        // const $ = cheerio.load(html);

        const infected = findInfo(html,
            /<p><span class="font24 text-danger2">(.*)<\/span>/gm,
            '<p><span class="font24 text-danger2">',
            '</span>'
        )
        const recovered = findInfo(html,
            /<span style="font-size:28px;">(.*)<\/span>/gm,
            '<span style="font-size:28px;">',
            '</span>:</span>'
        )
        const dead = findInfo(html,
            /&nbsp; &nbsp; (\d*)<\/span>/gm,
            '&nbsp; &nbsp; ',
            '</span>'
        )

        response.json({
            infected,
            dead,
            recovered
        })
    })
})

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
    /*
    Send the HTTP request to the Messenger Platform
    request({
        uri,
        "qs": { "access_token": PAGE_ACCESS_TOKEN },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        if (!err) {
            console.log('message sent!')
        } else {
            console.error("Unable to send message:" + err);
        }
    }); 
    */
    let jsonObject = JSON.stringify(request_body);
    let postHeaders = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonObject, 'utf8')
    };
    // the post options
    let postOptions = {
        host: 'graph.facebook.com',
        path: `/v2.6/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
        method: 'POST',
        headers: postHeaders
    };

    const reqPost = https.request(postOptions, (res) => {
        console.log("statusCode: ", res.statusCode);
        // uncomment it for header details
        //  console.log("headers: ", res.headers);

        res.on('data', function (d) {
            console.info('POST result:\n');
            process.stdout.write(d);
            console.info('\n\nPOST completed');
        });
    });
    // write the json data
    reqPost.write(jsonObject);
    reqPost.end();
    reqPost.on('error', function (e) {
        console.error(e);
    });
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

const handlePostback = async (sender_psid, received_postback) => {
    let response;

    // Get the payload for the postback
    let payload = received_postback.payload;

    // Set the response based on the postback payload
    if (payload === 'GET_STARTED_PAYLOAD') {
        response = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": [{
                        "title": "Welcome to my app",
                        "subtitle": "Choose an option.",
                        "buttons": [
                            {
                                "type": "postback",
                                "title": "Ncovid statistics",
                                "payload": "ncovid-statisics",
                            }
                        ],
                    }]
                }
            }
        }

    } else if (payload === 'ncovid-statisics') {
        response = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": [{
                        "title": "Choose a location",
                        "subtitle": "Choose an option.",
                        "buttons": [
                            {
                                "type": "postback",
                                "title": "Viet Nam",
                                "payload": "ncovid-statisics-vi",
                            }
                        ],
                    }]
                }
            }
        }
    } else if (payload === 'ncovid-statisics-vi') {
        await fetchData().then((res) => {
            const html = res.data;
            // const $ = cheerio.load(html);

            const infected = findInfo(html,
                /<p><span class="font24 text-danger2">(.*)<\/span>/gm,
                '<p><span class="font24 text-danger2">',
                '</span>'
            )
            const recovered = findInfo(html,
                /<span style="font-size:28px;">(.*)<\/span>/gm,
                '<span style="font-size:28px;">',
                '</span>:</span>'
            )
            const dead = findInfo(html,
                /&nbsp; &nbsp; (\d*)<\/span>/gm,
                '&nbsp; &nbsp; ',
                '</span>'
            )

            response = {
                "text": `Infected: ${infected}\nDead: ${dead}\nRecoverd: ${recovered}`
            }
        })
    }
    // Send the message to acknowledge the postback
    callSendAPI(sender_psid, response);
}

const findInfo = (html, regex, firstStr, lastStr) => {
    const rs = html.match(regex)[0];
    const infected = rs.replace(firstStr, "").replace(lastStr, "")

    return infected
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