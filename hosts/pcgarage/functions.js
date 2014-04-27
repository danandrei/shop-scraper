var util = require('util'),
    url = require('url'),
    httpAgent = require('http-agent'),
    jsdom = require('jsdom').jsdom;
var env = require('jsdom').env

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
exports.getContent = function (agent, map, callback) { 

    if (!agent) {
        callback(null);
        return;
    }
    
    env(agent.body, function (err, window) {

        if (err) {
            callback(null);
            console.log(err);
            return;
        }    
        var $ = require('jquery')(window);

        console.log('now on url : ' + agent.host + '/' + agent.url);

        var boxSpecs = $('div.product-box .pb-specs-container');
        var titles = $('div.product-box .pb-specs-container .pb-name a');
        var priceContainer = $('div.product-box .pb-price-container .pb-price');
        var picture = $('div.product-box .pb-image a img');
        var itemClass;
        var subclass;
        var classId;
        var subclassId;

        for (var item in map) {
            if (agent.url.indexOf(map[item].url) >= 0) {
                itemClass = map[item]['class'];
                subclass = map[item].subclass;
                classId = map[item].class_id;
                subclassId = map[item].subclass_id;
                break;
            }
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
                    link: link,
                    subclass: subclass,
                    class_id: classId,
                    subclass_id: subclassId
                }
                data['class'] = itemClass;

                //send the object
                callback(data);
            }
        });
    });
}

//builds the pagination
exports.buildPagination = function (number, page, callback) {
    var pagination = [];
    for (var i = 1; i <= number; ++i) {
        pagination.push(page + '/pagina' + i);
    }

    callback(pagination);
}

//gets the number of pages of an item
exports.getPageNumbers = function (agent, callback) {
    env(agent.body, function (err, window) {

        if (err) {
            callback(null);
            console.log(err);
            return;
        }

        var $ = require('jquery')(window);
    
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

        callback(1);
    });
}
