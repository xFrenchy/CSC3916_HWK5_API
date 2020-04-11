var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');
//TODO: Review https://mongoosejs.com/docs/validation.html

mongoose.Promise = global.Promise;

//I got an error, had to add useUnifiedTopology : true. Something about deprecated something
mongoose.connect(process.env.DB, { useNewUrlParser: true, useUnifiedTopology : true } );
mongoose.set('useCreateIndex', true);

// review schema

var ReviewSchema = new Schema({
    name: {type: String, required: true},
    review_quote: {type: String, required: true},
    rating: {type: Number, required: true},
    movie_ID: {type: Number, required: true}
});

// return the model
module.exports = mongoose.model('Review', ReviewSchema);