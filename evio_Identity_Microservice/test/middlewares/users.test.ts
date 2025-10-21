import {
    beforeEach,
    describe,
    expect,
    it,
    jest
} from '@jest/globals';
import { Request, Response, Send } from 'express';
import { StatusCodes } from 'http-status-codes';
import usersMiddleware from '../../middlewares/users';
import httpMocks from 'node-mocks-http';
import request from 'supertest';
import app from '../../app';
import Constants from '../../utils/constants';
import ClientTypeEnum from '../../enums/clientType.enum';
import { ClientWhiteLabelsEnum } from '../../enums/clientWhiteLabels.enum';
import User from '../../models/user';
import GuestUser from  '../../models/guestUsers';
import * as authValidate from '../../auth/auth';
import * as errorHandling from '../../utils/errorHandling';

jest.mock('../../models/user');
jest.mock('../../models/guestUsers');
jest.spyOn(errorHandling, 'errorResponse');
jest.spyOn(authValidate, 'validateUserPerClientName');

describe('createUserValidation middleware', () => {
    const CREATE_USER_B2B_PATH: string = '/api/private/users/b2b';
    const next = jest.fn();
    const res = {} as unknown as Response;
    res.send = jest.fn() as Send;
    res.status = jest.fn(() => res);

    const req = {
        method: 'POST',
        path: CREATE_USER_B2B_PATH,
        params: { clientType: 'b2b' },
        headers: {
            clientname: ClientWhiteLabelsEnum.Hyundai,
            client: ClientTypeEnum.Backoffice,
            userid : '62506b12f43b4a001225ab0b'
        },
        body: {
            name: 'John Doe',
            country: 'Portugal',
            email: 'test@example.com',
            internationalPrefix: '+351',
            mobile: '912345678',
            password: 'P@ssw0rd',
            confPassword: 'P@ssw0rd',
            username: '123456789'
        }
    } as unknown as Request;
    const context = `${req.method} ${req.path} createUserValidation`;

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    it('should pass validation and call next() if all required data is provided', async () => {
        (User.findOne as jest.Mock)
        .mockReturnValueOnce({ userPackage: { createB2BUsers :true, createB2CUsers :true }})
        .mockReturnValueOnce(undefined);
        (GuestUser.findOne as jest.Mock).mockReturnValue(undefined);
         await usersMiddleware.createUserValidation(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should throw BadRequest if clientType is missing', async () => {
        const error = { auth: false, code: 'client_type_null', message: 'Client type null' };
        const currentRequest = { ...req, params: {} } as Request;

        usersMiddleware.createUserValidation(currentRequest, res, next);

        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    });

    it('should throw BadRequest if clientName is missing', async () => {
        const error = { auth: false, code: 'clientName_missing', message: 'Client name missing' };
        const currentRequest = { ...req, headers: {} } as Request;

        usersMiddleware.createUserValidation(currentRequest, res, next);

        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    });

    it('should throw BadRequest if body is missing', async () => {
        const error = { auth: false, code: 'server_user_required', message: 'User data is required' };
        const currentRequest = { ...req, body: undefined } as Request;

        usersMiddleware.createUserValidation(currentRequest, res, next);

        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    });

    it('should throw BadRequest if name is missing', async () => {
        const error = { auth: false, code: 'server_name_required', message: 'Name is required' };
        const currentRequest = {
            ...req,
            body: {
                ...req.body, name: undefined
            }
        } as Request;

        usersMiddleware.createUserValidation(currentRequest, res, next);

        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    });

    it('should throw BadRequest if name is invalid', async () => {
        const error = { auth: false, code: 'server_name_invalid', message: 'Invalid name' };
        const currentRequest = {
            ...req,
            body: {
                ...req.body, name: 'I`m 1nv4l1d'
            }
        } as Request;

        usersMiddleware.createUserValidation(currentRequest, res, next);

        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    });

    it('should throw BadRequest if username is missing', async () => {
        const error = { auth: false, code: 'server_username_required', message: 'Username is required' };
        const currentRequest = {
            ...req,
            body: {
                ...req.body, username: undefined
            }
        } as Request;

        usersMiddleware.createUserValidation(currentRequest, res, next);

        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    });

    it('should throw BadRequest if email is missing', async () => {
        const error = { auth: false, code: 'server_email_required', message: 'Email is required' };
        const currentRequest = {
            ...req,
            body: {
                ...req.body, email: undefined
            }
        } as Request;

        usersMiddleware.createUserValidation(currentRequest, res, next);

        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    });

    it('should throw BadRequest if email is invalid', async () => {
        const error = { auth: false, code: 'server_invalid_email', message: 'Email is invalid' };
        const currentRequest = {
            ...req,
            body: {
                ...req.body, email: 'invalid@email'
            }
        } as Request;

        usersMiddleware.createUserValidation(currentRequest, res, next);

        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    });

    it('should throw BadRequest if password is missing', async () => {
        const error = { auth: false, code: 'server_password_required', message: 'Password is required' };
        const currentRequest = {
            ...req,
            body: {
                ...req.body, password: undefined
            }
        } as Request;

        usersMiddleware.createUserValidation(currentRequest, res, next);

        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    });

    it('should throw BadRequest if confPassword is missing', async () => {
        const error = { auth: false, code: 'server_conf_password_req', message: 'Password confirmation is required' };
        const currentRequest = {
            ...req,
            body: {
                ...req.body, confPassword: undefined
            }
        } as Request;

        usersMiddleware.createUserValidation(currentRequest, res, next);

        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    });

    it('should throw BadRequest if password is invalid', async () => {
        const error = { auth: false, code: 'server_invalid_password', message: 'Password is invalid' };
        const invalidPasswords = ['a', '1password', '@password', '12345678', '@1234567', '1PASSWORD', 'T@tal1'];

        // eslint-disable-next-line no-restricted-syntax
        for (const invalidPassword of invalidPasswords) {
            jest.clearAllMocks();
            console.log(invalidPassword);
            const currentRequest = {
                ...req,
                body: {
                    ...req.body, password: invalidPassword
                }
            } as Request;

            // eslint-disable-next-line no-await-in-loop
            usersMiddleware.createUserValidation(currentRequest, res, next);

            expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
                statusCode: StatusCodes.BAD_REQUEST, error
            }, context);
        }

        expect(next).not.toHaveBeenCalled();
    });

    it('should throw BadRequest if confPassword is missing', async () => {
        const error = { auth: false, code: 'server_password_not_match', message: 'New password and confirmation are different' };
        const currentRequest = {
            ...req,
            body: {
                ...req.body, confPassword: 'thisIsDifferent@1'
            }
        } as Request;

        usersMiddleware.createUserValidation(currentRequest, res, next);

        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    });

    it('should throw BadRequest if mobile is missing', async () => {
        const error = { auth: false, code: 'server_mobile_required', message: 'Mobile phone is required' };
        const currentRequest = {
            ...req,
            body: {
                ...req.body, mobile: undefined
            }
        } as Request;

        usersMiddleware.createUserValidation(currentRequest, res, next);

        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    });

    it('should throw BadRequest if internationalPrefix is missing', async () => {
        const error = { auth: false, code: 'server_international_prefix_required', message: 'International mobile prefix is required' };
        const currentRequest = {
            ...req,
            body: {
                ...req.body, internationalPrefix: undefined
            }
        } as Request;

        usersMiddleware.createUserValidation(currentRequest, res, next);

        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    });

    it('should throw BadRequest if internationalPrefix is missing', async () => {
        const error = { auth: false, code: 'server_international_prefix_required', message: 'International mobile prefix is required' };
        const currentRequest = {
            ...req,
            body: {
                ...req.body, internationalPrefix: undefined
            }
        } as Request;

        usersMiddleware.createUserValidation(currentRequest, res, next);

        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    });

    it('should throw BadRequest if portuguese mobile number is invalid', async () => {
        const error = { auth: false, code: 'server_mobile_badNumber', message: 'Phone number with incorrect format' };
        const currentRequest = {
            ...req,
            body: {
                ...req.body,
                internationalPrefix: Constants.portugueseMobilePrefix,
                mobile: '12345678'
            }
        } as Request;

        usersMiddleware.createUserValidation(currentRequest, res, next);

        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    });

    it('should throw BadRequest if country is missing', async () => {
        const error = { auth: false, code: 'server_country_required', message: 'Country is required' };
        const currentRequest = {
            ...req,
            body: {
                ...req.body, country: undefined
            }
        } as Request;

        usersMiddleware.createUserValidation(currentRequest, res, next);

        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    });

    it('should throw BadRequest if country is missing', async () => {
        const error = { auth: false, code: 'server_country_required', message: 'Country is required' };
        const currentRequest = {
            ...req,
            body: {
                ...req.body, country: undefined
            }
        } as Request;

        usersMiddleware.createUserValidation(currentRequest, res, next);

        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    });

    it('should block Kinto app user creation', async () => {
        const error = { auth: false, code: 'action_not_allowed', message: `Action not allowed for ${ClientWhiteLabelsEnum.Kinto}` };
        const currentRequest = {
            ...req,
            headers: {
                client: ClientTypeEnum.Android,
                clientname: ClientWhiteLabelsEnum.Kinto
            }
        } as unknown as Request;

        usersMiddleware.createUserValidation(currentRequest, res, next);

        expect(authValidate.validateUserPerClientName).toHaveBeenCalledWith(currentRequest.headers);
        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    });

    it('should throw BadRequest if user is already created', async () => {
        const error = { auth: false, code: 'server_email_taken', message: `Email ${req.body.email} is already registered` };
        (User.findOne as jest.Mock)
        .mockReturnValueOnce({ userPackage: { createB2BUsers :true, createB2CUsers :true }})
        .mockReturnValueOnce({ email: req.body.email });

        await usersMiddleware.createUserValidation(req, res, next);

        expect(User.findOne).toHaveBeenCalledTimes(2);
        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    });

    it('should throw BadRequest if user is already created with the same username', async () => {
        const error = { auth: false, code: 'server_mobile_taken', message: `Mobile ${req.body.username} is already taken` };
        (User.findOne as jest.Mock)
        .mockReturnValueOnce({ userPackage: { createB2BUsers :true, createB2CUsers :true }})
        .mockReturnValueOnce({ username: req.body.username });

        await usersMiddleware.createUserValidation(req, res, next);

        expect(User.findOne).toHaveBeenCalledTimes(2);
        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    });

    it('should throw BadRequest if guestuser is already created with the same email', async () => {
        const error = { auth: false, code: 'server_email_taken', message: `Email ${req.body.email} is already registered` };
        (User.findOne as jest.Mock)
        .mockReturnValueOnce({ userPackage: { createB2BUsers :true, createB2CUsers :true }})
        .mockReturnValueOnce(false);
        (GuestUser.findOne as jest.Mock).mockReturnValue({ email: req.body.email });

        await usersMiddleware.createUserValidation(req, res, next);

        expect(User.findOne).toHaveBeenCalledTimes(2);
        expect(GuestUser.findOne).toHaveBeenCalledTimes(1);
        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    });
});

