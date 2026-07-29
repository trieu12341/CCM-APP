import { describe, it, expect } from './test-runner.js';
import { formatCurrency, formatCurrencyVND, formatDate } from '../app.js';
import { formatToMonthYear } from '../cashflow/cashflow-ui-utils.js';

describe('Formatting Functions', () => {
    it('formatCurrency formats to USD with $ symbol', () => {
        expect(formatCurrency(1234567.89)).toBe('$1,234,567.89');
        expect(formatCurrency(0)).toBe('$0');
        expect(formatCurrency(null)).toBe('$0');
    });

    it('formatCurrencyVND formats to VND without symbol', () => {
        expect(formatCurrencyVND(1234567.89)).toBe('1,234,567.89');
        expect(formatCurrencyVND(1000)).toBe('1,000');
    });

    it('formatDate formats ISO string to localized date', () => {
        const date = new Date('2024-12-01T00:00:00Z');
        expect(formatDate(date)).toBe('01/12/2024'); 
    });

    it('formatToMonthYear formats ISO string to mm/yyyy', () => {
        expect(formatToMonthYear('2024-12-01')).toBe('12/2024');
        expect(formatToMonthYear('invalid')).toBe('Invalid Date');
    });
});
