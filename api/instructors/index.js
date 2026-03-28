const { readBlob } = require('../_shared/blob-client');
const { getCached, setCached } = require('../_shared/cache');

const CACHE_TTL_SECONDS = 300; // 5 minutes

module.exports = async function (context, _req) {
  try {
    const cached = getCached('instructors');
    if (cached) {
      context.res = { status: 200, body: cached };
      return;
    }
    const body = await readBlob('instructors.json');
    setCached('instructors', body, CACHE_TTL_SECONDS);
    context.res = { status: 200, body };
  } catch (err) {
    if (err.message && err.message.includes('BlobNotFound')) {
      context.res = {
        status: 503,
        body: { error: 'No sync data available. The nightly sync has not run yet.' },
      };
      return;
    }
    context.log('Error in /api/instructors:', err.message);
    context.res = { status: 500, body: { error: `Failed to load instructors: ${err.message}` } };
  }
};
