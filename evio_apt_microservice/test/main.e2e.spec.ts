import { beforeAll, describe, expect, test } from '@jest/globals'
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { MainController } from '../src/main.controller'

describe('MainController e2e', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MainController],
    }).compile()

    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('health check', () => {
    test('GET /health should return OK', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .then((response) => {
          expect(response).toBeDefined()
          expect(response.text).toBe('OK')
        })
    })

    test('GET /status should return OK', () => {
      return request(app.getHttpServer())
        .get('/status')
        .expect(200)
        .then((response) => {
          expect(response).toBeDefined()
          expect(response.text).toBe('OK')
        })
    })
  })

  describe('ping', () => {
    test('GET /ping should return pong', () => {
      return request(app.getHttpServer())
        .get('/ping')
        .expect(200)
        .then((response) => {
          expect(response).toBeDefined()
          expect(response.text).toBe('pong')
        })
    })
  })
})
