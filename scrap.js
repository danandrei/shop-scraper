var util = require('util'),
    request = require('request'),
    cheerio = require('cheerio'),
    mongo = require('./mongo_control.js'),
    schedule = require('node-schedule'),
    fs = require('fs');
var config = require('./config.json');
var db;
var currentPosition = 0;
var ACTIVE_DATE;

var itemsFound = {};

// log API init
var log = {
    filename: '',
    activeFile: '',
    flag: 'w+',
    file: null,
    mode: 0666,
    encoding: 'utf8',

    write: function (string) {

        // create file if it does not exist
        if (this.file == null || this.activeFile !== this.filename) {
            this.file = fs.openSync(this.filename, this.flag, this.mode);
            this.activeFile = this.filename;
        }

        if (string instanceof String) { string = string.toString(); }
        if (typeof string != "string") { string = JSON.stringify( string ); }
        
        var buffer = new Buffer(string, this.encoding);
        fs.writeSync(this.file, buffer, 0, buffer.length);

        return this;
    },
    close: function () {
        if (this.file) {
            fs.close(this.file);
        }

        return this;
    }
}

// connect to mongo
mongo.connect('scanner', function (mongoinfo) {
    db = mongoinfo;

    // this is temporary until w do the merging thingy
    mongo.dropDatabase(db);

    // start the cron job
    cronJob(new Date(scrapHour - (24 * 60 * 60 * 1000)));

});

function formatDate (date) {

    if (!date) { return; }

    var result = ('0' + date.getDate()).slice(-2) + '.' + ('0' + (date.getMonth() + 1)).slice(-2) + '.' + date.getFullYear() + '_' + ('0' + (date.getHours())).slice(-2) + ':' + ('0' + (date.getMinutes() + 1)).slice(-2);
    return result;
}

/* function that builds errors and logs them 
*
*   errObj = {
*       err: ...,
*       url: ...,
*       host: ...,
*       date: ...
*   }
*/
function buildError (errObj) {

    if (!errObj) { return; }

    var logLine = '| ' + formatDate(errObj.date) + ' |[ERROR] - ';
    logLine += errObj.err + ' - ';
    logLine += '| on url: ' + errObj.url + ' | - ';
    logLine += '| on host: ' + errObj.host + ' |\n';

    console.log(logLine);
    log.write(logLine);
}

/* function that builds logs and logs them 
*
*   logObj = {
*       log: ...,
*       host: ...,
*       date: ...
*   }
*/
function buildLog (logObj) {

    if (!logObj) { return; }

    var logLine = '| ' + formatDate(logObj.date) + ' |[LOG] - ';
    logLine += logObj.log + ' - ';
    logLine += '| on host: ' + logObj.host + ' |\n';

    console.log(logLine);
    log.write(logLine);
}

// this function is used to move trough the hosts array
function nextHost () {

    /* scrapper has finished  */
    if (currentPosition == config.hosts.length - 1){

        var logObj = {
            log: "Finished scrap for date: " + formatDate(ACTIVE_DATE),
            host: "~all~",
            date: new Date()
        }
        // build log
        buildLog(logObj);

        // close log
        log.close();

        return;
    }

    //call the next host
    scrapHost(config.hosts[++currentPosition]);
}

function buildFinalPagination (host, functions, callback) {

    // get the html from the core pages in order to extract the page number
    var core_pages = host.core_pages;
    var pageLength = core_pages.length;
    var pages = [];

    // create log
    var logObj = {
        log: 'Building pagination for host: ' + host.name,
        host: host.name,
        date: new Date()
    }
    // build log
    buildLog(logObj);

    // check if all requsets have been proceed
    function checkEnd () {

        // send pages if nothing left to be done
        if (!--pageLength) {
            callback(pages);
            return;
        }
    }

    for (var page in core_pages) {

        (function (page) {
            request(core_pages[page].url, function (error, response, html) {

                // handle error
                if (error || !html) {

                    var errObj = {
                        err: error,
                        url: core_pages[page].url,
                        host: host.name,
                        date: new Date()
                    }
                    // build the error log
                    buildError(errObj);

                    // scraper must keep going
                    checkEnd();
                } else {

                    // get the page number
                    functions.getPageNumbers(html, function (number) {
                        // handle error
                        if (!number){

                            var errObj = {
                                err: 'page number could not be established',
                                url: core_pages[page].url,
                                host: host.name,
                                date: new Date()
                            }
                            // build the error log
                            buildError(errObj);

                            // scraper must keep going
                            checkEnd();
                        } else {
                            //build the final pages
                            functions.buildPagination(number, core_pages[page].url, function (err, partialPagination) {

                                // handle error
                                if (err || !partialPagination.length) {

                                    var errObj = {
                                        err: 'partial pagination error',
                                        url: core_pages[page].url,
                                        host: host.name,
                                        date: new Date()
                                    }
                                    // build the error log
                                    buildError(errObj);

                                    // scraper must keep going
                                    checkEnd(); 
                                } else {
                                    for (var i in partialPagination) {
                                        pages.push({
                                            url: partialPagination[i],
                                            data: core_pages[page].data
                                        });
                                    }

                                    // when done send pages
                                    checkEnd(); 
                                }   
                            });
                        }
                    });
                }
            }).setMaxListeners(0);
        })(page);
    }
}

