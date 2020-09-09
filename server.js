const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const moment = require('moment')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.DB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

/** this project needs to parse POST bodies **/
// you should mount the body-parser here
app.use(bodyParser.urlencoded({extended: false}));

// CODE STARTS HERE
// Create a new Schema with mongoose to represent a user in the database
var User = mongoose.model("User", new mongoose.Schema({
  username: String,
  log: [{
    description: String,
    duration: Number,
    date: String
  }]
}));

// POST for new username
app.post("/api/exercise/new-user", (req, res) => {
  var username = req.body.username;
  User.find({username: username}).exec(async (err, data) => {
    if (err) throw err;
    else {
      if (data.length === 0) { // If username doesn't exist, create new username
        var newUser = new User({username: username, log: []});
        var newUserData = await newUser.save();
        res.json({username: newUserData.username, _id: newUserData._id});
      } else { // Else indicate that the username already exists
        res.json({error: "Username already exists"});
      }
    }
  });
});

// GET for retrieving array of usernames
app.get("/api/exercise/users", (req, res) => {
  User.find({},'username _id').exec((err, data) => {
    res.json(data);
  });
});

// POST for new exercise
app.post("/api/exercise/add", (req, res) => {
  var userId = req.body.userId;
  var description = req.body.description;
  var duration = req.body.duration;
  var date = req.body.date;

  User.findById(userId).exec((err, data) => {
    if (err) {
      res.json({"logging attempt": "invalid user id"});
    }
    else {
      if (!data) res.json({"logging attempt": "user does not exist"});
      else {
        if (!description) res.json({"logging attempt": "missing description"});
        else if (!duration || isNaN(duration)) res.json({"logging attempt": "missing duration or input is invalid; must be a number"});
        else {
          // Converting date, whether or not it exists, to proper format
          let formattedDate;
          if (moment(date, "YYYY-MM-DD", true).format() === "Invalid date") {
            formattedDate = moment().format('ddd MMM DD YYYY')
          }
          else formattedDate = moment(date, "YYYY-MM-DD").format('ddd MMM DD YYYY');
          
          // Create the exercise record that will show up on the log
          var exerciseRecord = {
            description: description,
            duration: duration,
            date: formattedDate
          };

          // Update the user with the new log information
          User.findByIdAndUpdate(userId, {$push: {log: exerciseRecord}}, {new: true}).exec((err, data) => {
            if (err) throw err;
          });

          let username = data.username;
          let _id = userId;
          
          // Respond with a json relaying the required parameters
          res.json({
            username,
            description: description,
            duration: parseInt(duration),
            _id,
            date: formattedDate
          })
        }
      }
    }
  })
});

app.get("/api/exercise/log", (req, res) => {
  var userId, fromDate, toDate, limit;

  // CHECKPOINT - consider the format of the submitted date + step 6
  userId = req.query.userId;
  fromDate = req.query.fromDate;
  toDate = req.query.toDate;
  limit = req.query.limit;
  if (userId) {
    User.findById(userId).exec((err, data) => {
      if (err) throw res.json({"yes": "no"});
      console.log(data);
      let log = data.log;
      if (fromDate) {
        log = log.filter(item => moment(item.date).isAfter(fromDate));
      }
      if (toDate) {
        log = log.filter(item => moment(item.date).isBefore(toDate));
      }
      if (limit) {
        log = log.slice(0,limit);
      }
      res.json({
        _id: data._id,
        username: data.username,
        log,
        count: log.length
      });
    })
  } else {
    res.json({error: "userId query required /api/exercise/log?userId=[_id]"})
  }
})


// CODE ENDS HERE

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
