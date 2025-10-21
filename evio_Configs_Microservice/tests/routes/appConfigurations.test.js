const express = require('express');
const request = require('supertest');
const app = require('../../app');
const appConfigurations = require('../../models/appConfigurations');
jest.mock('../../models/appConfigurations');
jest.mock('../../middlewares/appConfigurations');

describe('App Configuration Routes', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn()
    };
  });

  describe('POST /api/private/configs/apps', () => {
    it('should create a new app configuration', async () => {
      jest.spyOn(appConfigurations, 'createAppConfig').mockResolvedValue({ _id: 'new-config-id' });


      const response = await request(app).post('/api/private/configs/apps')
        .send( {clientName: 'test-client', mapsConfiguration: {maxMap: 4.5, maxRankings: 7}} )

      expect(response.statusCode).toEqual(201);
      console.log(response.body)
      expect(response.body.config._id).toEqual('new-config-id');
    });

    it('should return error status when configuration creation fails', async () => {
        jest.spyOn(appConfigurations, 'createAppConfig').mockRejectedValue(new Error('Failed to create app configuration'));
        
        const response = await request(app).post('/api/private/configs/apps')
          .send({ clientName: 'test-client', mapsConfiguration: { maxMap: 4.5, maxRankings: 7 } });
      
        expect(response.statusCode).toEqual(500);
        expect(response.body.auth).toBe(false);
        expect(response.body.code).toBe('error_single_config_creation');
      });
  });
  describe('GET /api/private/configs/apps', () => {
    it('should fetch all app configurations', async () => {
      const configs = [{ id: 'config1', name: 'Test Config' }];
      jest.spyOn(require('../../models/appConfigurations'), 'getAllAppConfigs').mockResolvedValue(configs);

      const response = await request(app).get('/api/private/configs/apps');

      expect(response.statusCode).toEqual(200);
      expect(response.body.configs).toEqual(configs);
    });

    it('should return error status when fetching configurations fails', async () => {
      jest.spyOn(require('../../models/appConfigurations'), 'getAllAppConfigs').mockRejectedValue(new Error('Failed to fetch app configurations'));

      const response = await request(app).get('/api/private/configs/apps');

      expect(response.statusCode).toEqual(500);
      expect(response.body.auth).toBe(false);
      expect(response.body.code).toBe('error_fetching_configs');
    });
  });
  
  describe('GET /api/private/configs/apps/client/:clientName', () => {
    it('should fetch configs by client name', async () => {
      const configs = [{ id: 'config1', name: 'Test Config' }];
      jest.spyOn(require('../../models/appConfigurations'), 'getAppConfigsWithClientName').mockResolvedValue(configs);

      const response = await request(app).get('/api/private/configs/apps/client/test-client');

      expect(response.statusCode).toEqual(200);
      expect(response.body.configs).toEqual(configs);
    });

    it('should return error status when fetching configs by client fails', async () => {
      jest.spyOn(require('../../models/appConfigurations'), 'getAppConfigsWithClientName').mockRejectedValue(new Error('Failed to fetch app configurations by client'));

      const response = await request(app).get('/api/private/configs/apps/client/test-client');

      expect(response.statusCode).toEqual(500);
      expect(response.body.auth).toBe(false);
      expect(response.body.code).toBe('error_fetching_configs_by_client');
    });

    it('should return error status when configs not found', async () => {
      jest.spyOn(require('../../models/appConfigurations'), 'getAppConfigsWithClientName').mockResolvedValue([]);

      const response = await request(app).get('/api/private/configs/apps/client/test-client');

      expect(response.statusCode).toEqual(400);
      expect(response.body.auth).toBe(false);
      expect(response.body.code).toBe('configs_not_found');
      expect(response.body.message).toBe('App configurations not found');
    });
  });

  describe('PATCH /api/private/configs/apps/client/:clientName', () => {
    it('should update config by client name', async () => {
      const updates = { mapsConfiguration: { maxMap: 5 } };
      const updatedConfig = { _id: 'updated-config-id', ...updates };
      jest.spyOn(require('../../models/appConfigurations'), 'updateAppConfigByClientName').mockResolvedValue(updatedConfig);

      const response = await request(app).patch('/api/private/configs/apps/client/test-client')
        .send(updates);

      expect(response.statusCode).toEqual(200);
      expect(response.body.config._id).toEqual('updated-config-id');
      expect(response.body.config.mapsConfiguration.maxMap).toEqual(5);
    });

    it('should return error status when updating config by client fails', async () => {
      jest.spyOn(require('../../models/appConfigurations'), 'updateAppConfigByClientName').mockRejectedValue(new Error('Failed to update app configuration by client'));

      const response = await request(app).patch('/api/private/configs/apps/client/test-client')
        .send({ mapsConfiguration: { maxMap: 5 } });

      expect(response.statusCode).toEqual(500);
      expect(response.body.auth).toBe(false);
      expect(response.body.code).toBe('error_fetching_config_by_client');
    });

    it('should return error status when config not found', async () => {
      jest.spyOn(require('../../models/appConfigurations'), 'updateAppConfigByClientName').mockResolvedValue(null);

      const response = await request(app).patch('/api/private/configs/apps/client/test-client')
        .send({ mapsConfiguration: { maxMap: 5 } });

      expect(response.statusCode).toEqual(400);
      expect(response.body.auth).toBe(false);
      expect(response.body.code).toBe('config_not_found');
      expect(response.body.message).toBe('App configuration not found');
    });
  });

  describe('PATCH /api/private/configs/apps/bulk', () => {
    it('should validate updates before updating configurations', async () => {
      const updates = { invalidField: 'invalid_value' };
      const result = { invalid: true, statusCode: 400, code: 'error_batch_updating_configs', message: 'Invalid field in updates' };
      jest.spyOn(require('../../middlewares/appConfigurations'), 'validateUpdates').mockReturnValue(result);

      const response = await request(app).patch('/api/private/configs/apps/bulk')
        .send({ updates: updates });

      expect(response.statusCode).toEqual(400);
      expect(response.body.auth).toBe(false);
      expect(response.body.code).toBe('error_batch_updating_configs');
      expect(response.body.message).toBe('Invalid field in updates');
    });

    it('should return error status when validation fails', async () => {
      const updates = { invalidField: 'invalid_value' };
      const result = { invalid: true, statusCode: 400, code: 'error_batch_updating_configs', message: 'Invalid field in updates' };
      jest.spyOn(require('../../middlewares/appConfigurations'), 'validateUpdates').mockReturnValue(result);

      const response = await request(app).patch('/api/private/configs/apps/bulk')
        .send({ updates: updates });

      expect(response.statusCode).toEqual(400);
      expect(response.body.auth).toBe(false);
      expect(response.body.code).toBe('error_batch_updating_configs');
      expect(response.body.message).toBe('Invalid field in updates');
    });

    it('should batch update configs successfully', async () => {
      const updates = {updates: { mapsConfiguration: { maxMap: 5, maxRankings: 7 } }};
      jest.spyOn(require('../../middlewares/appConfigurations'), 'validateUpdates').mockReturnValue({ valid: true });
      console.log("test", updates);
      const updatedConfigs = { nModified: 2, n: 3 };
      jest.spyOn(require('../../models/appConfigurations'), 'batchUpdateAppConfigForAllClients').mockResolvedValue(updatedConfigs);

      const response = await request(app).patch('/api/private/configs/apps/bulk')
        .send({ updates: updates });
      console.log("test", response.body);
      expect(response.statusCode).toEqual(200);
      expect(response.body.totalClientsModified).toEqual(2);
      expect(response.body.totalClients).toEqual(3);
    });

    it('should return error status when batch updating configs fails', async () => {
      const updates = {updates: { mapsConfiguration: { maxMap: 5, maxRankings: 7 } }};
      jest.spyOn(require('../../models/appConfigurations'), 'batchUpdateAppConfigForAllClients').mockRejectedValue(new Error('Failed to perform batch update on app configurations'));

      const response = await request(app).patch('/api/private/configs/apps/bulk')
        .send({ updates: updates });
      
      expect(response.statusCode).toEqual(500);
      expect(response.body.auth).toBe(false);
      expect(response.body.code).toBe('error_batch_updating_configs');
      expect(response.body.message).toBe('Error performing batch update on app configurations');
    });
  });
});