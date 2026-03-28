const { readBlob } = require('../_shared/blob-client');
const { getCached, setCached } = require('../_shared/cache');

const CACHE_TTL_SECONDS = 300; // 5 minutes

const VALID_USER_ID = /^[a-zA-Z0-9_-]+$/;

module.exports = async function (context, req) {
  const userId = req.params?.id;
  if (!userId) {
    context.res = { status: 400, body: { error: 'Missing instructor id' } };
    return;
  }
  if (!VALID_USER_ID.test(userId)) {
    context.res = { status: 400, body: { error: 'Invalid instructor id' } };
    return;
  }

  try {
    const cacheKey = `instructor:${userId}`;
    const cached = getCached(cacheKey);
    if (cached) {
      context.res = { status: 200, body: cached };
      return;
    }
    const body = await readBlob(`instructor/${userId}.json`);
    setCached(cacheKey, body, CACHE_TTL_SECONDS);
    context.res = { status: 200, body };
  } catch (err) {
    if (err.message && err.message.includes('BlobNotFound')) {
      context.res = { status: 404, body: { error: 'Instructor not found' } };
      return;
    }
    context.log('Error in /api/instructor:', err.message);
    context.res = { status: 500, body: { error: 'Failed to load instructor detail' } };
  }
};