// core function that scrapes the hosts and gets their html
function scrapHost (host) {
    var hostFunctions = require(host.functions);

    // create log
    var logObj = {
        log: 'Scraping content from - ' + host.name,
        host: host.name,
        date: new Date()
    }
    // build log
    buildLog(logObj);

    // Initialize core pages
    host.core_pages = [];
    for (var page in host.map) {
        host.core_pages.push({
            url: host.url + '/' + host.map[page].url,
            data: host.map[page]
        });
    }
    itemsFound[host.name] = 0;

    // check the core_pages
    if (!host.core_pages.length) {

        var errObj = {
            err: 'error while building core pages',
            url: '',
            host: host.name,
            date: new Date()
        }
        // build the error log
        buildError(errObj);

        // keep the scraper going
        nextHost();
        return;
    }

    // build the url for the pages that are going to be scraped
    buildFinalPagination (host, hostFunctions, function (pages) {

        // check if the pages exist
        if (!pages.length) {

            var errObj = {
                err: 'pages missing',
                url: '',
                host: host.name,
                date: new Date()
            }
            // build the error log
            buildError(errObj);

            nextHost();
            return;
        }

        // create log
        var logObj = {
            log: 'Page number complete',
            host: host.name,
            date: new Date()
        }
        // build log
        buildLog(logObj);

        // request iterator
        var max_requests = pages.length;
        var current_request = 0

        function nextRequest () {

            if (current_request < max_requests - 1) {
                makeRequest(pages[++current_request]);
            } else {
                // create log
                var logObj = {
                    log: 'Done with - ' + host.name,
                    host: host.name,
                    date: new Date()
                }
                // build log
                buildLog(logObj);

                // create log
                var logObj = {
                    log: 'Found ' + itemsFound[host.name] + ' items for host: ' + host.name,
                    host: host.name,
                    date: new Date()
                }
                // build log
                buildLog(logObj);

                nextHost();
            }
        }

        // make the request for html
        function makeRequest (page) {

            // create log
            var logObj = {
                log: 'scraping from url: ' + page.url,
                host: host.name,
                date: new Date()
            }
            // build log
            buildLog(logObj);

            request(page.url, function (error, response, html) {

                // handle error
                if (error) {

                    var errObj = {
                        err: error,
                        url: page.url,
                        host: host.name,
                        date: new Date()
                    }
                    // build the error log
                    buildError(errObj);

                    // keep the scraper going
                    nextRequest();
                } else {
                    nextRequest();

                    // process the html
                    hostFunctions.getContent(html, host.map, function (data) {

                        if (data) {

                            // TODO check the object for corrupt data
                            
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
                            itemsFound[host.name] ++;

                            mongo.insert(db, 'scan_products', crudObj, function (err) {

                                // handle error
                                if (err) {

                                    var errObj = {
                                        err: err,
                                        url: page.url,
                                        host: host.name,
                                        date: new Date()
                                    }      
                                    // build the error log
                                    buildError(errObj);

                                    return;
                                }

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
                                mongo.update(db, 'mappings', crudObj, function (err) {

                                    if (err) {
                                        var errObj = {
                                            err: err,
                                            url: page.url,
                                            host: host.name,
                                            date: new Date()
                                        }      
                                        // build the error log
                                        buildError(errObj);

                                        return;
                                    }
                                });
                            });
                        } else {
                            // no data received error
                            var errObj = {
                                err: 'no data received',
                                url: page.url,
                                host: host.name,
                                date: new Date()
                            }
                            // build the error log
                            buildError(errObj);
                        }
                    });
                }
            });
        };

        // make the first request
        makeRequest(pages[0]);
    });
}

/****** CRON Job Core ******/

function cronJob (oldDate) {
    
    // oldDate + 1 day
    var date = new Date(oldDate.getTime() + (24 * 60 * 60 * 1000));

    var job = schedule.scheduleJob(date, function(){

        // init the log file
        log.filename = 'logs/scrap_log_' + formatDate(date) + '.txt';

        // create log
        var logObj = {
            log: "Started scrap for date: " + formatDate(date),
            host: "~all~",
            date: new Date()
        }
        // build log
        buildLog(logObj);

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
