var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authJwtController = require('./auth_jwt');
var User = require('./Users');
var Movie = require('./Movies'); //I added this to make my own schema for movies in that file
var Review = require('./Reviews');
var jwt = require('jsonwebtoken');
var cors = require('cors');
const crypto = require("crypto");
var rp = require('request-promise');

var app = express();
module.exports = app; // for testing
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();
const GA_TRACKING_ID = process.env.GA_KEY;

function trackDimension(category, action, label, value, dimension, metric) {
    var options = { method: 'GET',
        url: 'https://www.google-analytics.com/collect',
        qs:
            {   // API Version.
                v: '1',
                // Tracking ID / Property ID.
                tid: GA_TRACKING_ID,
                // Random Client Identifier. Ideally, this should be a UUID that
                // is associated with particular user, device, or browser instance.
                cid: crypto.randomBytes(16).toString("hex"),
                // Event hit type.
                t: 'event',
                // Event category.
                ec: category,
                // Event action.
                ea: action,
                // Event label.
                el: label,
                // Event value.
                ev: value,
                // Custom Dimension
                cd1: dimension,
                // Custom Metric
                cm1: metric
            },
        headers:
            {  'Cache-Control': 'no-cache' } };
    return rp(options);
}


router.route('/test')
    .get(function (req, res) {
        // Event value must be numeric.
        trackDimension('Feedback', 'Rating', 'Feedback for Movie', '5', 'Guardians of the Galaxy 2', '1')
            .then(function (response) {
                console.log(response.body);
                res.status(200).send('Event tracked.').end();
            })
    });


router.route('/postjwt')
    .post(authJwtController.isAuthenticated, function (req, res) {
            console.log(req.body);
            res = res.status(200);
            if (req.get('Content-Type')) {
                console.log("Content-Type: " + req.get('Content-Type'));
                res = res.type(req.get('Content-Type'));
            }
            res.send(req.body);
        }
    );

router.route('/users/:userId')
    .get(authJwtController.isAuthenticated, function (req, res) {
        var id = req.params.userId;
        User.findById(id, function(err, user) {
            if (err) res.send(err);

            var userJson = JSON.stringify(user);
            // return that user
            res.json(user);
        });
    });

router.route('/users')
    .get(authJwtController.isAuthenticated, function (req, res) {
        User.find(function (err, users) {
            if (err) res.send(err);
            // return the users
            res.json(users);
        });
    });

router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, message: 'Please pass username and password.'});
    }
    else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;
        // save the user
        user.save(function(err) {
            if (err) {
                // duplicate entry
                if (err.code == 11000)
                    return res.json({ success: false, message: 'A user with that username already exists. '});
                else
                    return res.send(err);
            }

            res.json({ success: true, message: 'User created!' });
        });
    }
});

router.post('/signin', function(req, res) {
    var userNew = new User();
    //userNew.name = req.body.name;
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) res.send(err);

        user.comparePassword(userNew.password, function(isMatch){
            if (isMatch) {
                var userToken = {id: user._id, username: user.username};
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json({success: true, token: 'JWT ' + token});
            }
            else {
                res.status(401).send({success: false, message: 'Authentication failed. Username/Password is wrong'});
            }
        });


    });
});

