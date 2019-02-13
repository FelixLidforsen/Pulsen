//Declare dependencies
var fs = require('fs');
var elasticsearch = require('elasticsearch');
var nodemailer = require('nodemailer');

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
        console.error('Could not connect to Elasticsearch!');
    } else {
        console.log('Connection established sucessfully!');
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
        mailService();
    }else{
        console.log("No Error logs found");
    }
}, function(err) {
    console.log("An error occured while executing a query in Elasticsearch. The following row contains trace information..")
    console.trace(err.message);
});

//Function to send mail
function mailService(){

    //Create a transport for Nodemailer
    var transporter = nodemailer.createTransport({
      host: "send.one.com",
      port: 587,
      secure: false,
      auth: {
        user:"pulsen@erikgullberg.se",
        pass:"felix123"
      }
    });
    
    //Define Message options
    //Parameters can be pulled from properties file using jsonContent.xxx
    var message = {
      from: "pulsen@erikgullberg.se",
      to: jsonContent2.email,
      subject: "Alert! Error found!",
      text: "Hello " + jsonContent2.name + " AlertsAlot has detected an error log."
    };
    
    //Send the mail using the transporter and message
    //Running this function immeadiatly sned a mail to the end user
    //Do NOT loop this function too frequently!
    transporter.sendMail(message);

};


