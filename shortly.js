var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var bcrypt = require('bcrypt-nodejs');

var app = express();

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(partials());
  app.use(express.bodyParser())
  app.use(express.static(__dirname + '/public'));
  app.use(express.cookieParser('secretsarefun'));
  app.use(express.session());
});

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

app.get('/', restrict, function(req, res) {
   //check if session exists
    // res.render(index)
    // no redirect to login
  res.render('index');
});

app.get('/create', restrict, function(req, res) {
  res.render('index');
});

app.get('/links', restrict, function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  })
});

app.post('/links', function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/


app.post('/login', function(req, res) {
  // get username and password from browser
  var username = req.body.username;
  var password = req.body.password;
  // create hash from username and pw
  new User ({username: username}).fetch().then(function(found) {
    if (found) {
      var salt = found.attributes.password.slice(0, 29);
      var rehashed = bcrypt.hashSync(password, salt);

      if (rehashed === found.attributes.password) {
        req.session.regenerate(function(){
          req.session.user = username;
          console.log(req.session);
          res.redirect('/');
        });
      } else {
        console.log('login didnt work');
        res.redirect('/login');
      }
    } else {
      console.log('login didnt work');
      res.redirect('/login');
    }
  });
});

app.get('/logout', function(req, res){
  req.session.destroy(function(){
    res.redirect('/');
  });
});

app.get('/signup', function(req, res) {
  res.render('signup');
});

app.get('/login', function(req, res) {
  res.render('login');
});

app.post('/signup', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  // create hash from username and pw
  var salt = bcrypt.genSaltSync(10);
  var hash = bcrypt.hashSync(password, salt);
  new User({username: username}).fetch().then(function(found){
    if (found) {
      console.log('found already');
    } else {
      new User({username: username, password: hash}).save().then(function(user){
        console.log('didnt find, saved new user');
        console.log(hash);
      // create session
      // render(index)
      });
    }
  });
});


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
