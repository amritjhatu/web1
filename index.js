const express = require("express");

const {MongoClient} = require("mongodb")

async function main() {
    const url = "mongodb+srv://demo:8NlO3m7qpDNcEbXu@cluster0.8a7065p.mongodb.net/?retryWrites=true&w=majority";

    const client = new MongoClient(uri);

    await client.connect();
}

const app = express();

const port = process.env.PORT || 8020;

const node_session_secret = "5fc2e924-75ac-474b-bcec-a22908b0a50c";

app.use(session{(
    secret: node_session_secret,
    // store: mongoStore, // default is memory store
    saveUninitialized: false;
    resave: true
)
});

var numPageHits = 0;

app.get('/', {req,res} => {
    if (req.session.numPageHits == null) {
        req.session.numPageHits = 0;
    }
    numPageHits++
    res.send("You have visited this page these times:" +numePageHits);
});

app.listen(PORT, {} => {
    console.log("Node application listening on port: " +port);
});