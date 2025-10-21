jest.mock('axios')

import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { of } from 'rxjs'
import { AppModule } from '@/app.module'
import { HttpService } from '@nestjs/axios'
import { AxiosResponse } from 'axios'

describe('Change Availability (e2e)', () => {
    let app: INestApplication
    let httpService: HttpService

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile()

        app = moduleFixture.createNestApplication()
        httpService = app.get<HttpService>(HttpService)
        jest.spyOn(httpService, 'post').mockImplementation(() =>
            of({
                data: { status: 'Accepted' },
                status: 200,
                statusText: 'OK',
                headers: {} as any,
                config: { headers: {} } as any,
            } as AxiosResponse),
        )
        await app.init()
    })

    afterAll(async () => {
        jest.clearAllMocks()
        await app.close()
    })

    it('should return status "Accepted" for a valid changeAvailability command', () => {
        const hwId = 'charger123'
        const connectorId = 1
        const availability = 'Operative'
        return request(app.getHttpServer())
            .post(`/charger/command/${hwId}/change-availability/${connectorId}/${availability}`)
            .expect(200)
            .expect({ status: 'Accepted' })
    })

    it('should return 400 for an invalid availability parameter', () => {
        const hwId = 'charger123'
        const connectorId = 1
        const availability = 'invalid'
        return request(app.getHttpServer())
            .post(`/charger/command/${hwId}/change-availability/${connectorId}/${availability}`)
            .expect(400)
    })
})
