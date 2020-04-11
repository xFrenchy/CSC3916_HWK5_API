var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');
//TODO: Review https://mongoosejs.com/docs/validation.html

mongoose.Promise = global.Promise;

//I got an error, had to add useUnifiedTopology : true. Something about deprecated something
mongoose.connect(process.env.DB, { useNewUrlParser: true, useUnifiedTopology : true } );
mongoose.set('useCreateIndex', true);

// movie schema

var MovieSchema = new Schema({
    title: {type: String, required: true},
    year_released: {type: String, required: true},
    genre: {type: String, required: true},
    actor_name: {type: Array, required: true},
    character_name: {type: Array, required: true},
    movie_ID: {type: Number, required: true}
});

// using the built-in save function and simply displaying a message
// MovieSchema.save(function(next) {
//     if (err) return next(err);
//     console.log("Saving movie...");
// });


// return the model
module.exports = mongoose.model('Movie', MovieSchema);