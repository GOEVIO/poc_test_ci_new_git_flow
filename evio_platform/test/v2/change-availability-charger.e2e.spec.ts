import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ChangeAvailabilityChargerService } from '@/v2/chargers/services/change-availability-charger.service';
import { LogsService } from '@/logs/logs.service';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosHeaders } from 'axios';
import { AvailabilityParameter } from '@/v2/chargers/enum/availability-parameters';
import { CommandsResponse } from '@/v2/chargers/enum/commands';
import { BadRequestException } from '@nestjs/common';

function createAxiosResponse<T>(data: T): AxiosResponse<T> {
    return {
        data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: new AxiosHeaders() },
    };
}

describe('ChangeAvailabilityChargerService', () => {
    let service: ChangeAvailabilityChargerService;
    let httpService: HttpService;

    const mockLogger = {
        setContext: jest.fn(),
        warn: jest.fn(),
        log: jest.fn(),
    };

    const mockServiceUrl = {
        ocpp: 'http://fake-ocpp-url',
        chargers: 'http://fake-chargers-url',
    };

    const plugStatusMock = [
        { plugId: 1, status: '10' },
        { plugId: 2, status: '10' },
    ];

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChangeAvailabilityChargerService,
                {
                    provide: HttpService,
                    useValue: {
                        post: jest.fn(),
                        get: jest.fn(),
                    },
                },
                {
                    provide: LogsService,
                    useValue: mockLogger,
                },
                {
                    provide: 'CONFIGURATION(serviceUrl)',
                    useValue: {
                        ocpp: 'http://mock-ocpp',
                        chargers: 'http://mock-chargers',
                    },
                },
            ],
        }).compile();

        service = module.get<ChangeAvailabilityChargerService>(ChangeAvailabilityChargerService);
        httpService = module.get<HttpService>(HttpService);
    });

    it('should return ACCEPTED status', async () => {
        const response = createAxiosResponse({ status: CommandsResponse.ACCEPTED });
        jest.spyOn(httpService, 'post').mockReturnValue(of(response));

        const result = await service.executeChargerAvailabilityCommand('CHARGER001', AvailabilityParameter.OPERATIVE);
        expect(result).toEqual({ status: CommandsResponse.ACCEPTED });
    });

    it('should return SCHEDULED status', async () => {
        const response = createAxiosResponse({ status: CommandsResponse.SCHEDULED });
        jest.spyOn(httpService, 'post').mockReturnValue(of(response));

        const result = await service.executeChargerAvailabilityCommand('CHARGER001', AvailabilityParameter.OPERATIVE);
        expect(result).toEqual({ status: CommandsResponse.SCHEDULED });
    });

    it('should fallback if status is REJECTED', async () => {
        const postMock = jest.spyOn(httpService, 'post');
        const getMock = jest.spyOn(httpService, 'get');

        postMock.mockReturnValueOnce(of(createAxiosResponse({ status: CommandsResponse.REJECTED })));
        postMock.mockReturnValue(of(createAxiosResponse({}))); // fallback calls

        getMock.mockReturnValue(of(createAxiosResponse({ plugStatuses: plugStatusMock })));

        const result = await service.executeChargerAvailabilityCommand('CHARGER001', AvailabilityParameter.OPERATIVE);
        expect(result).toEqual({ status: 'FALLBACK_FAILED' });
        expect(postMock).toHaveBeenCalledTimes(1 + plugStatusMock.length);
    });

    it('should fallback if an unknown error occurs', async () => {
        const postMock = jest.spyOn(httpService, 'post').mockReturnValueOnce(
            throwError(() => new Error('Timeout or network error'))
        );

        jest.spyOn(httpService, 'get').mockReturnValue(of(createAxiosResponse({ plugStatuses: plugStatusMock })));

        const result = await service.executeChargerAvailabilityCommand('CHARGER001', AvailabilityParameter.OPERATIVE);
        expect(result).toEqual({ status: 'FALLBACK_FAILED' });
    });

    it('should throw BadRequestException and not fallback', async () => {
        const badRequest = new BadRequestException('Invalid input');

        jest.spyOn(httpService, 'post').mockReturnValueOnce(
            throwError(() => badRequest)
        );

        await expect(
            service.executeChargerAvailabilityCommand('CHARGER001', AvailabilityParameter.OPERATIVE)
        ).rejects.toThrow(BadRequestException);
    });

    it('should send ChangeAvailability to each plug during fallback', async () => {
        const postMock = jest.spyOn(httpService, 'post').mockReturnValue(of(createAxiosResponse({})));

        jest.spyOn(httpService, 'get').mockReturnValue(of(createAxiosResponse({ plugStatuses: plugStatusMock })));

        await (service as any).sendChangeAvailabilityPerPlug('CHARGER001', AvailabilityParameter.OPERATIVE);

        expect(postMock).toHaveBeenCalledTimes(plugStatusMock.length);
    });
});
