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
  to: 'agnes.ekfors@hotmail.com',
  subject: 'SECURITY ALERT',
  text: 'Din app e knas bror'
});