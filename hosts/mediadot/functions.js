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

    var titles = $('.product_box .description h2 a');
    var price = $('.product_box div.price');
    var picture = $('div.product_box div.image img');

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
                link: 'http://mediadot.ro' + link
            }

            //send the object
            callback(data);
        }
    });
}

//builds the pagination
exports.buildPagination = function (number, page, callback) {

    // init pagination
    var pagination = [];

    // build the pagination
    for (var i = 1; i <= number; ++i) {
        pagination.push(page + '/pagina' + i);
    }

    callback(pagination);
}

//gets the number of pages of an item
exports.getPageNumbers = function (html, callback) {
    
    // Get DOM
    var $ = cheerio.load(html);

    var pageAnchor = $('div.paginatie a');
    callback(parseInt($(pageAnchor).last().text()));

}
