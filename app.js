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
mongoose.connect(process.env.MONGODB_URI);
//mongoose.connect('mongodb://127.0.0.1/ncfmldata');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error: '));

var Users = require(path.join(__dirname, '/models/users'));

var World = require(path.join(__dirname, '/models/world'));
var Items = require(path.join(__dirname, '/models/items'));
var Maps = require(path.join(__dirname, '/models/map'));
var Messages = require(path.join(__dirname, '/models/messages'));
var Status = require(path.join(__dirname, '/models/status'));

// config
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// middleware
app.use(bodyParser.urlencoded({ extended: false }));

var sessionMiddleware = session({
  store: new FileStore(),
  resave: false, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  secret: process.env.SECRET
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

app.use('/', express.static(path.join(__dirname, 'public')));
//app.use('/images', restrict, express.static(path.join(__dirname, 'private/images')));
app.use('/private', restrict, express.static(path.join(__dirname, 'private')));
app.use('/admin', restrict_admin, express.static(path.join(__dirname, 'admin')));
app.use('/images', restrict_admin, express.static(path.join(__dirname, 'private/images')));

app.get('/logout', function(req, res){
  // destroy the user's session to log them out
  // will be re-created next request
  req.session.destroy(function(){
    res.redirect('/');
  });
});

app.get('/login', function(req, res){
  res.redirect('/login.html');
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
  res.redirect('/newuser.html');
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

app.post('/game', restrict, function(req, res) {
  new World({name: req.body.name}).save(function(err, world) {
    if (err) throw err;
    res.redirect(`/game?world=${world._id}&turn=${world.turn}`);
  });
});

app.get('/game', restrict, function(req, res) {
  if (req.query.world) {
    World.findOne().where('_id', req.query.world).exec(function(err, world) {
      if (world) {
        res.sendFile(path.join(__dirname, '/private/game.html'));
      } else {
        res.sendFile(path.join(__dirname, '/private/world.html'));
      }
    });
  } else {
    res.sendFile(path.join(__dirname, '/private/world.html'));
  }
});

io.sockets.on('connection', function(socket) {
  var name = socket.request.session.user.name;
  Users.findOne().where('name', name).exec( function(err, user) {
    console.log(user.truename + ' connected');

    function emitMessage(message, all_clients) {
      data = {
        world: message.world,
        turn: message.turn,
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

    socket.on('load_worlds', function(data) {
      socket.emit('username', user.truename);
      World.find().exec(function(err, worlds) {
        if (err) throw err;
        socket.emit('load_worlds', {worlds: worlds});
      });
    });

    socket.on('load_users', function(data) {
      Users.find().exec(function(err, users_list) {
        if (err) throw err;
        for (let user in users_list) {
          users_list[user].hash = "hidden";
          users_list[user].salt = "hidden";
        }
        socket.emit('load_users', users_list);
      });
    });

    socket.on('load_items', function(data) {
      Items.find({approved: true, world: data.world}).exec( function(err, items_list) {
        if (err) throw err;
        socket.emit('load_items', items_list);
      });
    });

    socket.on('load_all_items', function(data) {
      Items.find({world: data.world}).exec( function(err, items_list) {
        if (err) throw err;
        socket.emit('load_all_items', items_list);
      });
    });

    socket.on('load_messages', function(data) {
      Messages.find({world: data.world, turn: data.turn}).populate('user').sort({'_id': 1}).exec( function(err, messages) {
        if (err) throw err;
        for (let i = 0; i < messages.length; i++) {
          emitMessage(messages[i], false);
        }
      });
    });

    socket.on('load_map', function(data) {
      Maps.find({world: data.world, turn: data.turn}).populate('items.item').exec(function(err, tiles) {
        if (err) throw err;
        socket.emit('load_map', tiles);
      });
    });

    socket.on('message', function(data) {
      var newmessage = new Messages({
        world: data.world,
        turn: data.turn,
        user: user._id,
        message: data.message,
        parent: data.parent,
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

    // socket.on('load_admin', function(data) {
    //   Users.find().exec( function(err, users_list) {
    //     if (err) throw err;
    //     for (let user in users_list) {
    //       users_list[user].hash = "hidden";
    //       users_list[user].salt = "hidden";
    //     }
    //     socket.emit('load_users', users_list);
    //   });
    //   Items.find().exec( function(err, items_list) {
    //     if (err) throw err;
    //     socket.emit('load_items', items_list);
    //   });
    //   Maps.find().populate('items.item').exec( function(err, tiles) {
    //     if (err) throw err;
    //     socket.emit('load_map', tiles);
    //   });
    // });

    socket.on('new item', function(data) {
      console.log(data);
      var newitem = new Items({
        world: data.world,
        name: data.name,
        image: data.image,
        approved: false
      });
      newitem.save(function(err, item) {
        if (err) throw err;
        console.log('item saved', item);
        io.emit('server update');
      });
    });

    socket.on('approve_item', function(data) {
      Items.update({ _id: data.id }, { $set: { approved: data.approved }}, function(err, message) {
        if (err) throw err;
        io.emit('server update');
      });
    });

    socket.on('remove_item', function(data) {
      Items.remove({ _id: data.id }, function(err, message) {
        if (err) throw err;
        io.emit('server update');
      });
    });

    socket.on('change_chunk', function(data) {
      Items.find().exec( function(err, items_list) {
        if (err) throw err;
        var newdoc = {
          world: data.world,
          turn: data.turn,
          x: data.x,
          y: data.y,
          type: data.type,
          items: []
        };
        var items = JSON.parse(data.items)
        for (let i = 0; i < items.length; i++) {
          var current_item_id = "";
          for (let j = 0; j < items_list.length; j++) {
            if ((items_list[j].name == items[i].name) && (items_list[j].world == items[i].world)) {
              current_item_id = items_list[j]._id;
              break;
            }
          }
          if (current_item_id != "") {
            newdoc.items.push({
              item: current_item_id,
              number: items[i].number
            });
          }
        }
        Maps.update({ x: data.x, y: data.y}, newdoc, { upsert: true }, function(err, message) {
          if (err) throw err;
          io.emit('server update');
        });
      });
    });

    socket.on('disconnect', function(){
      console.log('user disconnected');
    });

    socket.emit('server update', {username: user.truename});
  });
});

server.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
})
