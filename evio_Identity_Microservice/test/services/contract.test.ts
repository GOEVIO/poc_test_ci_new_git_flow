import { describe, expect, it } from '@jest/globals';
import contractService from '../../services/contracts';


describe('Test Suit for contracts service', () => {

    describe('validateContract', () => {
        it('should return error when cardPhysicalLicensePlate length is more than 30', () => {
            const contract = {
                cardPhysicalLicensePlate: '123456789012345678901234567890123',
            };
            const headers = {};
            const result = contractService.validateContract(contract, headers);
            expect(result).toEqual({
                auth: false,
                code: 'cardPhysicalLicensePlate_length_exceeded',
                message: 'The Card Physical License Plate should not exceed 30 characters.'
            });
        });

        it('should return error when cardPhysicalText length is more than 15', () => {
            const contract = {
                cardPhysicalText: '1234567890123456',
            };
            const headers = {};
            const result = contractService.validateContract(contract, headers);
            expect(result).toEqual({
                auth: false,
                code: 'cardPhysicalText_length_exceeded',
                message: 'The Card Physical Text should not exceed 15 characters.'
            });
        });

        it('should return error when cardPhysicalName length is more than 30', () => {
            const contract = {
                cardPhysicalName: '1234567890123456789012345678901',
            };
            const headers = {};
            const result = contractService.validateContract(contract, headers);
            expect(result).toEqual({
                auth: false,
                code: 'cardPhysicalName_length_exceeded',
                message: 'The Card Physical Name should not exceed 30 characters.'
            });
        });

        it('should return null when all validations pass', () => {
            const contract = {
                cardPhysicalLicensePlate: '123456789012345',
                cardPhysicalText: '123456789012345',
                cardPhysicalName: '123456789012345678901234567890',
            };
            const headers = {}; // Assuming validateUserPerClientName returns true for these headers
            const result = contractService.validateContract(contract, headers);
            expect(result).toBeNull();
        });
    });
});