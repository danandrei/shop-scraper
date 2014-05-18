var util = require('util'),
    request = require('request'),
    cheerio = require('cheerio'),
    mongo = require('./mongo_control.js'),
    ProgressBar = require('progress');
var config = require('./config.json');
var schedule = require('node-schedule');
var db;
var currentPosition = 0;
var ACTIVE_DATE;

// connect to mongo
mongo.connect('scanner', function (mongoinfo) {
    db = mongoinfo;
});

// this function is used to move trough the hosts array
function nextHost () {

    // close app
    if (currentPosition == config.hosts.length - 1){
        console.log('------ FINISHED RUN ------');
        /* scrapper has finished  */

        // TODO this is only temporary until we figure out what to do with the old items when a new scan is called
        mongo.dropDatabase(db);
        return;
    }

    //call the next host
    scrapHost(config.hosts[++currentPosition]);
}

function buildFinalPagination (core_pages, functions, callback) {

    // get the html from the core pages in order to extract the page number
    var pageLength = core_pages.length;
    var pages = [];

    // build progress bar
    var bar = new ProgressBar('Building pagination... [:bar] :percent | Elapsed: :elapsed', { total: pageLength});

    for (var page in core_pages) {

        (function (page) {
            request(core_pages[page].url, function (error, response, html) {

                if (error) {
                    // TODO handle error
                    console.log(error);
                }

                bar.tick();
                // get the page number
                functions.getPageNumbers(html, function (number) {

                    if (number) {
                        //build the final pages
                        functions.buildPagination(number, core_pages[page].url, function (partialPagination) {

                            for (var i in partialPagination) {
                                pages.push({
                                    url: partialPagination[i],
                                    data: core_pages[page].data
                                });
                            }

                            // when done send pages
                            if (!--pageLength) {
                                callback(pages);
                            }
                        });
                    } else {
                        // TODO handler error
                    }
                });
            }).setMaxListeners(0);
        })(page);
    }
}

// core function that scrapes the hosts and gets their html
function scrapHost (host) {
    var hostFunctions = require(host.functions);
    console.log('-------------------------------------');
    console.log('Scraping content from - ' + host.name);

    // Initialize core pages
    host.core_pages = [];
    for (var page in host.map) {
        host.core_pages.push({
            url: host.url + '/' + host.map[page].url,
            data: host.map[page]
        });
    }

    // build the url for the pages that are going to be scraped
    buildFinalPagination (host.core_pages, hostFunctions, function (pages) {

        console.log('Page number complete');
        // build progress bar
        var bar = new ProgressBar('Scraping... [:bar] :percent | Elapsed: :elapsed', { total: pages.length});

        // request iterator
        var max_requests = pages.length;
        var current_request = 0

        function nextRequest () {

            if (current_request < max_requests - 1) {
                makeRequest(pages[++current_request]);
                bar.tick();
            } else {
                if (bar.complete) {
                    console.log('Done with - ' + host.name);
                    nextHost();
                }
            }
        }

        // make the request for html
        function makeRequest (page) {
            request(page.url, function (error, response, html) {

                if (error) {
                    // TODO handle error
                    console.log(error);
                } else {
                    nextRequest();

                    // process the html
                    hostFunctions.getContent(html, host.map, function (data) {

                        if (data) {
                            
                            // finalize the object
                            data.host = host.name;
                            data['class'] = page.data['class'];
                            data['subclass'] = page.data['subclass'];
                            data['class_id'] = page.data['class_id'];
                            data['subclass_id'] = page.data['subclass_id'];

                            //insert the item found
                            var crudObj = {
                                data: data
                            }
                            mongo.insert(db, 'scan_products', crudObj);
                            
                            //upsert class
                            var crudObj = {
                                query: {
                                    name: data['class']
                                },
                                data: {
                                    $set: {
                                        name: data['class'],
                                        class_id: data.class_id
                                    },
                                    $addToSet: {
                                        subclass: data.subclass,
                                        subclass_id: data.subclass_id
                                    }
                                },
                                options: {
                                    upsert: true
                                }
                            }
                            mongo.update(db, 'mappings', crudObj);
                        }
                    });
                }
            });
        };

        // make the first request
        makeRequest(pages[0]);
        bar.tick();
    });
}

/****** CRON Job Core ******/

function cronJob (oldDate) {
    
    // oldDate + 1 day
    var date = new Date(oldDate.getTime() + (24 * 60 * 60 * 1000);

    var job = schedule.scheduleJob(date, function(){
        console.log('------ ' + date + ' ------');

        // start the scrap
        ACTIVE_DATE = date;
        currentPosition = 0;
        scrapHost(config.hosts[0]);

        // call next cron job
        cronJob(date);
    });
}

// initialize the date
var currentDate = new Date();
var dateObj = {
    year: currentDate.getUTCFullYear(),
    month: currentDate.getUTCMonth(),
    day: currentDate.getUTCDate()
}
var setHour = config.options.scrapHour.split(':');
var scrapHour = new Date(dateObj.year, dateObj.month, dateObj.day, setHour[0], setHour[1], 0);

// start the cron job
cronJob(new Date(scrapHour - (24 * 60 * 60 * 1000)));
