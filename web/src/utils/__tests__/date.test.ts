import { LanguageAbbreviation } from '@/constants/common';
import {
  formatDate,
  formatPureDate,
  formatTime,
  getDateDisplayFormat,
  getDateTimeDisplayFormat,
} from '@/utils/date';

const timestamp = '2026-07-18 13:14:15';

describe('localized date display', () => {
  afterEach(() => localStorage.removeItem('lng'));

  it('uses the unified Chinese date-time format', () => {
    localStorage.setItem('lng', LanguageAbbreviation.Zh);

    expect(getDateDisplayFormat()).toBe('YYYY/MM/DD');
    expect(getDateTimeDisplayFormat()).toBe('YYYY/MM/DD HH:mm:ss');
    expect(formatDate(timestamp)).toBe('2026/07/18 13:14:15');
    expect(formatPureDate(timestamp)).toBe('2026/07/18 13:14:15');
    expect(formatTime(timestamp)).toBe('2026/07/18 13:14:15');
  });

  it('keeps the existing English display format', () => {
    localStorage.setItem('lng', LanguageAbbreviation.En);

    expect(formatDate(timestamp)).toBe('18/07/2026 13:14:15');
    expect(formatPureDate(timestamp)).toBe('18/07/2026');
    expect(formatTime(timestamp)).toBe('13:14:15');
  });

  it('honors explicit formats used for API serialization', () => {
    localStorage.setItem('lng', LanguageAbbreviation.Zh);

    expect(formatDate(timestamp, 'YYYY-MM-DDTHH:mm:ss')).toBe(
      '2026-07-18T13:14:15',
    );
  });
});
