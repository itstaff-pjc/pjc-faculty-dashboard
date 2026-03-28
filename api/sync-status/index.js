const { readBlob } = require('../_shared/blob-client');
const { getCached, setCached } = require('../_shared/cache');

const CACHE_TTL_SECONDS = 60;

module.exports = async function (context, _req) {
  try {
    const cached = getCached('sync-status');
    if (cached) {
      context.res = { status: 200, body: cached };
      return;
    }
    const meta = await readBlob('meta.json');
    setCached('sync-status', meta, CACHE_TTL_SECONDS);
    context.res = { status: 200, body: meta };
  } catch (err) {
    if (err.message && err.message.includes('BlobNotFound')) {
      context.res = { status: 200, body: { status: 'no-sync', lastSync: null } };
      return;
    }
    context.log('Error in /api/sync-status:', err.message);
    context.res = { status: 500, body: { error: 'Failed to read sync status' } };
  }
};
