const Utils = require('../../utils');
const Session = require('../../models/sessions');
const handlerSession = require('../../2.2/receiver/sessions/handlerSession');

jest.mock('../../models/sessions');
jest.mock('../../utils');
jest.mock('../../models/tokens');
jest.mock('../../global');

jest.mock('../../2.2/receiver/sessions/handlerSession', () => ({
  ...jest.requireActual('../../2.2/receiver/sessions/handlerSession'),
  prepareNewSession: jest.fn(),
}));

describe('handlerSession', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startSession', () => {
    it('should not update session if status is the same', async () => {
      const req = {
        headers: { authorization: 'Token QBWP9eBcm0cA80RZPraMUimcsGlVEtA4ZWfJo4gfjgLEIcFI' },
        body: { id: 'sessionId', status: 'Running' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };

      Session.updateSession.mockImplementation((query, update, callback) => {
        callback(null, { cdrId: "-1", status: 'Running' }); 
      });

      await handlerSession.startSession(req, res);

      expect(Session.updateSession).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(Utils.response(null, 1000, "Session sessionId already in the desired state"));
    });
    it('should return error for empty body data', async () => {
      const req = {
        headers: { authorization: 'Token QBWP9eBcm0cA80RZPraMUimcsGlVEtA4ZWfJo4gfjgLEIcFI' },
        body: {}
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      Utils.isEmptyObject.mockReturnValue(true);

      await handlerSession.startSession(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(Utils.response(null, 2001, "Invalid or missing parameters"));
    });

    it('should return error for missing session ID', async () => {
      const req = {
        headers: { authorization: 'Token QBWP9eBcm0cA80RZPraMUimcsGlVEtA4ZWfJo4gfjgLEIcFI' },
        body: { 'token_uid': '361957060912' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      Utils.isEmptyObject.mockReturnValue(false);

      await handlerSession.startSession(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(Utils.response(null, 2001, "Invalid or missing parameters"));
    });

    it('should update an existing session', async () => {
      const req = {
        headers: { authorization: 'Token QBWP9eBcm0cA80RZPraMUimcsGlVEtA4ZWfJo4gfjgLEIcFI' },
        body: { id: '123', status: 'Running' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };

      Session.updateSession.mockImplementation((query, update, callback) => {
        callback(null, { cdrId: "-1" });
      });

      await handlerSession.startSession(req, res);

      expect(Session.updateSession).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(Utils.response(null, 1000, "Updated Session sessionId"));
    });

    it('should create a new session if not found', async () => {
      const req = {
        headers: { authorization: 'Token QBWP9eBcm0cA80RZPraMUimcsGlVEtA4ZWfJo4gfjgLEIcFI' },
        body: { id: '123', status: 'Running' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };

      Session.updateSession.mockImplementation((query, update, callback) => {
        callback(null, null);
      });

      handlerSession.prepareNewSession.mockResolvedValue();

      await handlerSession.startSession(req, res);

      expect(Session.updateSession).toHaveBeenCalled();
      expect(handlerSession.prepareNewSession).toHaveBeenCalled();
    });
  });
});