var fs = require('fs');
var elasticsearch = require('elasticsearch');

//Read the properties file and parse JSON into readable text
var readFile = fs.readFileSync('models/assets/properties.json', 'utf8');
var jsonContent = JSON.parse(readFile);

//Store the email to mail alerts to in a variable
var userEmail = jsonContent.email;



