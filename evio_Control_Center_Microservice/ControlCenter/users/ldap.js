var ldapjs = require('ldapjs');
const global = require('../../global');

const uuidv4 = require('uuid/v4');
require("dotenv-safe").load();


function ldapcontroller() {

    const ldapOptions = {
        url: global.ldap_connection,
        timeout: 30000,
        connectTimeout: 30000,
        reconnect: true
    };

    const addldapUser = function (user) {
        var context = "Function addldapUser";
        return new Promise((resolve, reject) => {

            const ldapClient = ldapjs.createClient(ldapOptions);
            let newUser;
            try {
                newUser = {
                    givenName: user.name,
                    cn: user.name,
                    mobile: user.internationalPrefix + user.mobile,
                    sn: user.name,
                    mail: user.email,
                    userPassword: user.password,
                    objectClass: ["person", "organizationalPerson", "inetOrgPerson"]

                };
                console.log(newUser)
                ldapClient.bind(
                    process.env.ldap_admin_user,
                    process.env.ldap_admin_password,
                    (err) => {
                        if (err) {
                            console.log(`[${context}][ldapClient.bind] Error `, err.message);
                            return reject(new Error(err));
                        };

                        ldapClient.add(
                            'uid=' + user.email + "_controlcenter" + ',' + process.env.ldap_domain,
                            newUser,
                            (err, response) => {
                                if (err) {
                                    console.log(`[${context}] [ldapClient.add] Error `, err.message);
                                    return reject(err);
                                }
                                return resolve(user);
                            }
                        );
                    }
                )
            } catch (err) {
                console.log(`[${context}] Error `, err.message);
                return reject(err);
            };
        });
    };

    const updateldapUser = function (user) {
        var context = "Function updateldapUser";
        return new Promise((resolve, reject) => {
            const ldapClient = ldapjs.createClient(ldapOptions);
            // var changeUser;
            try {
                ldapClient.bind(
                    process.env.ldap_admin_user,
                    process.env.ldap_admin_password,
                    (err) => {
                        if (err) {
                            console.log(`[${context}][ldapClient.bind] Error `, err.message);
                            return reject(new Error(err));
                        };
                        ldapClient.modify('uid=' + user.email + "_controlcenter" + ',' + process.env.ldap_domain,
                            [
                                new ldapjs.Change({
                                    operation: 'replace',
                                    modification: {
                                        userPassword: user.password
                                    }
                                })
                            ],
                            (err) => {
                                if (err) {
                                    console.log(`[${context}][ldapClient.modify] Error `, err.message);
                                    reject(err);
                                };
                                return resolve(true);
                            }
                        );
                    }
                )
            } catch (err) {
                console.log(`[${context}] Error `, err.message);
                return reject(err);
            };
        });
    };

    const updateldapNameEmail = function (user , oldEmail) {
        var context = "Function updateldapNameEmail";
        return new Promise((resolve, reject) => {
            const ldapClient = ldapjs.createClient(ldapOptions);
            // var changeUser;
            try {
                ldapClient.bind(
                    process.env.ldap_admin_user,
                    process.env.ldap_admin_password,
                    (err) => {

                        if (err) {
                            console.log(`[${context}][ldapClient.bind] Error `, err.message);
                            return reject(new Error(err));
                        };
                        ldapClient.modify('uid=' + oldEmail + "_controlcenter" + ',' + process.env.ldap_domain,
                            [
                                new ldapjs.Change({
                                    operation: 'replace',
                                    modification: {
                                        mail: user.email
                                    }
                                }),
                                new ldapjs.Change({
                                    operation: 'replace',
                                    modification: {
                                        givenName: user.name
                                    }
                                }),
                                new ldapjs.Change({
                                    operation: 'replace',
                                    modification: {
                                        cn: user.name
                                    }
                                }),
                                new ldapjs.Change({
                                    operation: 'replace',
                                    modification: {
                                        sn: user.name
                                    }
                                })
                            ],
                            (err) => {
                                if (err) {
                                    console.log(`[${context}][ldapClient.modify] Error `, err.message);
                                    reject(err);
                                } else {
                                    ldapClient.modifyDN('uid=' + oldEmail + "_controlcenter" +  ',' + process.env.ldap_domain,
                                        'uid=' + user.email + "_controlcenter" +  ',' + process.env.ldap_domain,
                                        (err) => {
                                            if (err) {
                                                console.log(`[${context}][ldapClient.modifyDN] Error `, err.message);
                                                ldapClient.modify('uid=' + oldEmail + "_controlcenter" +  ',' + process.env.ldap_domain,
                                                    [
                                                        new ldapjs.Change({
                                                            operation: 'replace',
                                                            modification: {
                                                                mail: oldEmail
                                                            }
                                                        })
                                                    ]
                                                );
                                                reject(err);
                                            };
                                            return resolve(true);
                                        }
                                    );
                                }
                            }
                        );
                    }
                )
            } catch (err) {
                console.log(`[${context}] Error `, err.message);
                return reject(err);
            };
        });
    };

    const updateldapName = function (user) {
        var context = "Function updateldapName";
        return new Promise((resolve, reject) => {
            const ldapClient = ldapjs.createClient(ldapOptions);
            // var changeUser;
            try {
                ldapClient.bind(
                    process.env.ldap_admin_user,
                    process.env.ldap_admin_password,
                    (err) => {

                        if (err) {
                            console.log(`[${context}][ldapClient.bind] Error `, err.message);
                            return reject(new Error(err));
                        };
                        ldapClient.modify('uid=' + user.email + "_controlcenter" + ',' + process.env.ldap_domain,
                            [
                                new ldapjs.Change({
                                    operation: 'replace',
                                    modification: {
                                        givenName: user.name
                                    }
                                }),
                                new ldapjs.Change({
                                    operation: 'replace',
                                    modification: {
                                        cn: user.name
                                    }
                                }),
                                new ldapjs.Change({
                                    operation: 'replace',
                                    modification: {
                                        sn: user.name
                                    }
                                })
                            ],
                            (err) => {
                                if (err) {
                                    console.log(`[${context}][ldapClient.modify] Error `, err.message);
                                    reject(err);
                                };
                                return resolve(true);
                            }
                        );
                    }
                )
            } catch (err) {
                console.log(`[${context}] Error `, err.message);
                return reject(err);
            };
        });
    };

    const getUsers = function (user) {
        var context = "Function getUsers";
        return new Promise((resolve, reject) => {
            const ldapClient = ldapjs.createClient(ldapOptions);
            // 1
            ldapClient.bind(
                process.env.ldap_admin_user,
                process.env.ldap_admin_password,
                err => {
                    if (err) {
                        console.log(`[${context}][ldapClient.bind] Error `, err.message);
                        return reject(err);
                    };
                    // 2
                    let options = {
                        attributes: [
                            "cn",
                            "userPassword"
                        ],
                        scope: "sub",
                        filter: "(uid=915287800)"
                    };

                    // 3
                    ldapClient.search(process.env.ldap_domain, options, (err, res) => {
                        if (err) return reject(err);
                        let entries = [];
                        res.on('searchEntry', function (entry) {
                            var r = entry.object;
                            entries.push(r);
                        });

                        res.on('error', function (err) {
                            console.log(`[${context}][on] Error `, err.message);
                            reject(err);
                        });

                        res.on('end', function (result) {
                            resolve(entries);
                        });
                    });
                }
            );
        });
    };

    const updateMobielldapUser = function (user) {
        var context = "Function updateMobielldapUser";
        return new Promise((resolve, reject) => {
            const ldapClient = ldapjs.createClient(ldapOptions);
            try {
                ldapClient.bind(
                    process.env.ldap_admin_user,
                    process.env.ldap_admin_password,
                    (err) => {

                        if (err) {
                            console.log(`[${context}][ldapClient.bind] Error `, err.message);
                            return reject(new Error(err));
                        };
                        ldapClient.modify('uid=' + user.email + "_controlcenter" + ',' + process.env.ldap_domain,
                            [
                                new ldapjs.Change({
                                    operation: 'replace',
                                    modification: {
                                        mobile: user.internationalPrefix + user.mobile
                                    }
                                })
                            ],
                            (err) => {
                                if (err) {
                                    console.log(`[${context}][ldapClient.modify] Error `, err.message);
                                    reject(err);
                                };
                                return resolve(true);
                            }
                        );
                    }
                )
            } catch (err) {
                console.log(`[${context}] Error `, err.message);
                return reject(err);
            };
        });
    };

    const updateMobielNameEmailLdapUser = function (user, oldEmail) {
        var context = "Function updateMobielNameEmailLdapUser";
        return new Promise((resolve, reject) => {
            const ldapClient = ldapjs.createClient(ldapOptions);
            try {
                ldapClient.bind(
                    process.env.ldap_admin_user,
                    process.env.ldap_admin_password,
                    (err) => {

                        if (err) {
                            console.log(`[${context}][ldapClient.bind] Error `, err.message);
                            return reject(new Error(err));
                        };

                        ldapClient.modify('uid=' + oldEmail + "_controlcenter" +  ',' + process.env.ldap_domain,
                            [
                                new ldapjs.Change({
                                    operation: 'replace',
                                    modification: {
                                        mobile: user.internationalPrefix + user.mobile
                                    }
                                }),
                                new ldapjs.Change({
                                    operation: 'replace',
                                    modification: {
                                        givenName: user.name
                                    }
                                }),
                                new ldapjs.Change({
                                    operation: 'replace',
                                    modification: {
                                        cn: user.name
                                    }
                                }),
                                new ldapjs.Change({
                                    operation: 'replace',
                                    modification: {
                                        sn: user.name
                                    }
                                }),
                                new ldapjs.Change({
                                    operation: 'replace',
                                    modification: {
                                        mail: user.email
                                    }
                                })
                            ],
                            (err) => {
                                if (err) {
                                    console.log(`[${context}][ldapClient.modify] Error `, err.message);
                                    reject(err);
                                }
                                else {
                                    ldapClient.modifyDN('uid=' + oldEmail + "_controlcenter" +  ',' + process.env.ldap_domain,
                                        'uid=' + user.email + "_controlcenter" +  ',' + process.env.ldap_domain,
                                        (err) => {
                                            if (err) {
                                                console.log(`[${context}][ldapClient.modifyDN] Error `, err.message);
                                                ldapClient.modify('uid=' + oldEmail + "_controlcenter" +  ',' + process.env.ldap_domain,
                                                    [
                                                        new ldapjs.Change({
                                                            operation: 'replace',
                                                            modification: {
                                                                mail: oldEmail
                                                            }
                                                        })
                                                    ]
                                                );
                                                reject(err);
                                            };
                                            return resolve(true);
                                        }
                                    );
                                }
                            }
                        );
                    }
                )

            } catch (err) {
                console.log(`[${context}] Error `, err.message);
                return reject(err);
            };
        });
    };

    const updateMobielNameLdapUser = function (user) {
        var context = "Function updateMobielNameLdapUser";
        return new Promise((resolve, reject) => {
            const ldapClient = ldapjs.createClient(ldapOptions);
            try {
                ldapClient.bind(
                    process.env.ldap_admin_user,
                    process.env.ldap_admin_password,
                    (err) => {

                        if (err) {
                            console.log(`[${context}][ldapClient.bind] Error `, err.message);
                            return reject(new Error(err));
                        };
                        ldapClient.modify('uid=' + user.email + "_controlcenter" + ',' + process.env.ldap_domain,
                            [
                                new ldapjs.Change({
                                    operation: 'replace',
                                    modification: {
                                        mobile: user.internationalPrefix + user.mobile
                                    }
                                }),
                                new ldapjs.Change({
                                    operation: 'replace',
                                    modification: {
                                        givenName: user.name
                                    }
                                }),
                                new ldapjs.Change({
                                    operation: 'replace',
                                    modification: {
                                        cn: user.name
                                    }
                                }),
                                new ldapjs.Change({
                                    operation: 'replace',
                                    modification: {
                                        sn: user.name
                                    }
                                })
                            ],
                            (err) => {
                                if (err) {
                                    console.log(`[${context}][ldapClient.modify] Error `, err.message);
                                    reject(err);
                                };
                                return resolve(true);
                            }
                        );
                    }
                )
            } catch (err) {
                console.log(`[${context}] Error `, err.message);
                return reject(err);
            };
        });
    };

    const authenticate = (username, password) => {
        var context = "Function authenticate";
        return new Promise((resolve, reject) => {

            const ldapClient = ldapjs.createClient(ldapOptions);
            ldapClient.bind(
                'uid=' + username + ',' + process.env.ldap_domain,
                password,
                (err, res) => {
                    if (err) {
                        console.log(`[${context}] Error `, err.message);
                        return reject(err);
                    };
                    ldapClient.unbind();
                    return resolve(res);
                }
            );
        })
    };

    const removeUser = (user) => {
        var context = "Function removeUser";
        return new Promise((resolve, reject) => {
            const ldapClient = ldapjs.createClient(ldapOptions);
            try {
                ldapClient.bind(
                    process.env.ldap_admin_user,
                    process.env.ldap_admin_password,
                    (err) => {

                        if (err) {
                            console.log(`[${context}][ldapClient.bind] Error `, err.message);
                            return reject(new Error(err));
                        };
                        ldapClient.del('uid=' + user.email + "_controlcenter" + ',' + process.env.ldap_domain,
                            (err) => {
                                if (err) {
                                    console.log(`[${context}][ldapClient.del] Error `, err.message);
                                    reject(err);
                                };
                                return resolve(true);
                            }
                        );
                    }
                )

            } catch (err) {
                console.log(`[${context}] Error `, err.message);
                return reject(err);
            };
        });
    };


    return { addldapUser, authenticate, updateldapUser, updateldapNameEmail, updateldapName, updateMobielldapUser, removeUser, updateMobielNameEmailLdapUser, updateMobielNameLdapUser };

};

module.exports = ldapcontroller;