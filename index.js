//Declare dependencies
var fs = require('fs');
var elasticsearch = require('elasticsearch');
var nodemailer = require('nodemailer');
var dateAndTime = new Date();
var responseObject;
var errorLogIDs = [];
var newLogs;
var elasticQueryData = [];

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
    //Code below triggers if something was found 
    if (resp.hits.max_score != null && resp.hits.total != 0){
        console.log("AlertsAlot found an error log");
        responseObject = resp;
        
        //Declare an empty array and add all id:s found in the query
        var elasticQueryIDs = [];
        resp.hits.hits.forEach(element => {
            elasticQueryIDs.push(element._id);
        });

        resp.hits.hits.forEach(element => {
           elasticQueryData.push("--Start of file-- \n"); 
           elasticQueryData.push(JSON.stringify(element._source));
           elasticQueryData.push("\n--End of file--");
        });


        //Run compareArrays()
        //If the contents of the arrays do not match: add and save the found id:s. Then trigger sendMail()
        //Declare newLogs as the new number of logs
        if (compareArrays(elasticQueryIDs, errorLogIDs) == false){
            newLogs = parseInt(responseObject.hits.total) - errorLogIDs.length
            resp.hits.hits.forEach(element => {
                errorLogIDs.push(element._id);
            })
            console.log("A new error log ID has been found. Sending a mail");
            mailService();
        }else{
            console.log("Found error logs with a previously alerted ID. A mail has not been sent");
        };
        
        //compareArrays()
        //Take the values of both arrays and sort them.
        //Compare the sorted arrays and return a boolean
        function compareArrays(elasticQueryIDs, errorLogIDs){
        elasticQueryIDs.map( function (x){ return x._id; } ).sort();
        errorLogIDs.map( function (x){ return x._id; } ).sort();
        return (elasticQueryIDs.join(',') == errorLogIDs.join(','));
        };

    }else{
        console.log("No Error logs found");
    }
}, function(err) {
    console.log("An error occured while executing a query in Elasticsearch. The following row contains trace information..")
    console.trace(err.message);
});

//Function to create and send mail using Nodemailer.
//Running this function immediatly sends a mail to the end user
//Do NOT loop this function too frequently!
function mailService(){

    //Create a transport for Nodemailer using SMTP
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
    //Parameters can be pulled from properties file using jsonContent2.xxx
    var message = {
      from: "pulsen@erikgullberg.se",
      to: jsonContent2.email,
      subject: "AlertsAlot: Error log(s) found!!",
      text: "Hello " + jsonContent2.name + ". \n \n"
      + "AlertsAlot has detected " + newLogs + " error log(s). \n"
      + "The log(s) were found on " + dateAndTime + ". \n"
      + "The log(s) contain(s) the following data: \n"
      + elasticQueryData + "\n"
      + "Please check your elasticsearch database."
    };
    
    //Send the mail using the transporter and message
    transporter.sendMail(message);

};


