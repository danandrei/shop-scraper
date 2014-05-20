var util = require('util'),
    cheerio = require('cheerio');

function constructOldPrice(text) {
    
    var oldPrice = '';
    for (var i = 0; i < text.length; ++i) {
        
        if ((!isNaN(text[i]) || text[i] === ',' || text[i] === '.') && text[i] !== '\n' && text[i] !== ' ') {
            oldPrice += text[i];

            if (text[i + 1] === ' ') {
                oldPrice += ' RON';
                return oldPrice;
            }
        }
    }
}

//look for promotions
exports.getContent = function (html, map, callback) { 

    if (!html) {
        callback(null);
        return;
    }
     
    // get DOM
    var $ = cheerio.load(html);

    var boxSpecs = $('div.product-box .pb-specs-container');
    var titles = $('div.product-box .pb-specs-container .pb-name a');
    var priceContainer = $('div.product-box .pb-price-container .pb-price');
    var picture = $('div.product-box .pb-image a img');

    if (!boxSpecs.length) {
        callback(null);
        return;
    }

    $(boxSpecs).each(function (index, e) {
        var extra = $(boxSpecs[index]).children('.pb-extra').text();
        if (extra.indexOf('Discount') > -1) {
            
            //get the raw data
            var title = $(titles[index]).text();
            title = title.replace('\n', '');
            title = title.trim();
            var oldPrice = $(boxSpecs[index]).find('.pbe-price-old').text();
            var priceFinal = $(priceContainer[index]).children('.price').text();
            var img = $(picture[index]).attr('src');
            var link = $(titles[index]).attr('href');
    
            //build the partial object
            var data = {
                title: title,
                price: priceFinal,
                oldPrice: oldPrice,
                img: img,
                link: link
            }

            //send the object
            callback(data);
        }
    });
}

//builds the pagination
exports.buildPagination = function (number, page, callback) {

    // handle bad input
    if (!number || !page || typeof page !== 'string') {
        callback('bad input', null);
    }

    // init pagination
    var pagination = [];

    // build pagination
    for (var i = 1; i <= number; ++i) {
        pagination.push(page + '/pagina' + i);
    }

    callback(null, pagination);
}

//gets the number of pages of an item
exports.getPageNumbers = function (html, callback) {

    // get DOM
    var $ = cheerio.load(html);

    var pageContainer = $('div.lr-pagination ul');
    var pageAnchor = $(pageContainer).children('li').last();

    var pageText = $(pageAnchor).children('a').attr('href');

    var pageNumber = '';
    for (var i = 0; i < pageText.length; ++i) {
        if (!isNaN(pageText[i])) {
            pageNumber += pageText[i];

            if (pageText[i + 1] === '/') {
                callback(parseInt(pageNumber));
            }
        }
    }
}