describe('Users Validators deactivateContractsValidation() Validator', () => {
   
    const res = httpMocks.createResponse();
    const next = jest.fn(); // Create a mock next function
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
    });
    it('should return 400 if body is not provided', async () => {
        const response = await request(app)
                .patch('/api/private/users/contracts/deactivate/56265262')
                .set('userid', '60b67fa4e255650013db9cfe')
                .set('requestuserid', '60b67fa4e255650013db9cfe')
                .set('accounttype', 'MASTER')
                .send(null);
        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toEqual({
                auth: false,
                code: 'server_message_required',
                message: 'Message is required',
        });
    });
   // server_invalid_reason
    it('should return 400 if reason is not a valid value in enum', async () => {
        const response = await request(app)
                .patch('/api/private/users/contracts/deactivate/56265262')
                .set('userid', '60b67fa4e255650013db9cfe')
                .set('requestuserid', '60b67fa4e255650013db9cfe')
                .set('accounttype', 'MASTER')
                .send({reason: '123'});
        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toEqual({
                auth: false,
                code: 'server_invalid_reason',
                message: 'Invalid reason',
        });
    });

    it('should return 400 if userId is with bad format', async () => {
        const response = await request(app)
                .patch('/api/private/users/contracts/deactivate/56265262')
                .set('userid', '60b67fa4e255650013db9cfe')
                .set('requestuserid', '60b67fa4e255650013db9cfe')
                .set('accounttype', 'MASTER')
                .send({reason: 'FLEET_MANAGER'});
        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toEqual({
                auth: false,
                code: 'server_invalid_userId',
                message: 'Invalid user id',
        });
    });

    it('should be all good :)', async () => {
        const response = await request(app)
                .patch('/api/private/users/contracts/deactivate/6543bfcdfb05b700135c6df9')
                .set('userid', '60b67fa4e255650013db9cfe')
                .set('requestuserid', '60b67fa4e255650013db9cfe')
                .set('accounttype', 'MASTER')
                .send({reason: 'FLEET_MANAGER'});
        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toEqual({
                auth: false,
                code: 'server_user_not_found',
                message: 'User not found',
        });
    });
   
});

