require("./utils.js");

require('dotenv').config();
const express = require('express'); 
const session = require('express-session'); 
const MongoStore = require('connect-mongo');
// Input validation
const Joi = require("joi"); 
const bcrypt = require('bcrypt');
const saltRounds = 12;

const app = express();  

app.use(express.urlencoded({extended: false}));

const expireTime = 1 * 60 * 60 * 60; //expires after 1 hour, time is stored in milliseconds  (hours * minutes * seconds * millis)

/* secret information section */
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;

const node_session_secret = process.env.NODE_SESSION_SECRET;

var {database} = include('databaseConnection');

const userCollection = database.db(mongodb_database).collection('users');

var mongoStore = MongoStore.create({
	mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/test`,
  crypto: {
		secret: mongodb_session_secret
	}
});

app.use(session({ 
      secret: node_session_secret,
      store: mongoStore, //default is memory store 
      saveUninitialized: false, 
      resave: true
  }
  ));

const port = process.env.PORT || 8020;

app.get('/', (req, res) => {
    if (req.session.loggedIn) {
      res.send(`
        <h1>Hello, ${req.session.name}</h1>
        <a href="/members"><button>View Member's Area</button></a>
        <br>
        <a href="/logout"><button>Log Out</button></a>
      `);
    } else {
      res.send(`
        <a href="/login"><button>Log In</button></a>
        <br>
        <a href="/signup"><button>Sign Up</button></a>
      `);
    }
  });

app.get('/signup', (req,res) => {
    var html = `
    create user
    <br>
    <form action='/submitUser' method='post'>
    <input name='username' type='text' placeholder='username' required>
    <br>
    <input name ='email' type='text' placeholder='email' required>
    <br>
    <input name='password' type='password' placeholder='password' required>
    <br>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});

app.post('/submitUser', async (req,res) => {
  var username = req.body.username;
  var password = req.body.password;
  
  if(username == "" || password == "") {
    res.redirect("/signUp?blank=true");
    return;
  }

  const schema = Joi.object(
    {
      username: Joi.string().alphanum().max(20).required(),
      password: Joi.string().max(20).required()
    }
  );

  const validationResult = schema.validate({username, password});

  if (validationResult.error != null) {
    console.log(validationResult.error);
    res.redirect("/signUp?invalid=true");
    return;
  }
  
  var hashedPassword = await bcrypt.hash(password, saltRounds);
	
  await userCollection.insertOne({username: username, password: hashedPassword});
  console.log("Inserted user");

  var html = "successfully created user";
  res.send(html);
});

app.get('/login', (req,res) => {
    var html = `
    log in
    <form action='/loggingin' method='post'>
    <input name='username' type='text' placeholder='username'>
    <input name='password' type='password' placeholder='password'>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});

app.post('/loggingin', async (req,res) => {
  var username = req.body.username;
  var password = req.body.password;

  if(username == "" || password == "") {
    res.redirect("/login?blank=true");
    return;
  }

  const schema = Joi.string().max(20).required();
  const validationResult = schema.validate(username);
  if (validationResult.error != null) {
    console.log(validationResult.error);
    res.redirect("/login?invalid=true");
    return;
  }

  const result = await userCollection.find({
    username: username
  }).project({username: 1, password: 1, _id: 1}).toArray();
  console.log(result);

  if(result.length != 1) {
    console.log("user not found");
    res.redirect("/login?incorrect=true");
    return;
  }

  // check if password matches for the username found in the database
  if (await bcrypt.compare(password, result[0].password)) {
    console.log("correct password");
    req.session.authenticated = true;
    req.session.username = username;
    req.session.cookie.maxAge = expireTime;

    res.redirect('/loggedIn');
  } else {
    //user and password combination not found
    res.redirect("/login?incorrect=true");
  }
});

app.get('/loggedIn', (req,res) => {
  if (!req.session.authenticated) {
      res.redirect('/login');
      return;
  }
  var html = `
  You are logged in!
  `;
  res.send(html);
});

app.get('/sloth/:id', (req,res) => {

    var sloth = req.params.id;

    if (sloth == 1) {
        res.send("Enjoy: <img src='/flower.gif' style='width:250px;'>");
    }
    else if (sloth == 2) {
        res.send("Hmmmm...: <img src='/slothm.gif' style='width:250px;'>");
    }
    else {
        res.send("Invalid sloth id: "+sloth);
    }
});

app.use(express.static(__dirname + "/img"));

// Below is a catch all that takes one to a 404 page. 
app.get("*", (req,res) => {
	res.status(404);
	res.send("Page not found - 404");
})

app.listen(port, () => {
    console.log(`Node application listening on port: ${port}`);
});