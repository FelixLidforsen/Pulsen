//Declare dependencies and variables
var fs = require('fs');
var elasticsearch = require('elasticsearch');
var nodemailer = require('nodemailer');
var dateAndTime = new Date();
var responseObject;
var errorLogIDs = [];
var elasticQueryData = [];
var newLogs;

//Method and Variable for reading login information
var readFile = fs.readFileSync('./models/assets/loginCredentials.json', 'utf8');
var jsonContent = JSON.parse(readFile);

//Method and Variable for reading properties file
var readProperties = fs.readFileSync('./models/assets/properties.json', 'utf8');
var jsonContent2 = JSON.parse(readProperties);

//Create a client for connecting to Elastisearch and read host information from loginCredentials
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

//Set interval to repeat alertsAlot
setInterval(alertsAlot, 10000);

function alertsAlot(){

//Execute Query for error logs in elasticsearch
client.search({
    index: 'log',
    type: 'doc',
    q: 'level:ERROR'
}).then(function(resp){
    //Check if the query found something 
    if (resp.hits.max_score != null && resp.hits.total != 0){
        console.log("AlertsAlot found an error log");
        responseObject = resp;
        
        //Declare an empty array and add all id:s found in the query
        var elasticQueryIDs = [];
        resp.hits.hits.forEach(element => {
            elasticQueryIDs.push(element._id);
        });

        //Run compareArrays()
        //If the contents of the arrays do not match: add and save the found id:s. Then trigger sendMail()
        //Declare newLogs as the new number of logs
        if (compareArrays(elasticQueryIDs, errorLogIDs) == false){
            newLogs = elasticQueryIDs.length - errorLogIDs.lengths;
            resp.hits.hits.forEach(element => {
                errorLogIDs.push(element._id);
                errorLogIDs.filter(onlyUnique);
            })

            if(resp.hits.total <= 20){
                //If the number of found elements is below or equal 20
                //Loop through the array of found objects and add to array
                resp.hits.hits.forEach(element => {
                elasticQueryData = [];
                elasticQueryData.push("--Start of file-- \n"); 
                elasticQueryData.push(JSON.stringify(element._source));
                elasticQueryData.push("\n--End of file--");
            });
            }else{
                elasticQueryData = [];
                elasticQueryData.push("//The number of found logs exceeds 20. \n //Displaying individual log messages disabled.")
            };
            console.log("A new error log ID has been found. Sending a mail");
            mailService();
        }else{
            console.log("Found error logs with a previously alerted ID. A mail has not been sent");
        };
        
        //compareArrays()
        //Takes the values of both arrays, filter and sorts them.
        //Compares the sorted arrays and returns a boolean
        function compareArrays(elasticQueryIDs, errorLogIDs){
        elasticQueryIDs.map( function (x){ return x._id; } ).filter(onlyUnique).sort();
        errorLogIDs.map( function (x){ return x._id; } ).filter(onlyUnique).sort();
        return (elasticQueryIDs.join(',') == errorLogIDs.join(','));
        };

        //onlyUnique()
        //Filters the array to only unique values
        function onlyUnique(value, index, self) { 
            return self.indexOf(value) === index;
        }

    }else{
        console.log("No Error logs found");
    }
}, 
    //If the query returns an error
    function(err) {
    console.log("An error occured while executing a query in Elasticsearch. The following row contains trace information..")
    console.trace(err.message);
});
};

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
    
    //Define message options
    //User information can be pulled from properties file using jsonContent2.xxx
    var message = {
      from: "pulsen@erikgullberg.se",
      to: jsonContent2.email,
      subject: "AlertsAlot: Error log(s) found!!",
      text: "Hello " + jsonContent2.name + ". \n"
      + "AlertsAlot has detected " + newLogs + " error log(s). \n"
      + "The log(s) were found on " + dateAndTime + ". \n"
      + "The log(s) contain(s) the following data: \n"
      + elasticQueryData + "\n"
      + "Please check your elasticsearch database."
    };
    
    //Send the mail using the transporter and message
    transporter.sendMail(message);

};


