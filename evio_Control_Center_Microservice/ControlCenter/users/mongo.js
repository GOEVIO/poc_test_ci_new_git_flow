var User = require('./../../models/user');
require("dotenv-safe").load();

function mongocontroller() {

    const addmongoUser = function (user) {
        var context = "Function addmongoUser";

        return new Promise((resolve, reject) => {
            User.findOne({ email: user.email })
                .exec((err, doc) => {
                    if (err) {
                        console.log(`[${context}] Error `, err);
                        return res.send(err);
                    }
                    if (doc) {
                        //return reject(new Error('Email ' + user.email + ' is already registered'));
                        return reject({ auth: false, code: 'server_email_taken', message: 'Email ' + user.email + ' is already registered' });
                    };


                    var newUser = new User(user);
                    newUser.password = undefined;

                    User.createUser(newUser, function (err, resUser) {
                        if (err) {
                            console.log(`[${context}][createUser] Error `, err);
                            return reject(new Error(err));
                        };
                        resUser.password = user.password;
                        let encriptedPassword = User.getEncriptedPassword(resUser.password)
                        resUser.password = encriptedPassword;
                        resolve(resUser);
                    });
                });
        });
    };

    const deletemongoUser = function (user) {
        var context = "Function deletemongoUser";
        return new Promise((resolve, reject) => {
            User.deleteUserByEmail(user.email, function (err, user) {
                if (err) {
                    console.log(`[${context}] Error `, err);
                    return reject(new Error(err));
                };
                resolve("User deleted");
            });
        });
    };

    return { addmongoUser, deletemongoUser };

};

module.exports = mongocontroller;