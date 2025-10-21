const request = require('supertest');
const {
  describe, expect, it
} = require('@jest/globals');
const app = require('../../app');

describe('Health Check Controller', () => {
  it('should check the current state API', async () => {
    const response = await request(app).get('/api/private/healthCheck').set('Content-Type', 'application/text');

    expect(response.statusCode).toBe(200);
  });
});
