const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io').listen(server);

const bodyParser = require('body-parser');
const hash = require('pbkdf2-password')();
const path = require('path');
const session = require('express-session');
var FileStore = require('session-file-store')(session);

app.set('port', (process.env.PORT || 5000));
//const fs = require('fs');

// set up Mongoose connection
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://'+process.env.MG_USER+":"+process.env.MG_PASS+"@"+process.env.MG_HOST+":"+process.env.MG_PORT+"/"+process.env.MG_DB);
//mongoose.connect('mongodb://127.0.0.1/ncfmldata');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error: '));

var Items = require(path.join(__dirname, '/models/items'));
var Map = require(path.join(__dirname, '/models/map'));
var Users = require(path.join(__dirname, '/models/users'));
var Messages = require(path.join(__dirname, '/models/messages'));

// config
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// middleware
app.use(bodyParser.urlencoded({ extended: false }));

var sessionMiddleware = session({
  store: new FileStore(),
  resave: false, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  secret: 'StrokeEnsureExpoBrokers'
});

io.use(function(socket, next) {
  sessionMiddleware(socket.request, socket.request.res, next);
});

app.use(sessionMiddleware);

// Session-persisted message middleware
app.use(function(req, res, next){
  var err = req.session.error;
  var msg = req.session.success;
  delete req.session.error;
  delete req.session.success;
  res.locals.message = '';
  if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
  if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
  next();
});

function authenticate(name, pass, fn) {
  if (!module.parent) console.log('authenticating %s', name);
  var query = Users.findOne(null);
  query.where('name', name.toLowerCase());
  query.exec( function(err, user) {
    if (err) return fn(err);
    if (!user) return fn(new Error('cannot find user'));
    // apply the same algorithm to the POSTed password, applying
    // the hash against the pass / salt, if there is a match we
    // found the user
    hash({ password: pass, salt: user.salt }, function (err, pass, salt, hash) {
      if (err) return fn(err);
      if (hash == user.hash) return fn(null, user);
      fn(new Error('invalid password'));
    });
  });
}

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

function restrict_admin(req, res, next) {
  if (req.session.user) {
    if (req.session.user.admin === true) {
      next();
    } else {
      req.session.error = 'Not an Admin!';
      res.redirect('/game');
    }
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/game');
  }
}

app.get('/', function(req, res){
  res.redirect('/game');
});

app.use('/images', restrict, express.static(path.join(__dirname, 'public/images')));
app.use('/game', restrict, express.static(path.join(__dirname, 'public')));
app.use('/admin', restrict_admin, express.static(path.join(__dirname, 'admin')));

app.get('/logout', function(req, res){
  // destroy the user's session to log them out
  // will be re-created next request
  req.session.destroy(function(){
    res.redirect('/');
  });
});

app.get('/login', function(req, res){
  res.render('login');
});

app.post('/login', function(req, res){
  authenticate(req.body.username, req.body.password, function(err, user){
    if (user) {
      // Regenerate session when signing in
      // to prevent fixation
      req.session.regenerate(function(){
        // Store the user's primary key
        // in the session store to be retrieved,
        // or in this case the entire user object
        req.session.user = user;
        req.session.success = 'Authenticated as ' + user.truename
          + ' click to <a href="/logout">logout</a>. '
          + ' You may now access <a href="/game">/game</a>.';
        res.redirect('/game');
      });
    } else {
      req.session.error = 'Authentication failed, please check your '
        + ' username and password.';
      res.redirect('/login');
    }
  });
});

app.get('/newuser', function(req, res){
  res.render('newuser');
});

app.post('/newuser', function(req, res){
  var username = req.body.username;
  hash({ password: req.body.password }, function (err, pass, salt, hash) {
    if (err) throw err;
    var newuser = new Users({
      name: username.toLowerCase(),
      truename: username,
      salt: salt,
      hash: hash
    });
    newuser.save(function(err) {
      if (err) throw err;
      console.log('New user ' + username + ' created successfully!');
    });
    req.session.success = 'User ' + username + ' created';
    res.redirect('/login');
  });
});

io.sockets.on('connection', function(socket) {
  var name = socket.request.session.user.name;
  Users.findOne().where('name', name).exec( function(err, user) {
    console.log(user.truename + ' connected');

    function emitMessage(message, all_clients) {
      data = {
        timestamp: message._id.getTimestamp(),
        author: message.user.truename,
        message: message.message,
        parent: message.parent,
        checked: message.checked,
        id: message._id
      }
      if (all_clients) {
        io.emit('message', data);
      } else {
        socket.emit('message', data);
      }
    }

    socket.on('init', function(data) {
      Items.find({approved: true}).exec( function(err, items_list) {
        if (err) throw err;
        Users.find().exec( function(err, users_list) {
          if (err) throw err;
          for (let user in users_list) {
            users_list[user].hash = "hidden";
            users_list[user].salt = "hidden";
          }
          socket.emit('init', {
            username: user.truename,
            users: users_list,
            items: items_list
          });
          Messages.find().populate('user').sort({'_id': 1}).exec( function(err, messages) {
            if (err) throw err;
            for (let i = 0; i < messages.length; i++) {
              emitMessage(messages[i], false);
            }
          });
        });
      });
    });

    socket.on('message', function(input) {
      var newmessage = new Messages({
        user: user._id,
        message: input.message,
        parent: input.parent,
        checked: false
      });
      newmessage.save(function(err, message) {
        if (err) throw err;
        Messages.findOne().where("_id", message._id).populate('user').exec( function(err, message) {
          if (err) throw err;
          emitMessage(message, true);
        });
      });
    });

    socket.on('load_admin', function(data) {
      Users.find().exec( function(err, users_list) {
        if (err) throw err;
        for (let user in users_list) {
          users_list[user].hash = "hidden";
          users_list[user].salt = "hidden";
        }
        socket.emit('load_users', users_list);
      });
      Items.find().exec( function(err, items_list) {
        if (err) throw err;
        socket.emit('load_items', items_list);
      });
    });

    socket.on('new item', function(data) {
      var newitem = new Items({
        name: data.name,
        image: data.image,
        approved: false
      });
      newitem.save(function(err, message) {
        if (err) throw err;
        io.emit('server update');
      });
    });

    socket.on('approve_item', function(data) {
      Items.update({ _id: data.id }, { $set: { approved: data.approved }}, function(err, message) {
        if (err) throw err;
        io.emit('server update');
      });
    });

    socket.on('disconnect', function(){
      console.log('user disconnected');
    });

    socket.emit('server update');
  });
});

server.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
})
