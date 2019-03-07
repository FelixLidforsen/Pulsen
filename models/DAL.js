var fs = require('fs');
var elasticsearch = require('elasticsearch');
var controller = require('../controllers/controller.js');


var responseObject;
var readFile = fs.readFileSync('../models/assets/loginCredentials.json', 'utf8');
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
client.index({

                index: "log",
                type: "doc",
                id: "a2e68ea94c543757a01d26cfd1a475439eb159a7d0d52ba63bb639c6f8980cc1",
                body: {
                    id: "Server2",
                    text: "debug1",
                    version: "1",
                    level: "DEBUG",
                    timestamp: "2019-02-18T11:00:08.775Z",
                    date: "2018-01-16T08:06:29.858+01:00",
                    message: "[Server2] [DEBUG] [2018-01-16T08:06:29.858+01:00] - debug1"
                }
            }



);

module.exports = {
clientsearcher: client.search({
    index: 'errorlogs',
    type: 'posts',
    q: 'PostType:Log'
}).then(function(resp){
    responseObject = resp;
    function sendResponse(responseObject){
        controller.responseReader(responseObject);
    }    
}), 
};


