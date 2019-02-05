// errormailer works only in production mode
process.env.NODE_ENV = 'production';

var nodemailer = require('nodemailer');
var errormailer = require("../");
var connect = require("connect");

// Create a SMTP transport object
var transport = nodemailer.createTransport("Test", {
  service: 'Gmail', // use well known service
  auth: {
    user: process.env.agnes.ekfors.elvin,//Ändra
    pass: process.env.Mattfrans10
  }
});

console.log('SMTP Configured');

var errorHandler = errormailer(transport, {
  subject: "Testing errormailer!",
  to: "agnes.ekfors.elvin@gmail.com"
});

var funcErr = function(req, res) { throw new Error("AHAHH"); };

var app = connect().
  use(funcErr).
  use(errorHandler).
  use(connect.errorHandler({dumpException: true, showStack: true})).
  listen(process.env.PORT || 3000, 
         function() {
           console.log("ErrorMailer connect demo started at port 3000");
         });