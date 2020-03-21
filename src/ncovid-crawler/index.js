// main.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const axios = require('axios');
const https = require('https');
const url = "https://ncov.moh.gov.vn/";

const fetchData = async () => {
    console.log("Crawling data...")
    // make http call to url
    let response = await axios({
        url,
        method: 'GET',
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        responseType: 'text/html'
    }).catch((err) => console.log(err));

    if (response.status !== 200) {
        console.log("Error occurred while fetching data");
        return;
    }
    return response;
}

module.exports = { fetchData }