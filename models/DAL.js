var fs = require('fs');
var elasticsearch = require('elasticsearch');

var readFile = fs.readFileSync('assets/loginCredentials.json', 'utf8');
var jsonContent = JSON.parse(readFile);

//Create a client for connecting to Elastisearch
var client = new elasticsearch.Client({
   hosts: [ jsonContent.hosts ]
});

//Ping the server to check connection
client.ping({
    requestTimeout: 30000,
}, function(error) {
    if (error) {
        console.error('elasticsearch cluster is down!');
    } else {
        console.log('Connection established sucessfully');
    }
});

//Acessible Queries
/*
client.index({
    index: 'blog',
    id: '1',
    type: 'posts',
    body: {
        "PostName": "Integrating Elasticsearch Into Your Node.js Application",
        "PostType": "Tutorial",
        "PostBody": "This is the text of our tutorial about using Elasticsearch in your Node.js application.",
    }
}, function(err, resp, status) {
    console.log(resp);
});
*/

client.search({
    index: 'logs',
    type: 'posts',
    q: 'PostName:Node.js'
}).then(function(resp) {
    console.log(resp);
}, function(err) {
    console.trace(err.message);
});