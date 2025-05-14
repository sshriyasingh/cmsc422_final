const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config({
    path: path.resolve(__dirname, ".env"),
});

const app = express();
const portNumber = 5001;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(
    session({
        resave: true,
        saveUninitialized: false,
        secret: "secret",
    })
);

app.set("view engine", "ejs");
app.set("views", path.resolve(__dirname, "templates"));
app.use("/style.css", express.static(path.resolve(__dirname, "style.css")));

const uri = process.env.MONGO_CONNECTION_STRING;
const databaseName = "MusicRecs";
const users = "Users";

const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });

app.listen(portNumber, () => {
    console.log(`Server started at http://localhost:${portNumber}`);
});

const route = require("./routes/playlist");
app.use("/playlist", route);

app.get("/", (req, res) => {
    res.render("login", { message: "" });
});

app.post("/processLogin", async (req, res) => {
    const { username, password } = req.body;
    await client.connect();
    const db = client.db(databaseName);
    const collection = db.collection(users);
    const user = await collection.findOne({ username, password });
    await client.close();

    if (user) {
        req.session.username = username;
        req.session.firstName = user.firstName;
        req.session.save();
        res.redirect("/recommendations");
    } else {
        res.render("login", { message: "Login Failed. Invalid username or password." });
    }
});

app.get("/createAccount", (req, res) => {
    res.render("createAccount", { message: "" });
});

app.post("/processCreateAccount", async (req, res) => {
    const { firstName, username, password } = req.body;
    await client.connect();
    const db = client.db(databaseName);
    const collection = db.collection(users);
    const existing = await collection.findOne({ username });
    let message = "";

    if (existing) {
        message = "Username already exists.";
    } else {
        await collection.insertOne({ firstName, username, password, playlist: [] });
        message = "Account created successfully!";
    }

    await client.close();
    res.render("createAccount", { message });
});

app.get("/recommendations", (req, res) => {
    const { username, firstName, recommendations, song, artist, message } = req.session;

    if (!req.session.username) {
        return res.redirect("/");
    }

    res.render("recommendations", {firstName: req.session.firstName, username: req.session.username, recommendations: recommendations || [], song: song || "", artist: artist || "", message: message || ""});
    req.session.message = "";
    req.session.save();
});

app.post("/recommendations", async (req, res) => {
    const { song, artist } = req.body;
    const apiKey = process.env.LASTFM_API_KEY;
    const apiUrl = `https://ws.audioscrobbler.com/2.0/?method=track.getsimilar&track=${encodeURIComponent(song)}&artist=${encodeURIComponent(artist)}&api_key=${apiKey}&format=json`;
    let recommendations = [];
    let message = "";
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.similartracks && data.similartracks.track.length > 0) {
        recommendations = data.similartracks.track.slice(0, 10).map(track => ({
            name: track.name,
            artist: track.artist?.name || ""
        }));
    } else {
        message = `No recommendations found for "${song}" by "${artist}".`;
    }

    req.session.recommendations = recommendations;
    req.session.song = song;
    req.session.artist = artist;
    req.session.message = message;
    req.session.save();
    res.redirect("/recommendations");
});

app.post("/saveSong", async (req, res) => {
    const { song, artist } = req.body;
    const username = req.session.username;
    if (!username) {
        return res.redirect("/");
    }
    await client.connect();
    const db = client.db(databaseName);
    const collection = db.collection(users);
    await collection.updateOne(
        { username },
        { $addToSet: { playlist: { song: song, artist: artist } } }
    );
    await client.close();
    req.session.message = `Added "${song}" by "${artist}" to your playlist!`;
    req.session.save();
    res.redirect("/recommendations");
});

app.post("/logout", (req, res) => {
    req.session.destroy(() => {
        res.render("logout");
    });
});