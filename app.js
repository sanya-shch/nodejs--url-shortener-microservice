const express = require("express");
const mongo = require("mongodb");
const mongoose = require("mongoose");
const shortid = require('shortid');
const bodyParser = require("body-parser");
const dns = require("dns");
const cors = require("cors");

const app = express();

const PORT = 5000;


const schema = new mongoose.Schema({
    original_url: String,
    short_url: String
});

const Link = mongoose.model("Link", schema);


app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));

app.use("/public", express.static(process.cwd() + "/public"));

app.get("/", function(req, res) {
    res.sendFile(process.cwd() + "/views/index.html");
});

app.post("/api/shorturl/new", async function(req, res) {
    const url = req.body.url;
    console.log(url);
    const dnsLookup = new Promise(function(resolve, reject) {
        const result = url.replace(/(^\w+:|^)\/\//, "");
        dns.lookup(result, function(err, addresses, family) {
            if (err) reject(err);
            resolve(addresses);
        });
    });

    dnsLookup
        .then(function() {
            return checkIfExists(url);
        })
        .then(function(data) {
            if (data.status) {
                return res.json({ original_url: url, short_url: data.short_url });
            } else {
                const shortUrl = shortid.generate();
                const urlMapping = new Link({
                    original_url: url,
                    short_url: shortUrl
                });
                return saveUrlMapping(urlMapping)
                    .then(function() {
                    return res.json({ original_url: url, short_url: shortUrl });
                });
            }
        })
        .catch(function(reason) {
        return res.json({ error: "invalid URL" });
    });
});

app.get("/api/shorturl/:shortUrl", function(req, res) {
    const redirectPromise = redirectToOriginalUrl(req.params.shortUrl);
    redirectPromise.then(function(original_url) {
        return res.redirect(original_url);
    });
    redirectPromise.catch(function(reason) {
        return res.json({ error: "invalid URL" });
    });
});

function redirectToOriginalUrl(short_url) {
    return new Promise(function(resolve, reject) {
        Link.findOne({ short_url: short_url }, function(err, doc) {
            if (err || doc === null) return reject(err);
            else return resolve(doc.original_url);
        });
    });
}

function checkIfExists(original_url) {
    return new Promise(function(resolve, reject) {
        Link.findOne({ original_url: original_url }, function(err, doc) {
            if (doc === null || err) resolve({ status: false });
            else resolve({ status: true, short_url: doc.short_url });
        });
    });
}

function saveUrlMapping(mapping) {
    return new Promise(function(resolve, reject) {
        mapping.save(function(err, data) {
            if (err) return reject(err);
            else return resolve(null, data);
        });
    });
}

(async function start(){
    try {
        await mongoose.connect("*********************************************", {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            useCreateIndex: true
        });

        app.listen(PORT, () => console.log('App has been started...'));
    } catch (e) {
        console.log('Server Error', e.message);
        process.exit(1);
    }
})();
