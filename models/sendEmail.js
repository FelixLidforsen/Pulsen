var fs = require('fs');
var readme = fs.readFileSync('readme.txt', 'utf8');

var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: { 
        user: 'pulsenfelrapport@gmail.com',
        pass: 'slagthuset'
    }
});

console.log('created');
transporter.sendMail({
from: 'pulsenfelrapport@gmail.com',
  to: readme,
  subject: 'SECURITY ALERT',
  text: 'Ett fel har inträffat'
});