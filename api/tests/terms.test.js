jest.mock('../_shared/bb-client');
const bbClient = require('../_shared/bb-client');

function makeContext() {
  return { res: {}, log: jest.fn() };
}

const now = Date.now();
const MOCK_TERMS = [
  {
    id: '_1_1', name: 'Spring 2026',
    availability: { available: 'Yes' },
    startDate: new Date(now - 30 * 86400000).toISOString(),
    endDate: new Date(now + 60 * 86400000).toISOString(),
  },
  {
    id: '_2_1', name: 'Fall 2025',
    availability: { available: 'Yes' },
    startDate: new Date(now - 180 * 86400000).toISOString(),
    endDate: new Date(now - 10 * 86400000).toISOString(), // already ended
  },
  {
    id: '_3_1', name: 'Summer 2026',
    availability: { available: 'No' },
    startDate: new Date(now + 60 * 86400000).toISOString(),
    endDate: new Date(now + 120 * 86400000).toISOString(),
  },
];

test('returns only currently active terms', async () => {
  bbClient.bbFetchAll.mockResolvedValue(MOCK_TERMS);
  const handler = require('../terms');
  const context = makeContext();
  await handler(context, {});
  expect(context.res.status).toBe(200);
  expect(context.res.body.terms).toHaveLength(1);
  expect(context.res.body.terms[0].name).toBe('Spring 2026');
});

test('includes term with no dates when availability is Yes', async () => {
  bbClient.bbFetchAll.mockResolvedValue([
    { id: '_4_1', name: 'Open Term', availability: { available: 'Yes' } },
  ]);
  const handler = require('../terms');
  const context = makeContext();
  await handler(context, {});
  expect(context.res.body.terms).toHaveLength(1);
});

test('returns 500 on Blackboard API error', async () => {
  bbClient.bbFetchAll.mockRejectedValue(new Error('API error'));
  const handler = require('../terms');
  const context = makeContext();
  await handler(context, {});
  expect(context.res.status).toBe(500);
});
