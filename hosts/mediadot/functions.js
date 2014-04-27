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

        var titles = $('.product_box .description h2 a');
        var price = $('.product_box div.price');
        var picture = $('div.product_box div.image img');
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

        $(price).each(function (index, e) {
            var priceInside = $(e).text();
            if (priceInside.indexOf('vechi') >= 0) {
                
                //get the raw data
                var title = $(titles[index]).text();
                title = title.replace('\n', '');
                title = title.trim();
                var oldPrice = constructOldPrice($(e).text());
                var price = $(e).children('span.price').text();
                var img = $(picture[index]).attr('src');
                img = img.replace('thumbnails', 'full');
                var link = $(titles[index]).attr('href');
        
                //build the partial object
                var data = {
                    title: title,
                    price: price,
                    oldPrice: oldPrice,
                    img: img,
                    link: 'http://mediadot.ro' + link,
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
    console.log(number, page);
    for (var i = 1; i <= number; ++i) {
        pagination.push(page + '/pagina' + i);
    }

    callback(pagination);
}

//gets the number of pages of an item
exports.getPageNumbers = function (agent, callback) {
    env(agent.body, function (err, window) {

        if (err) {
            console.log(err);
            callback(null);
            return;
        }

        var $ = require('jquery')(window);
    
        var pageAnchor = $('div.paginatie a');
        callback(parseInt($(pageAnchor).last().text()));
    });
}
