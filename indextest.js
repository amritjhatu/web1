require("./utils.js");

require('dotenv').config();
const express = require('express'); 
const session = require('express-session'); 
const MongoStore = require('connect-mongo');
//Input Validation
const Joi = require("joi"); 
const bcrypt = require('bcrypt');
const saltRounds = 12;

const port = process.env.PORT || 8020;

const app = express();

const expireTime = 1 * 60 * 60 * 1000; //expires after 1 day  (hours * minutes * seconds * millis)

/* secret information section */
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;

const node_session_secret = process.env.NODE_SESSION_SECRET;
/* END secret section */

var {database} = include('databaseConnection');

const userCollection = database.db(mongodb_database).collection('users');

app.use(express.urlencoded({extended: false}));

var mongoStore = MongoStore.create({
	mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/test`,
	crypto: {
		secret: mongodb_session_secret
	}
})

app.use(session({ 
    secret: node_session_secret,
      store: mongoStore, //default is memory store 
      saveUninitialized: false, 
      resave: true
  }
  ));

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

app.get('/nosql-injection', async (req,res) => {
	var username = req.query.user;

	if (!username) {
		res.send(`<h3>no user provided - try /nosql-injection?user=name</h3> <h3>or /nosql-injection?user[$ne]=name</h3>`);
		return;
	}
	console.log("user: "+username);

	const schema = Joi.string().max(20).required();
	const validationResult = schema.validate(username);

	//If we didn't use Joi to validate and check for a valid URL parameter below
	// we could run our userCollection.find and it would be possible to attack.
	// A URL parameter of user[$ne]=name would get executed as a MongoDB command
	// and may result in revealing information about all users or a successful
	// login without knowing the correct password.
	if (validationResult.error != null) {  
	   console.log(validationResult.error);
	   res.send("<h1 style='color:darkred;'>A NoSQL injection attack was detected!!</h1>");
	   return;
	}	

	const result = await userCollection.find({username: username}).project({username: 1, password: 1, _id: 1}).toArray();

	console.log(result);

    res.send(`<h1>Hello ${username}</h1>`);
});

app.get('/about', (req,res) => {
    var color = req.query.color;

    res.send("<center><h1 style='color:"+color+";'>Amrit Singh</h1></center>");
});

app.get('/contact', (req,res) => {
    var missingEmail = req.query.missing;
    var html = `
        email address:
        <form action='/submitEmail' method='post'>
            <input name='email' type='text' placeholder='email'>
            <button>Submit</button>
        </form>
    `;
    if (missingEmail) {
        html += "<br> email is required";
    }
    res.send(html);
});

app.post('/submitEmail', (req,res) => {
    var email = req.body.email;
    if (!email) {
        res.redirect('/contact?missing=1');
    }
    else {
        res.send("Thanks for subscribing with your email: "+email);
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

app.post('/submitUser', async (req,res) => {
    var username = req.body.username;
    var password = req.body.password;

	const schema = Joi.object(
		{
			username: Joi.string().alphanum().max(20).required(),
			password: Joi.string().max(20).required()
		});
	
	const validationResult = schema.validate({username, password});
	if (validationResult.error != null) {
	   console.log(validationResult.error);
	   res.redirect("/createUser");
	   return;
   }

    var hashedPassword = await bcrypt.hash(password, saltRounds);
	
	await userCollection.insertOne({username: username, password: hashedPassword});
	console.log("Inserted user");

    var html = "successfully created user";
    res.send(html);
});

app.post('/loggingin', async (req,res) => {
    var username = req.body.username;
    var password = req.body.password;

	const schema = Joi.string().max(20).required();
	const validationResult = schema.validate(username);
	if (validationResult.error != null) {
	   console.log(validationResult.error);
	   res.redirect("/login");
	   return;
	}

	const result = await userCollection.find({username: username}).project({username: 1, password: 1, _id: 1}).toArray();

	console.log(result);
	if (result.length != 1) {
		console.log("user not found");
		res.redirect("/login");
		return;
	}
	if (await bcrypt.compare(password, result[0].password)) {
		console.log("correct password");
		req.session.authenticated = true;
		req.session.username = username;
		req.session.cookie.maxAge = expireTime;

		res.redirect('/loggedIn');
		return;
	}
	else {
		console.log("incorrect password");
		res.redirect("/login");
		return;
	}
});

app.get('/loggedin', (req,res) => {
    if (!req.session.authenticated) {
        res.redirect('/login');
    }
    var html = `
    You are logged in!
    `;
    res.send(html);
});

app.get('/logout', (req,res) => {
	req.session.destroy();
    var html = `
    You are logged out.
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
	console.log("Node application listening on port "+port);
}); 