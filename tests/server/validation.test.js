// @vitest-environment node

import {
  validateEmail,
  validatePassword,
  validatePagination,
  validateUrl,
} from '../../server/lib/validation.js';

describe('validation', () => {
  it('validateEmail accepts valid emails and trims whitespace', () => {
    expect(validateEmail(' user@example.com ').isValid).toBe(true);
  });

  it('validateEmail rejects invalid formats', () => {
    expect(validateEmail('').isValid).toBe(false);
    expect(validateEmail('not-an-email').isValid).toBe(false);
  });

  it('validatePassword returns strength and detailed errors', () => {
    const weak = validatePassword('abc');
    expect(weak.isValid).toBe(false);
    expect(weak.strength).toBe('weak');
    expect(weak.errors?.length).toBeGreaterThan(0);

    const strong = validatePassword('A-strongP@ssw0rd!');
    expect(strong.isValid).toBe(true);
    expect(strong.strength).toBe('strong');
  });

  it('validateUrl only allows http/https', () => {
    expect(validateUrl('https://example.com').isValid).toBe(true);
    expect(validateUrl('ftp://example.com').isValid).toBe(false);
    expect(validateUrl('not a url').isValid).toBe(false);
  });

  it('validatePagination clamps values and computes skip', () => {
    expect(validatePagination('0', '0')).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(validatePagination('2', '10')).toEqual({ page: 2, limit: 10, skip: 10 });
    expect(validatePagination('1', '9999').limit).toBeLessThanOrEqual(100);
  });
});

