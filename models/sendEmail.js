var nodemailer = require('nodemailer');
var fs = require('fs');


var readProperties = fs.readFileSync('./assets/properties.json', 'utf8');
var jsonContent = JSON.parse(readProperties);


