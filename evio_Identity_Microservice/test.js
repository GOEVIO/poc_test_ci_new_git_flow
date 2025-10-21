var nodemailer = require('nodemailer');

sendEmail("diogokarvalho_8@hotmail.com", 12345, "Diogo Carvalho");

function sendEmail(email, id, name, res) {
  var transporter = nodemailer.createTransport({
    host: 'smtp.live.com',
    port: '25',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  var mailOptions = {
    source: '"evio Support" <support@go-evio.com>',
    from: '"evio Support" <support@go-evio.com>', // sender address
    to: email,
    subject: 'Validate Email',
    text: 'Validate Email', // plaintext body
    html: '<h2>Thanks for signing up to evio solution!</h2>' +
      '<h3>To get started, click the link below to confirm your account.</h3>' +
      '<a href="http://85.88.143.237:80/account/confirm-email/' + id + '/' + name + '">Confirm your account</a>'
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
      //return res.status(500).send(error);
    } else {
      console.log('Email sent: ' + info.response);
      //return res.status(200).send({ auth: true, code:'server_email_sent', message: "Email successfully sent" });
    }
  });
}