router.route('/movies/:reviews?')
    .post(authJwtController.isAuthenticated, function (req, res) {
        //Figure out if post needs jwt
        //If there is a tittle, there exists a year released, there exists a genre
        if (req.body.title && req.body.year_released && req.body.genre){
            //check if the actor name array and character name array are at least of size 3
            //https://stackoverflow.com/questions/15209136/how-to-count-length-of-the-json-array-element    <- find length of json array
          if(Object.keys(req.body.actor_name).length < 3 || Object.keys(req.body.character_name).length < 3){
              res.json({success: false, message: 'actor name and character name array needs to contain at least 3 items'});
            }
          else {
              //length is greater than 3, time to save the movie
              var movies = new Movie();
              //enter all the data in the movie schema
              movies.title = req.body.title;
              movies.year_released = req.body.year_released;
              movies.genre = req.body.genre;
              movies.actor_name = req.body.actor_name;
              movies.character_name = req.body.character_name;
              movies.movie_ID = req.body.movie_ID;
              if(req.body.movie_URL) {
                  movies.movie_URL = req.body.movie_URL;
              }
              else{
                  movies.movie_URL = "https://www.indiaspora.org/wp-content/uploads/2018/10/image-not-available.jpg"
              }
              //try to save the movie schema into our database
              movies.save(function (err) {
                  if (err) {
                      return res.send(err);
                  }
                  else {
                      res.status(200).send({
                          status: 200,
                          msg: 'movie saved',
                          headers: req.headers,
                          query: req.query,
                          env: process.env.UNIQUE_KEY
                      });
                  }
              });
          }
        }
        else{
            res.json({success: false, message: 'Please pass title, year_released, genre, and actors.'});
        }
    })
    .get(authJwtController.isAuthenticated, function (req, res) {
        if(req.query.reviews && req.query.moviename === undefined){
            //In here I want to retrieve all movies that have a review attached to them
            // That means every single movie that has an ID
            // Let's try to make aggregate work
            Movie.aggregate()
                .match({movie_ID: {$gte: 1}})
                .lookup({from: 'reviews', localField: 'movie_ID', foreignField: 'movie_ID', as: 'reviews'})
                .exec(function (err, movie) {
                    res.send(movie);
                })
        }
        else {
            //https://stackoverflow.com/questions/33028273/how-to-get-mongoose-to-list-all-documents-in-the-collection-to-tell-if-the-coll
            Movie.find(function (err, result) {
                if (err) {
                    return res.send(err);
                } else {
                    if (req.query.moviename) {
                        //find the movie that matches
                        let jsonToSend;
                        var movieJson;
                        var reviewJson;
                        var movie_found = false;
                        for (let i = 0; i < result.length; ++i) {
                            if (req.query.moviename === result[i]._doc.title) {
                                //store the result from the match
                                movieJson = result[i]._doc;
                                movie_found = true;
                                break;  //break out of for loop hopefully
                            }
                        }
                        //check if we need to find the reviews for it as well
                        if (movie_found === false) {
                            res.send("No movies exists with that title!");
                            return;
                        }
                        //jsonToSend = movieJson;
                        if (req.query.reviews === "true") {
                            Review.find(function (err, result) {
                                if (err) {
                                    return res.send(err);
                                } else {
                                    var review_found = false;
                                    for (let i = 0; i < result.length; ++i) {
                                        if (movieJson.movie_ID === result[i]._doc.movie_ID) {
                                            reviewJson = result[i]._doc;
                                            review_found = true;
                                            break;
                                        }
                                    }
                                    //reviewJson either has a review or no review exists for that movie
                                    if (review_found) {
                                        jsonToSend = Object.assign(movieJson, reviewJson);
                                    } else {
                                        var tempJson = {"msg": "No reviews found for this movie!"};
                                        jsonToSend = Object.assign(movieJson, tempJson);
                                    }
                                    res.send(jsonToSend);
                                }
                            })
                        } else {
                            //if not, simply display that specific movie
                            res.send(movieJson);
                        }
                    } else {
                        //no specific movie, display them all
                        res.send(result);
                    }
                }
            });
        }
        //res.send(Movie.find());
        //res.status(200).send({status: 200, msg: 'GET movies', headers: req.headers, query: req.query, env: process.env.UNIQUE_KEY, result: find_result});
    })
    .put(authJwtController.isAuthenticated, function (req, res) {
        if(Object.keys(req.body.updatingJson).length == 2){
            var movie_arrray = req.body.updatingJson;
            var movie_title = movie_arrray[0].title;
          Movie.findOne({title: movie_title}, function (err, result) {
              if (err) {
                  return res.send(err);
              }
              else{
                  if(result == null){
                      res.send("No matches found!");
                  }
                  else{
                      result.title = req.body.new_title;
                      //https://stackoverflow.com/questions/40466323/mongoose-model-update-only-update-provided-values
                      Movie.update({title: movie_title}, movie_arrray[1], function (err, raw) {
                          if(err){
                              res.send(err);
                          }
                          res.send("Movie succefully updated");
                      });
                  }
              }
          })
        }
        else{
            res.send("Please enter a title to search for and a new title to replace it with");
        }
        //res.status(200).send({status: 200, msg: 'movie updated', headers: req.headers, query: req.query, env: process.env.UNIQUE_KEY});
    })
    .delete(authJwtController.isAuthenticated, function(req,res){
        if(req.body.title){
            Movie.deleteOne({title: req.body.title}, function (err, raw) {
                if(err){
                    res.send(err);
                }
                res.send("Movie succefully deleted! Bye movie :(");
            });
        }
        else{
            res.send("Please enter a title to search for");
        }
        //res.status(200).send({status: 200, msg: 'movie deleted', headers: req.headers, query: req.query, env: process.env.UNIQUE_KEY});
    })
    .all(function (req, res) {
        res.status(405).send({msg: 'this method is not supported'});
    });

router.route('/review')
    .post(authJwtController.isAuthenticated, function(req, res){
        if(req.body.name && req.body.review_quote && req.body.rating && req.body.movie_ID){
            //if a name and review quote and rating exists
            //having a hard time making the find function tell me if it exists or not without me looking at what it finds
            //https://mongoosejs.com/docs/api.html#model_Model.find
            Movie.find({movie_ID : parseInt(req.body.movie_ID)}, null, function (err, docs) {
                if(docs.length > 0) {
                    //there is a match
                    var review = new Review();
                    review.name = req.body.name;
                    review.review_quote = req.body.review_quote;
                    review.rating = req.body.rating;
                    review.movie_ID = req.body.movie_ID;
                    trackDimension(docs[0]._doc.genre, 'post/review', 'POST', review.rating, docs[0]._doc.title, '1')
                    review.save(function (err) {
                        if (err) {
                            return res.send(err);
                        } else {
                            res.status(200).send({
                                status: 200,
                                msg: 'review saved',
                                headers: req.headers,
                                query: req.query,
                                env: process.env.UNIQUE_KEY
                            });
                        }
                    });
                }
                else{
                    res.status(400).send({success: false, message: 'movie_ID does not match any movies in the database'});
                }
            });
        }
        else{
            res.status(400).send({success: false, message: 'Please include name, review_quote, rating, and movie_ID'});
        }
    })
    .get(function(req,res){
        Review.find(function (err, result) {
            if (err) {
                return res.send(err);
            }
            else{
                res.send(result);
            }
        });
    })
    .all(function (req, res) {
        res.status(405).send({msg: 'this method is not supported'});
    });


app.use('/', router);
console.log("http://localhost:8080/test");
app.listen(process.env.PORT || 8080);
