var util = require('util'),
    cheerio = require('cheerio');

//look for promotions
exports.getContent = function (html, map, callback) { 

    if (!html) {
        callback(null);
        return;
    }

    // get the DOM
    var $ = cheerio.load(html);

    // get all required data
    var titles = $('form > h2 > a');
    var priceHolder = $('#pret2 .top .pret-produs-listing');
    var price = $('#pret2 .top .pret-produs-listing .price-over');
    var picture = $('form > div.poza-produs a span img');

    $(priceHolder).each(function (index, e) {
   
        if ($(e).children('span.old').text().length) {
            
            //get the raw data
            var title = $(titles[index]).text();
            title = title.replace('\n', '');
            title = title.trim();
            var priceFinal = $(price[index]).children('.money-int').text() + ',' + $(price[index]).children('.money-decimal').text() + ' RON';
            var priceOld = $(e).children('span.old');
            var priceOldFinal = $(priceOld).children('.money-int').text() + ',' + $(priceOld).children('.money-decimal').text() + ' RON';
            var img = $(picture[index]).attr('src');
            var link = $(titles[index]).attr('href');
    
            //build the partial object
            var data = {
                title: title,
                price: priceFinal,
                oldPrice: priceOldFinal,
                img: img,
                link: 'http://emag.ro' + link
            }

            //send the object
            callback(data);
        }
    });
}

//builds the pagination
exports.buildPagination = function (number, page, callback) {

    // get the root of the page url
    page = page.substring(0, page.length - 2);

    // init pagination
    var pagination = [];
    pagination.push(page);

    // build pagination
    for (var i = 2; i <= number; ++i) {
        pagination.push(page + '/p' + i + '/c');
    }

    callback(pagination);
}

//gets the number of pages of an item
exports.getPageNumbers = function (html, callback) {

    // get DOM
    var $ = cheerio.load(html);

    // finally, get the number of pages from the html
    var pageNumber = $('div.holder-pagini-2 span.pagini-2').text();
    var numberSplits = pageNumber.split(' ');
    var number = numberSplits[numberSplits.length - 1].substring(0, numberSplits[numberSplits.length - 1].length - 1);

    // send back the number found
    callback(parseInt(number));
}
