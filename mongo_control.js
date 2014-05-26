var MongoClient = require('mongodb').MongoClient,
    format = require('util').format;

exports.connect = function (db, callback) {
    
    MongoClient.connect('mongodb://127.0.0.1:27017/' + db, function (err, db) {
        
        if (err) throw err;

        callback(db);

    });
}
exports.insert = function (db, collection_name, obj, callback) {
    
    //if not object throw err
    if (typeof obj.data !== 'object') { callback('data not an object'); return; }
    if (!db) { callback('no DB'); return; }

    //get the collection
    var collection = db.collection(collection_name);

    //insert the data
    collection.insert(obj.data, function (err, docs) {
        
        if (err) callback(err);

        // insert complete
        callback (null);
    });
}

exports.dropDatabase = function (db) {

    db.dropDatabase(function (err, done) {
        
        if (err) throw err;
    });
}

exports.update = function (db, collection_name, obj, callback) {

    if (!obj) { callback('no DATA!'); return; }
    if (!db) { callback('no DB'); return; }

    //get the collection
    var collection = db.collection(collection_name);

    //update the data
    collection.update(obj.query, obj.data, obj.options, function (err, docs) {

        if (err) callback(err);

        // update complete
        callback (null);
    });
}

exports.close = function (db) {
    
    //close the connection
    db.close();
}
