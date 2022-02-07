import scraper from 'table-scraper';
import { cleanup } from "./utils.js"
import fs from 'fs'
const URL = 'https://www.stcmu.com/ppm/retail-prices'

scraper
    .get(URL)
    .then(function (tableData) {
        let processsed = cleanup(tableData);
        let filname_with_timestamp = new Date().getTime();
        let stringified = JSON.stringify(processsed);
        fs.writeFileSync('./data/latest.json', stringified);
        fs.writeFileSync(`./data/history/${filname_with_timestamp}.json`, stringified);
    });


