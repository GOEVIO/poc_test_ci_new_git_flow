require("dotenv-safe").load();
const nodemailer = require("nodemailer");

module.exports = {
    sendEmailFromSupportFiles: function (emailTo, fileBuffers, fileNames, subject) {
        var context = "Function sendEmailFromSupportFiles";
        try {
            this.sendEmailFiles(process.env.EMAIL_USER, process.env.EMAIL_PASSWORD, emailTo, fileBuffers, fileNames, subject)
        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
        }
    },
    sendEmailFromSupportText: function (emailTo, subject, text) {
        var context = "Function sendEmailFromSupportText";
        try {
            this.sendEmailText(process.env.EMAIL_USER, process.env.EMAIL_PASSWORD, emailTo, subject, text)
        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
        }
    },
    sendEmailFromSupport: function (emailTo, fileBuffers, fileNames, subject, text, emailcc) {
        var context = "Function sendEmailFromSupport";
        try {
            this.sendEmail(process.env.EMAIL_USER, process.env.EMAIL_PASSWORD, emailTo, fileBuffers, fileNames, subject, text, emailcc)
        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
        }
    },
    sendEmailFiles: function (emailFrom, emailFromPassword, emailTo, fileBuffers, fileNames, subject) {
        var context = "Function sendEmailFiles";
        try {
            this.sendEmail(emailFrom, emailFromPassword, emailTo, fileBuffers, fileNames, subject, "", [])
        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
        }
    },
    sendEmailText: function (emailFrom, emailFromPassword, emailTo, subject, text) {
        var context = "Function sendEmailText";
        try {
            this.sendEmail(emailFrom, emailFromPassword, emailTo, [], [], subject, text, [])
        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
        }
    },
    sendEmail: function (emailFrom, emailFromPassword, emailTo, fileBuffers, fileNames, subject, text, emailcc) {
        var context = "Function sendEmail";
        try {
            let attachmentsFiles = []

            parseAttchments(fileBuffers, fileNames, attachmentsFiles)

            var transporter = nodemailer.createTransport({
                maxConnections: 2,
                maxMessages: 1,
                pool: true,
                host: 'smtp.office365.com',
                port: 587,
                auth: {
                    user: emailFrom,
                    pass: emailFromPassword
                }
            });

            var mailOptions = {
                source: emailFrom,
                from: emailFrom,
                to: emailTo,
                bcc: emailcc, 
                subject: subject,
                text: text,
                attachments:
                    attachmentsFiles
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log(error);
                } else {
                    console.log('Email sent!');
                };
            });
        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
        }
    }
};

function parseAttchments(fileBuffers, fileNames, attachments) {
    var context = "Function parseAttchments";
    try {

        for (let i = 0; i != fileBuffers.length; i++) {
            attachments.push(
                {
                    filename: fileNames[i],
                    content: fileBuffers[i],
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                }
            )
        }
    }
    catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}