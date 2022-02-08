import fs from 'fs'
import { exit } from 'process';
import { sanitize } from "./utils"
import scraper from 'table-scraper';

const URL: string = 'https://www.stcmu.com/ppm/retail-prices'

scraper
    .get(URL)
    .then(function (tableData) {
        let processsed = sanitize(tableData);
        let filname_with_timestamp = new Date().toISOString().slice(0, 10);
        let stringified = JSON.stringify(processsed);
        fs.writeFileSync('./data/latest.json', stringified);
        fs.writeFileSync(`./data/history/${filname_with_timestamp}.json`, stringified);
        exit(0);
    }).catch(function (err) {
        console.error(err);
        exit(1);
    })

