// main.js

const axios = require('axios');
const url = "https://ncov.moh.gov.vn/";

const fetchData = async () => {
    console.log("Crawling data...")
    // make http call to url
    let response = await axios(url, {
        rejectUnauthorized: false
    }).catch((err) => console.log(err));

    if (response.status !== 200) {
        console.log("Error occurred while fetching data");
        return;
    }
    return response;
}

module.exports = { fetchData };