describe('Users Validators validateUserRequest() Validator', () => {
    let req = {
        method: 'POST',
        path: "testing/path",
        headers: {
        },
        body: {
            name: 'John Doe',
            country: 'Portugal',
            email: 'test@example.com',
            internationalPrefix: '+351',
            mobile: '912345678',
            password: 'P@ssw0rd',
            confPassword: 'P@ssw0rd',
            username: '123456789'
        }
    } as unknown as Request;
    const context = `${req.method} ${req.path} validateUserResquest`;

    const res = httpMocks.createResponse();
    const next = jest.fn(); // Create a mock next function
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
    });
    it(' validateUserRequest() Missing all headers ', async () => {
        const error = { auth: false, code: 'server_user_id_required', message: `UserID is required` };
        await usersMiddleware.validateUserRequest(req, res, next);
        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    })
    it(' validateUserRequest() with invalid userid', async () => {
        req.headers.userid= 'teste';
        const error = { auth: false, code: 'server_invalid_userId', message: `Invalid user id` };
        await usersMiddleware.validateUserRequest(req, res, next);
        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.UNAUTHORIZED, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    })
    
    it(' validateUserRequest() missing requestUserId', async () => {
        req.headers= { userid: '60b67fa4e255650013db9cfe'}
        const error = { auth: false, code: 'server_request_user_id_required', message: `RequestUserID is required` };
        await usersMiddleware.validateUserRequest(req, res, next);
        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    })
    it(' validateUserRequest() with invalid requestUserId', async () => {
        req.headers= { userid: '60b67fa4e255650013db9cfe', requestuserid: 'teste'}
        const error = { auth: false, code: 'server_invalid_requestUserId', message: `Invalid request user Id` };
        await usersMiddleware.validateUserRequest(req, res, next);
        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.UNAUTHORIZED, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    })
    it(' validateUserRequest() with invalid request of type MASTER', async () => {
        req.headers= { userid: '60b67fa4e255650013db9cfe', requestuserid: '60b67fa4e255650013db9cfd', accounttype: 'MASTER'}
        const error = { auth: false, code: 'server_not_authorized', message: `Not authorized` };
        await usersMiddleware.validateUserRequest(req, res, next);
        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.UNAUTHORIZED, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    })

    it(' validateUserRequest() with invalid request of type GUEST', async () => {
        req.headers= { userid: '60b67fa4e255650013db9cfd', requestuserid: '60b67fa4e255650013db9cfd', accounttype: 'GUEST'}
        const error = { auth: false, code: 'server_not_authorized', message: `Not authorized` };
        await usersMiddleware.validateUserRequest(req, res, next);
        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.UNAUTHORIZED, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    })

    it(' validateUserRequest() check if guest user is guest of master account ', async () => {
        req.headers= { userid: '60b67fa4e255650013db9cfc', requestuserid: '60b67fa4e255650013db9cfd', accounttype: 'GUEST'}
        const error = { auth: false, code: 'server_not_authorized', message: `Not authorized` };
        (GuestUser.findOne as jest.Mock).mockReturnValueOnce(null)
        await usersMiddleware.validateUserRequest(req, res, next);
        expect(errorHandling.errorResponse).toHaveBeenCalledWith(res, {
            statusCode: StatusCodes.BAD_REQUEST, error
        }, context);
        expect(next).not.toHaveBeenCalled();
    })
    it(' validateUserRequest() pass all checks ', async () => {
        req.headers= { userid: '60b67fa4e255650013db9cfc', requestuserid: '60b67fa4e255650013db9cfd', accounttype: 'GUEST'}
        const error = { auth: false, code: 'server_not_authorized', message: `Not authorized` };
        (GuestUser.findOne as jest.Mock).mockReturnValueOnce(true)
        await usersMiddleware.validateUserRequest(req, res, next);
        expect(next).toHaveBeenCalled();
    })

});

