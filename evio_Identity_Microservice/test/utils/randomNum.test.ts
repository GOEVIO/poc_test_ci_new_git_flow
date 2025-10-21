import { describe, expect, it } from '@jest/globals';
import { getRandomInt } from '../../utils/randomNum';

describe('Random Num Utils', () => {
    describe('positive range of numbers', () => {
        it('returns positive number', () => {
            const initial = 0;
            const end = 10;
            const result = getRandomInt(initial, end);
            expect(result).toBeInstanceOf(Number);
            expect(result > -1).toBe(true);
        });
    });

    describe('negative range of numbers', () => {
        it('returns negative number', () => {
            const initial = -10;
            const end = -9;
            const result = getRandomInt(initial, end);
            expect(result).toBeInstanceOf(Number);
            expect(result > 0).toBe(false);
        });
    });
});