var util = require('util'),
    request = require('request'),
    cheerio = require('cheerio'),
    mongo = require('./mongo_control.js');
var config = require('./config.json');
var db;
var currentPosition = 0;

// connect to mongo
mongo.connect('scanner', function (mongoinfo) {
    db = mongoinfo;

    // empty the db
    // TODO this is only temporary until we figure out what to do with the old items when a new scan is called
    mongo.dropDatabase(db);
});

// this function is used to move trough the hosts array
function nextHost () {

    if (currentPosition == config.hosts.length - 1){
        //mongo.close(db);
        return;
    }

    //call the next host
    scrapHost(config.hosts[++currentPosition]);
}

function buildFinalPagination (core_pages, functions, callback) {

    // get the html from the core pages in order to extract the page number
    var pageLength = core_pages.length;
    var pages = [];
    for (var page in core_pages) {

        (function (page) {
            request(core_pages[page].url, function (error, response, html) {

                if (error) {
                    // TODO handle error
                    console.log(error);
                }

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
            });
        })(page);
    }
}

// core function that scrapes the hosts and gets their html
function scrapHost (host) {
    var hostFunctions = require(host.functions);
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
        // start the scraping for content
        for (var page in pages) {

            // make the request for html
            (function (page) {
                request(pages[page].url, function (error, response, html) {

                    if (error) {
                        // TODO handle error
                        console.log(error);
                    } else {
                        console.log('Done with: ' + pages[page].url);
                        // process the html
                        hostFunctions.getContent(html, host.map, function (data) {

                            if (data) {
                                
                                // finalize the object
                                data.host = host.name;
                                data['class'] = pages[page].data['class'];
                                data['subclass'] = pages[page].data['subclass'];
                                data['class_id'] = pages[page].data['class_id'];
                                data['subclass_id'] = pages[page].data['subclass_id'];

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
            })(page);
        }
    });
}

// start the scraping
scrapHost(config.hosts[0]);
