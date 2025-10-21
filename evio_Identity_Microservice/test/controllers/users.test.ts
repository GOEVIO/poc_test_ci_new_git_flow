import {
    afterEach,
    describe,
    expect,
    it,
    jest,
    beforeEach,
} from '@jest/globals';
import request from 'supertest';
import { StatusCodes } from 'http-status-codes';
import dotenv from 'dotenv-safe';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import User from '../../models/user';
import app from '../../app';
import ClientTypeEnum from '../../enums/clientType.enum';
import { ClientWhiteLabelsEnum } from '../../enums/clientWhiteLabels.enum';
import usersController from '../../controllers/users';
import BillingProfile from '../../models/billingProfile';
import GuestUser from '../../models/guestUsers';

dotenv.load();
jest.mock('../../models/user');
jest.mock('../../models/billingProfile');
jest.mock('../../models/guestUsers');

jest.spyOn(usersController, 'createUser');

describe('Users', () => {
    const BY_CLIENT_NAME_PATH: string = '/api/private/users/byClientName';
    const BY_CLIENT_NAME_RESPONSE = [
        {
            _id: 'anyid',
            name: 'anyname',
            email: 'any@email.com',
            internationalPrefix: '+1',
            mobile: '987654321',
            username: 'anyuser',
            clientType: 'b2b',
            clientTypeName: 'Company',
            blocked: false,
        },
    ];
    const BY_CLIENT_NAME_COUNT_RESPONSE = {
        total: 1,
        pages: 1,
    };

    describe(`GET ${BY_CLIENT_NAME_PATH}`, () => {
        afterEach(() => {
            jest.clearAllMocks();
            (User.getUsersCountByClientName as jest.Mock).mockReturnValue(
                BY_CLIENT_NAME_COUNT_RESPONSE
            );
        });

        it('returns HTTP 400 for request without client name header', async () => {
            const response = await request(app).get(BY_CLIENT_NAME_PATH);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_user_id_required',
                message: 'UserID is required',
            });
        });

        it('returns 400 if filter param is invalid', async () => {
            const response = await request(app)
                .get(BY_CLIENT_NAME_PATH)
                .set('clientname', ClientWhiteLabelsEnum.Kinto)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'MASTER')
                .query({ field: 'anyfield', value: 'anyvalue' });
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body.code).toEqual('server_invalid_query');
        });

        it('returns 200 if users are not found', async () => {
            (User.getUsersByClientName as jest.Mock).mockReturnValueOnce([]);
            (User.findOne as jest.Mock).mockReturnValueOnce({userPackage: { createB2BUsers:true, createB2CUsers: true}});
            const response = await request(app)
                .get(BY_CLIENT_NAME_PATH)
                .set('clientname', 'FAKE_CLIENT')
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'MASTER')
            expect(response.status).toBe(StatusCodes.OK);
            expect(response.body).toEqual([]);
        });

        it('returns 200 if filter param is valid', async () => {
            const queryParams = { field: 'email', value: 'anyvalue' };
            const additionalFilters = {
                [queryParams.field]: {
                    $regex: new RegExp(queryParams.value, 'i'),
                },
            };
            (User.getUsersByClientName as jest.Mock).mockReturnValueOnce(
                BY_CLIENT_NAME_RESPONSE
            );
            (User.findOne as jest.Mock).mockReturnValueOnce({userPackage: { createB2BUsers:true, createB2CUsers: true}});
            const response = await request(app)
                .get(BY_CLIENT_NAME_PATH)
                .set('clientname', ClientWhiteLabelsEnum.Kinto)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'MASTER')
                .query(queryParams);
            expect(response.status).toBe(StatusCodes.OK);
            expect(response.body).toEqual(BY_CLIENT_NAME_RESPONSE);
            expect(User.getUsersByClientName).toBeCalledWith(
                ClientWhiteLabelsEnum.Kinto,
                additionalFilters,
                undefined,
                undefined
            );
        });

        it('returns 200 and send totals header if have pagination', async () => {
            const queryParams = {
                pageNumber: '1',
                limitQuery: '50',
                field: 'clientType',
                value: 'b2b',
            };
            const additionalFilters = {
                [queryParams.field]: queryParams.value,
            };
            (User.getUsersByClientName as jest.Mock).mockReturnValueOnce(
                BY_CLIENT_NAME_RESPONSE
            );
            (User.findOne as jest.Mock).mockReturnValueOnce({userPackage: { createB2BUsers:true, createB2CUsers: true}});
            const response = await request(app)
                .get(BY_CLIENT_NAME_PATH)
                .set('clientname', ClientWhiteLabelsEnum.Kinto)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'MASTER')
                .query(queryParams);
            expect(response.status).toBe(StatusCodes.OK);
            expect(response.body).toEqual(BY_CLIENT_NAME_RESPONSE);
            expect(response.headers).toHaveProperty('numberofpages');
            expect(response.headers).toHaveProperty('totalofentries');
            expect(User.getUsersCountByClientName).toBeCalledWith(
                ClientWhiteLabelsEnum.Kinto,
                additionalFilters,
                queryParams.limitQuery
            );
            expect(User.getUsersByClientName).toBeCalledWith(
                ClientWhiteLabelsEnum.Kinto,
                additionalFilters,
                queryParams.pageNumber,
                queryParams.limitQuery
            );
        });

        it('returns 200 if filter param is valid and needs exact value comparison', async () => {
            const queryParams = { field: 'clientType', value: 'b2b' };
            const additionalFilters = {
                [queryParams.field]: queryParams.value,
            };
            (User.getUsersByClientName as jest.Mock).mockReturnValueOnce(
                BY_CLIENT_NAME_RESPONSE
            );
            (User.findOne as jest.Mock).mockReturnValueOnce({userPackage: { createB2BUsers:true, createB2CUsers: true}});
            const response = await request(app)
                .get(BY_CLIENT_NAME_PATH)
                .set('clientname', ClientWhiteLabelsEnum.Kinto)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'MASTER')
                .query(queryParams);
            expect(response.status).toBe(StatusCodes.OK);
            expect(response.body).toEqual(BY_CLIENT_NAME_RESPONSE);
            expect(User.getUsersByClientName).toBeCalledWith(
                ClientWhiteLabelsEnum.Kinto,
                additionalFilters,
                undefined,
                undefined
            );
        });

        it('returns 200 on success without filters', async () => {
            (User.getUsersByClientName as jest.Mock).mockReturnValueOnce(
                BY_CLIENT_NAME_RESPONSE
            );
            (User.findOne as jest.Mock).mockReturnValueOnce({userPackage: { createB2BUsers:true, createB2CUsers: true}});
            const response = await request(app)
                .get(BY_CLIENT_NAME_PATH)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'MASTER')
                .set('clientname', ClientWhiteLabelsEnum.Kinto);
            expect(response.headers).toHaveProperty('numberofpages');
            expect(response.headers).toHaveProperty('totalofentries');
            expect(response.status).toBe(StatusCodes.OK);
            expect(response.body).toEqual(BY_CLIENT_NAME_RESPONSE);
        });
    });

    const USER_EVIO = {
        _id: '660ba157c83d043f996aa6f7',
        active: true,
        validated: true,
        country: 'PT',
        language: 'pt',
        internationalPrefix: '+351',
        accessType: 'limited',
        clientType: 'b2b',
        userType: 'FinalCostumer',
        username: '912687454',
        email: 'test@go-evio.com',
        mobile: '912687454',
        name: 'Unit test 1',
        clientName: 'EVIO',
        status: 'REGISTERED',
        userPackage:{
            createB2BUsers:true,
            createB2CUsers:true
        }
    };

    const PATCH_USER_PATH: string = '/api/private/users/';
    describe(`PATCH ${PATCH_USER_PATH}`, () => {
        afterEach(() => {
            jest.clearAllMocks();
        });
        it('returns HTTP 400 for request without userid', async () => {
            const userId = '2652665fdsa';
            const body = { test: 'olleeee' };
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('requestuserid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'MASTER')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send(body);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_user_id_required',
                message: 'UserID is required',
            });
        });

        it('returns HTTP 400 for request without requestuserid', async () => {
            const userId = '2652665fdsa';
            const body = { test: 'olleeee' };
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'MASTER')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send(body);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_request_user_id_required',
                message: 'RequestUserID is required',
            });
        });

        it('returns HTTP 401 for request not authorized GUEST', async () => {
            const userId = '2652665fdsa';
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'GUEST')
                .send({});
            expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_not_authorized',
                message: 'Not authorized',
            });
        });

        it('returns HTTP 401 for request not authorized MASTER', async () => {
            const userId = '2652665fdsa';
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0d')
                .set('accounttype', 'MASTER')
                .send({});
            expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_not_authorized',
                message: 'Not authorized',
            });
        });

        it('returns HTTP 401 for request of not guestUser', async () => {
            const userId = '2652665fdsa';
            (GuestUser.findOne as jest.Mock).mockReturnValueOnce({});
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0d')
                .set('accounttype', 'MASTER')
                .send({});
            expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_not_authorized',
                message: 'Not authorized',
            });
        });
        
        it('returns HTTP 400 for request without body', async () => {
            const userId = '2652665fdsa';
            (GuestUser.findOne as jest.Mock).mockReturnValueOnce({_id:'62506b12f43b4a001225ab0b'});
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'MASTER')
                .send({});
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_user_required',
                message: 'User data is required',
            });
        });

        it('returns HTTP 401 for request with invalid userId on params', async () => {
            const userId = '2652665fdsa';
            (GuestUser.findOne as jest.Mock).mockReturnValueOnce({_id:'62506b12f43b4a001225ab0b'});
            const body = { test: 'olleeee', cenas: 'bom teste' };
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'MASTER')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send(body);
            expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_invalid_userId',
                message: 'Invalid user id',
            });
        });

        it('returns HTTP 400 for request with random body', async () => {
            const userId = '62506b12f43b4a001225ab0a';
            (GuestUser.findOne as jest.Mock).mockReturnValueOnce({_id:'62506b12f43b4a001225ab0b'});
            const body = { test: 'olleeee', cenas: 'bom teste' };
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'MASTER')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send(body);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_name_required',
                message: 'Name is required',
            });
        });

        it('returns HTTP 400 for request without name ', async () => {
            const userId = '62506b12f43b4a001225ab0a';
            (GuestUser.findOne as jest.Mock).mockReturnValueOnce({_id:'62506b12f43b4a001225ab0b'});
            const body = { username: 'olleeee' };
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'MASTER')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send(body);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_name_required',
                message: 'Name is required',
            });
        });

        it('should throw BadRequest if name is invalid', async () => {
            const userId = '62506b12f43b4a001225ab0a';
            (GuestUser.findOne as jest.Mock).mockReturnValueOnce({_id:'62506b12f43b4a001225ab0b'});
            const body = { name: 'I`m 1nv4l1d', username: 'olleeee' };
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'MASTER')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send(body);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_name_invalid',
                message: 'Invalid name',
            });
        });

        it('returns HTTP 400 for request with missing email on the body', async () => {
            const userId = '62506b12f43b4a001225ab0a';
            (GuestUser.findOne as jest.Mock).mockReturnValueOnce({_id:'62506b12f43b4a001225ab0b'});
            const body = { name: 'olleeee', username: 'sadfsdafasdf' };
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'MASTER')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send(body);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_email_required',
                message: 'Email is required',
            });
        });

        it('returns HTTP 400 for request with invalid email on the Body', async () => {
            const userId = '62506b12f43b4a001225ab0a';
            (GuestUser.findOne as jest.Mock).mockReturnValueOnce({_id:'62506b12f43b4a001225ab0b'});
            const body = {
                name: 'olleeee',
                username: 'sadfsdafasdf',
                email: 'dsfsdfsdf',
            };
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'MASTER')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send(body);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_invalid_email',
                message: 'Email is invalid',
            });
        });

        it('returns HTTP 400 for request with missing mobile on the body', async () => {
            const userId = '62506b12f43b4a001225ab0a';
            (GuestUser.findOne as jest.Mock).mockReturnValueOnce({_id:'62506b12f43b4a001225ab0b'});
            const body = {
                name: 'olleeee',
                username: '938754869',
                email: 'diogo.lopes@go-evio.com',
            };
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'MASTER')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send(body);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_mobile_required',
                message: 'Mobile phone is required',
            });
        });

        it('returns HTTP 400 for request with missing internationalPrefix on the Body', async () => {
            const userId = '62506b12f43b4a001225ab0a';
            (GuestUser.findOne as jest.Mock).mockReturnValueOnce({_id:'62506b12f43b4a001225ab0b'});
            const body = {
                name: 'olleeee',
                username: '938754869',
                email: 'diogo.lopes@go-evio.com',
                mobile: '987654321',
            };
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'MASTER')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send(body);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_international_prefix_required',
                message: 'International mobile prefix is required',
            });
        });

        it('returns HTTP 400 for request with missing bad portuguese mobile number (string) on the Body', async () => {
            const userId = '62506b12f43b4a001225ab0a';
            (GuestUser.findOne as jest.Mock).mockReturnValueOnce({_id:'62506b12f43b4a001225ab0b'});
            const body = {
                name: 'olleeee',
                username: '938754869',
                email: 'diogo.lopes@go-evio.com',
                mobile: 'sdfsadcasdf',
                internationalPrefix: '+351',
            };
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'MASTER')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send(body);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_mobile_badNumber',
                message: 'Phone number with incorrect format',
            });
        });

        it('returns HTTP 400 for request with missing bad portuguese mobile number on the Body', async () => {
            const userId = '62506b12f43b4a001225ab0a';
            (GuestUser.findOne as jest.Mock).mockReturnValueOnce({_id:'62506b12f43b4a001225ab0b'});
            const body = {
                name: 'olleeee',
                username: '938754869',
                email: 'diogo.lopes@go-evio.com',
                mobile: '782212152',
                internationalPrefix: '+351',
            };
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'MASTER')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send(body);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_mobile_badNumber',
                message: 'Phone number with incorrect format',
            });
        });

        it('returns HTTP 400 for request with username different from email and mobile', async () => {
            const userId = '62506b12f43b4a001225ab0a';
            (GuestUser.findOne as jest.Mock).mockReturnValueOnce({_id:'62506b12f43b4a001225ab0b'});
            const body = {
                name: 'Test User',
                username: '938754869',
                email: 'diogo.lopes@go-evio.com',
                mobile: '918709917',
                internationalPrefix: '+351',
            };
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'MASTER')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send(body);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_username_mismatch',
                message: 'Username must be the same as email or mobile',
            });
        });

        it('returns HTTP 400 for request with valid userId but missing on DB', async () => {
            const userId = '624dab038c75d0001209ba98';
            (GuestUser.findOne as jest.Mock).mockReturnValueOnce({_id:'62506b12f43b4a001225ab0b'});
            (User.findById as jest.Mock).mockReturnValueOnce(USER_EVIO);
            const body = {
                name: 'Test User',
                username: '918709917',
                email: 'diogo.lopes@go-evio.com',
                mobile: '918709917',
                internationalPrefix: '+351',
            };
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('userid', '62506b12f43b4a001225ab0b')
                .set('requestuserid', '62506b12f43b4a001225ab0b')
                .set('accounttype', 'MASTER')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send(body);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_user_not_found',
                message: 'User not found',
            });
        });

        it('returns HTTP 400 for request with valid userId on BD but with already used email', async () => {
            const userId = USER_EVIO._id;
            (GuestUser.findOne as jest.Mock).mockReturnValueOnce({_id:'62506b12f43b4a001225ab0b'});
            const body = {
                name: 'Test User',
                username: USER_EVIO.username,
                email: USER_EVIO.email,
                mobile: USER_EVIO.mobile,
                internationalPrefix: USER_EVIO.internationalPrefix,
            };
            (User.findById as jest.Mock).mockReturnValueOnce(USER_EVIO);
            (User.isUsedEmail as jest.Mock).mockReturnValueOnce(true);
            (User.isUsedMobile as jest.Mock).mockReturnValueOnce(false);
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('userid', USER_EVIO._id)
                .set('requestuserid', USER_EVIO._id)
                .set('accounttype', 'MASTER')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send(body);
           
            expect(response.body).toEqual({
                auth: false,
                code: 'server_email_already_exists',
                message: 'Email already exists',
            });
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        });

        it('returns HTTP 400 for request with valid userId on BD but with already used mobile', async () => {
            const userId = USER_EVIO._id;
            (GuestUser.findOne as jest.Mock).mockReturnValueOnce({_id:'62506b12f43b4a001225ab0b'});
            const body = {
                name: 'Test User',
                username: USER_EVIO.username,
                email: USER_EVIO.email,
                mobile: USER_EVIO.mobile,
                internationalPrefix: USER_EVIO.internationalPrefix,
            };
            (User.findById as jest.Mock).mockReturnValueOnce(USER_EVIO);
            (User.isUsedEmail as jest.Mock).mockReturnValueOnce(false);
            (User.isUsedMobile as jest.Mock).mockReturnValueOnce(true);
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('userid', USER_EVIO._id)
                .set('requestuserid', USER_EVIO._id)
                .set('accounttype', 'MASTER')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send(body);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_phone_already_exists',
                message: 'Phone already exists',
            });
        });

        it('returns HTTP 400 for request with valid userId on BD but with already used mobile', async () => {
            const userId = USER_EVIO._id;
            (GuestUser.findOne as jest.Mock).mockReturnValueOnce({_id:'62506b12f43b4a001225ab0b'});
            const body = {
                name: 'Test User',
                username: USER_EVIO.username,
                email: USER_EVIO.email,
                mobile: USER_EVIO.mobile,
                internationalPrefix: USER_EVIO.internationalPrefix,
            };
            (User.findById as jest.Mock).mockReturnValueOnce(USER_EVIO);
            (User.isUsedEmail as jest.Mock).mockReturnValueOnce(false);
            (User.isUsedMobile as jest.Mock).mockReturnValueOnce(true);
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('userid', USER_EVIO._id)
                .set('requestuserid', USER_EVIO._id)
                .set('accounttype', 'MASTER')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send(body);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_phone_already_exists',
                message: 'Phone already exists',
            });
        });

        it('returns HTTP 500 fail to update User', async () => {
            const userId = USER_EVIO._id;
            (GuestUser.findOne as jest.Mock).mockReturnValueOnce({_id:'62506b12f43b4a001225ab0b'});
            const body = {
                name: 'Test User',
                username: USER_EVIO.username,
                email: USER_EVIO.email,
                mobile: USER_EVIO.mobile,
                internationalPrefix: USER_EVIO.internationalPrefix,
            };
            (User.findById as jest.Mock).mockReturnValueOnce(USER_EVIO);
            (User.isUsedEmail as jest.Mock).mockReturnValueOnce(false);
            (User.isUsedMobile as jest.Mock).mockReturnValueOnce(false);
            (User.updateUser as jest.Mock).mockReturnValueOnce(null);
            const response = await request(app)
                .patch(`${PATCH_USER_PATH}${userId}`)
                .set('userid', USER_EVIO._id)
                .set('requestuserid', USER_EVIO._id)
                .set('accounttype', 'MASTER')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .send(body);
            expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
            console.log(response.body);
        });
    });

    describe('Function hyundaiGetToken()', () => {
        let mock: MockAdapter;
        beforeEach(() => {
            mock = new MockAdapter(axios);
        });
        afterEach(() => {
            mock.restore();
        });

        it('returns token when API call is successful ', async () => {
            mock.onPost(process.env.hyundaiGetToken).reply(200, {
                access_token: 'test-token',
            });
            const token = await usersController.hyundaiGetToken();
            expect(token).toMatchObject({
                access_token: 'test-token',
            });
        });

        it('throws an error when API call fails', async () => {
            mock.onPost(process.env.hyundaiGetToken).networkError();
            await expect(await usersController.hyundaiGetToken()).toBeNull();
        });
    });

    describe('Function updateUserHyundai()', () => {
        let mock: MockAdapter;
        beforeEach(() => {
            mock = new MockAdapter(axios);
        });
        afterEach(() => {
            mock.restore();
        });
        it('Send bad UserId ', async () => {
            const status = await usersController.updateUserHyundai('userId');
            expect(status).toBeNull();
        });

        it('Fail to get tokens from ', async () => {
            mock.onPost(process.env.hyundaiGetToken).networkError();
            (User.findOne as jest.Mock).mockReturnValueOnce(USER_EVIO);
            (BillingProfile.findOne as jest.Mock).mockReturnValueOnce(USER_EVIO); 
            const status = await usersController.updateUserHyundai(USER_EVIO._id);
            expect(status).toBeNull();
        });

        it('Fail to get User', async () => {
            mock.onPost(process.env.hyundaiGetToken).reply(200, {
                access_token: 'test-token',
            });
            (User.findOne as jest.Mock).mockReturnValueOnce(null);
            (BillingProfile.findOne as jest.Mock).mockReturnValueOnce(USER_EVIO); 
            const response = await usersController.updateUserHyundai(USER_EVIO._id)
            expect(response).toBeNull();
        });

        it('Fail to get an billingProfile', async () => {
            mock.onPost(process.env.hyundaiGetToken).reply(200, {
                access_token: 'test-token',
            });
            (User.findOne as jest.Mock).mockReturnValueOnce(USER_EVIO);
            (BillingProfile.findOne as jest.Mock).mockReturnValueOnce(null); 
            const response = await usersController.updateUserHyundai(USER_EVIO._id)
            expect(response).toBeNull();
        });
        it('Get and error on put request to Hyundai put data', async () => {
            mock.onPost(process.env.hyundaiGetToken).reply(200, {
                access_token: 'test-token',
            });
            mock.onPut(`${process.env.hyundaiGetToken}teste`).networkError();
            (User.findOne as jest.Mock).mockReturnValueOnce({userFound:{idHyundaiCode: 'teste'}});
            (BillingProfile.findOne as jest.Mock).mockReturnValueOnce(USER_EVIO); 
            const response = await usersController.updateUserHyundai(USER_EVIO._id)
            expect(response).toBeNull();
        });
        it('All Good and pass ', async () => {
            mock.onPost(process.env.hyundaiGetToken).reply(200, {
                access_token: 'test-token',
            });
            mock.onPut('https://demowsmyhyundai.rigorcg.pt/WsMyHyundai/services/client/teste').reply(200, {
                status: 'allGood',
            });
            (User.findOne as jest.Mock).mockReturnValueOnce({idHyundaiCode: 'teste',internationalPrefix: '+351',mobile: '912687454'});
            (BillingProfile.findOne as jest.Mock).mockReturnValueOnce({
                billingAddress:{
                    address: 'Rua do teste',
                    city: 'Lisboa',
                    postalCode: '1000-100',
                    country: 'PT'
                },
                billingName: 'Unit test 1',
            });
            const response = await usersController.updateUserHyundai(USER_EVIO._id)
            expect(response).toMatchObject({
                status: 'allGood',
            });
        });
    });
    describe('Function getGochargeHostAndAuth()', () => {
        let mock: MockAdapter;
        beforeEach(() => {
            mock = new MockAdapter(axios);
        });
        afterEach(() => {
            mock.restore();
        });
        it('Expect the default result, no env set', async () => {
            const response = usersController.getGochargeHostAndAuth();
            expect(response).toMatchObject({
                auth : {
                    username: process.env.UserNameWebserviceGoChargePRE,
                    password: process.env.KeyWebserviceGoChargePRE,
                },
                host : process.env.HostTokenTest,
            });
        })
        it('In pre env ', async () => {
            process.env.NODE_ENV = 'pre-production';
            const response = usersController.getGochargeHostAndAuth();
            expect(response).toMatchObject({
                auth : {
                    username: process.env.UserNameWebserviceGoChargePRE,
                    password: process.env.KeyWebserviceGoChargePRE,
                },
                host : process.env.HostTokenTest,
            });
        })
        it('In development env ', async () => {
            process.env.NODE_ENV = 'development';
            const response = usersController.getGochargeHostAndAuth();
            expect(response).toMatchObject({
                auth : {
                    username: process.env.UserNameWebserviceGoChargePRE,
                    password: process.env.KeyWebserviceGoChargePRE,
                },
                host : process.env.HostTokenTest,
            });
        })
        it('In production env ', async () => {
            process.env.NODE_ENV = 'production';
            const response = usersController.getGochargeHostAndAuth();
            expect(response).toMatchObject({
                auth : {
                    username: process.env.UserNameWebserviceGoCharge,
                    password: process.env.KeyWebserviceGoCharge,
                },
                host : process.env.HostToken,
            });
        })
    });

    const POST_USER_PATH: string = '/api/private/users';
    describe(`POST ${POST_USER_PATH}`, () => {
        const POST_USER_BODY = {
            name: 'John Doe',
            country: 'Portugal',
            email: 'test@example.com',
            internationalPrefix: '+351',
            mobile: '912345678',
            password: 'P@ssw0rd',
            confPassword: 'P@ssw0rd',
            username: '123456789',
            addDriver: true
        };
        const POST_USER_HEADERS = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            client: ClientWhiteLabelsEnum.Hyundai,
            clientname: ClientTypeEnum.Backoffice,
            requestuserid: USER_EVIO._id,
            userid: USER_EVIO._id,
            accounttype: 'MASTER'
        };

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('Should throw BadRequest if there`s some validation error during middleware validation', async () => {
            const body = { ...POST_USER_BODY, mobile: 'ops!' };
            console.log(body);
            const response = await request(app)
                .post(`${POST_USER_PATH}/b2c`)
                .send(body)
                .set(POST_USER_HEADERS);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                auth: false,
                code: 'server_mobile_badNumber',
                message: 'Phone number with incorrect format'
            });
            expect(usersController.createUser).not.toHaveBeenCalled();
        });
    });
});
