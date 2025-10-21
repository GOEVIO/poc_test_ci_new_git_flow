const firebase = require('firebase-admin');
const constants = require('../utils/constants');



const firebaseConnect = () => {
    const url = constants.hostFirebaseWL;   

    console.log(`Conectando ao Firebase com a URL: ${url}`);
    // Firebase Admin initialization
    if (!firebase.apps.length) {
        firebase.initializeApp({
            credential: firebase.credential.cert(JSON.parse(process.env.WHITELABEL_FIREBASE_CREDENTIALS || '{}')),
            databaseURL: url
        });
        console.log('Firebase Admin inicializado com sucesso');
        return firebase;
    } 

    console.log('Firebase Admin já está inicializado');
    return firebase;
}

module.exports = {
    firebaseConnect
}