describe('Users Validators activateContractValidation() Validator', () => {
    const urlRequest = '/api/private/users/contracts/activate/';
    const res = httpMocks.createResponse();
    const next = jest.fn();
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 400 if userID is missing', async () => {
        const response = await request(app)
                .patch(`${urlRequest}`)
                .set('userid', '60b67fa4e255650013db9cfe')
                .set('requestuserid', '60b67fa4e255650013db9cfe')
                .set('accounttype', 'MASTER')
        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toEqual({
                auth: false,
                code: 'server_user_required',
                message: 'User data is required',
        });
    });

    it('should return 400 if userID with invalid format', async () => {
        const response = await request(app)
                .patch(`${urlRequest}545dsf`)
                .set('userid', '60b67fa4e255650013db9cfe')
                .set('requestuserid', '60b67fa4e255650013db9cfe')
                .set('accounttype', 'MASTER')
        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toEqual({
                auth: false,
                code: 'server_invalid_userId',
                message: 'Invalid user id',
        });
    });

    it('Using superAdmin it should pass', async () => {
        const response = await request(app)
                .patch(`${urlRequest}60b67fa4e255650013db9cfe`)
                .set('userid', '60b67fa4e255650013db9cfe')
                .set('requestuserid', Constants.OperationsManagement.id)
                .set('accounttype', 'MASTER')
                expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    it('should return 400 if userID user is not found', async () => {
        (User.findOne as jest.Mock).mockReturnValueOnce(null)
        const response = await request(app)
                .patch(`${urlRequest}60b67fa4e255650013db9cfe`)
                .set('userid', '60b67fa4e255650013db9cfe')
                .set('requestuserid', '60b67fa4e255650013db9cfe')
                .set('accounttype', 'MASTER')
        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toEqual({
                auth: false,
                code: 'server_user_not_found',
                message: 'User not found',
        });
    });

    it('should return 401 user b2b without permissions', async () => {
        (User.findOne as jest.Mock).mockReturnValueOnce({clientType:'b2b', userPackage:{ createB2BUsers: false, createB2CUsers: true }})
        const response = await request(app)
                .patch(`${urlRequest}60b67fa4e255650013db9cfe`)
                .set('userid', '60b67fa4e255650013db9cfe')
                .set('requestuserid', '60b67fa4e255650013db9cfe')
                .set('accounttype', 'MASTER')
        expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
        expect(response.body).toEqual({
                auth: false,
                code: 'action_not_allowed',
                message: 'Action not allowed for this user',
        });
    });

    it('should return 401 user b2c without permissions', async () => {
        (User.findOne as jest.Mock).mockReturnValueOnce({clientType:'b2c', userPackage:{ createB2BUsers: false, createB2CUsers: false }})
        const response = await request(app)
                .patch(`${urlRequest}60b67fa4e255650013db9cfe`)
                .set('userid', '60b67fa4e255650013db9cfe')
                .set('requestuserid', '60b67fa4e255650013db9cfe')
                .set('accounttype', 'MASTER')
        expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
        expect(response.body).toEqual({
                auth: false,
                code: 'action_not_allowed',
                message: 'Action not allowed for this user',
        });
    });
    
    it('should be all good :)', async () => {
        (User.findOne as jest.Mock).mockReturnValueOnce({clientType:'b2c', userPackage:{ createB2BUsers: true, createB2CUsers: true }})
        const response = await request(app)
                .patch(`${urlRequest}60b67fa4e255650013db9cfe`)
                .set('userid', '60b67fa4e255650013db9cfe')
                .set('requestuserid', '60b67fa4e255650013db9cfe')
                .set('accounttype', 'MASTER')
                .send({reason: 'FLEET_MANAGER'});
                expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    })
   
});