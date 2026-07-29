import { describe, it, expect } from './test-runner.js';
import { parseFormattedNumber } from '../tender/tender-calc.js';

describe('Math & Parsing Functions', () => {
    it('parseFormattedNumber parses string with commas into float', () => {
        expect(parseFormattedNumber('1,234,567.89')).toBe(1234567.89);
        expect(parseFormattedNumber('1,000')).toBe(1000);
    });

    it('parseFormattedNumber handles numbers directly', () => {
        expect(parseFormattedNumber(500.5)).toBe(500.5);
    });

    it('parseFormattedNumber handles empty or null values', () => {
        expect(parseFormattedNumber('')).toBe(0);
        expect(parseFormattedNumber(null)).toBe(0);
        expect(parseFormattedNumber(undefined)).toBe(0);
    });
});
