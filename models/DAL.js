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
    index: 'errorlogs',
    id: '1',
    type: 'posts',
    body: {
        "PostName": "Error Log",
        "PostType": "Log",
        "PostBody": "This is an Error Log.",
    }
}, function(err, resp, status) {
    console.log(resp);
});
*/
module.exports = {
clientsearcher: client.search({
    index: 'errorlogs',
    type: 'posts',
    q: 'PostType:Log'
}).then(function(resp) {
    console.log("test");
    if((resp.hits.max_score)!=null){
        //Fire Controller function
    }
}, function(err) {
    console.trace(err.message);
}),
};


