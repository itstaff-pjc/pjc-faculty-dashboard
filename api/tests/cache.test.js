const { getToken, setToken, clearToken } = require('../_shared/cache');

describe('cache', () => {
  beforeEach(() => clearToken());

  test('returns null when no token cached', () => {
    expect(getToken()).toBeNull();
  });

  test('returns token when set and not yet expired', () => {
    setToken('tok_abc', 3600);
    expect(getToken()).toBe('tok_abc');
  });

  test('returns null when TTL is 0', () => {
    setToken('tok_abc', 0);
    expect(getToken()).toBeNull();
  });

  test('returns null when TTL is negative', () => {
    setToken('tok_abc', -1);
    expect(getToken()).toBeNull();
  });

  test('clearToken resets cache', () => {
    setToken('tok_abc', 3600);
    clearToken();
    expect(getToken()).toBeNull();
  });
});
