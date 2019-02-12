//Declare dependencies
var fs = require('fs');
var elasticsearch = require('elasticsearch');
var response;

//Method and Variable for reading login information
var readFile = fs.readFileSync('./models/assets/loginCredentials.json', 'utf8');
var jsonContent = JSON.parse(readFile);

//Method and Variable for reading properties file
var readProperties = fs.readFileSync('./models/assets/properties.json', 'utf8');
var jsonContent2 = JSON.parse(readProperties);

//Create a client for connecting to Elastisearch and read host information from properties
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

//Execute Query for error logs in elasticsearch
client.search({
    index: 'errorlogs',
    type: 'posts',
    q: 'PostType:Log'
}).then(function(resp){ 
    if (resp.hits.max_score != null && resp.hits.total != 0){
        console.log("I found an error log");
    }else{
        console.log("No Error logs found");
    }
}, function(err) {
    console.log("An error occured while executing a query in Elasticsearch. The following row contains trace information..")
    console.trace(err.message);
});


