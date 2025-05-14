const express = require('express');
const router = express.Router();
const { MongoClient, ServerApiVersion } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, "../.env") });

const uri = process.env.MONGO_CONNECTION_STRING;
const databaseName = "MusicRecs";
const users = "Users";
const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });

router.get("/", async (req, res) => {
    const { username, firstName } = req.session;
    if (!username) {
        return res.redirect("/");
    }

    await client.connect();
    const db = client.db(databaseName);
    const collection = db.collection(users);
    const user = await collection.findOne({ username });
    await client.close();

    const playlist = user?.playlist || [];
    res.render("playlist", { firstName, username, playlist });
});

router.post("/removeSong", async (req, res) => {
    const { username } = req.session;
    const { song, artist } = req.body;
    if (!username) {
        return res.redirect("/");
    }

    await client.connect();
    const db = client.db(databaseName);
    const collection = db.collection(users);

    await collection.updateOne(
        { username },
        { $pull: { playlist: { song: song, artist: artist } } }
    );
    await client.close();

    res.redirect("/playlist");
});

module.exports = router;
