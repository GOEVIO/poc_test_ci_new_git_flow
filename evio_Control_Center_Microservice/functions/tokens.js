const Utils = require('../utils');
module.exports = {
    generateToken: function (req, res) {
        var length = req.body.length;
        if (typeof length == 'undefined')
          return res.status(400).send({ auth: false, code: "server_length_required", message: 'Token length required' });
      
        var token = Utils.generateToken(length);
      
        return res.status(200).send({ token: token });
    }
}