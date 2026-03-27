const { computeStatus, worstStatus } = require('../_shared/activity');

beforeEach(() => {
  delete process.env.BB_AT_RISK_DAYS;
  delete process.env.BB_INACTIVE_DAYS;
});

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

test('active when last accessed today', () => {
  expect(computeStatus(daysAgo(0))).toBe('active');
});

test('active when last accessed 7 days ago', () => {
  expect(computeStatus(daysAgo(7))).toBe('active');
});

test('at-risk when last accessed 8 days ago', () => {
  expect(computeStatus(daysAgo(8))).toBe('at-risk');
});

test('at-risk when last accessed 14 days ago', () => {
  expect(computeStatus(daysAgo(14))).toBe('at-risk');
});

test('inactive when last accessed 15 days ago', () => {
  expect(computeStatus(daysAgo(15))).toBe('inactive');
});

test('inactive when lastAccessed is null', () => {
  expect(computeStatus(null)).toBe('inactive');
});

test('respects BB_AT_RISK_DAYS env var', () => {
  process.env.BB_AT_RISK_DAYS = '5';
  expect(computeStatus(daysAgo(5))).toBe('at-risk');
  expect(computeStatus(daysAgo(4))).toBe('active');
});

test('respects BB_INACTIVE_DAYS env var', () => {
  process.env.BB_INACTIVE_DAYS = '10';
  expect(computeStatus(daysAgo(10))).toBe('inactive');
  expect(computeStatus(daysAgo(9))).toBe('at-risk');
});

test('worstStatus returns inactive over at-risk and active', () => {
  expect(worstStatus(['active', 'inactive', 'at-risk'])).toBe('inactive');
});

test('worstStatus returns at-risk over active', () => {
  expect(worstStatus(['active', 'at-risk', 'active'])).toBe('at-risk');
});

test('worstStatus returns active when all active', () => {
  expect(worstStatus(['active', 'active'])).toBe('active');
});
