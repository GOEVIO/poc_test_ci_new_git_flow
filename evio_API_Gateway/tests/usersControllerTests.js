const should = require('should');
const sinon = require('sinon');
const userController = require('../controllers/usersController');

describe('User controller Tests:', () => {
    describe('Post', () => {
        it('should not allow an empty username on post', () => {
            const User = function (user) { this.save = () => { } };
            const req = {
                body: {
                    email: 'asdasdf@gmail.com'
                }
            };

            const res = {
                status: sinon.spy(),
                send: sinon.spy(),
                json: sinon.spy()
            };

            const controller = userController(User);
            controller.post(req, res);
            res.status.calledWith(400).should.equal(true, `Wrong Status ${res.status.args[0][0]}`);
            res.send.calledWith('Username is required').should.equal(true, `Wrong Message`);
            
        });
    });
});