let _token = null;
let _expiry = 0;

function getToken() {
  if (_token && Date.now() < _expiry) return _token;
  return null;
}

function setToken(token, ttlSeconds) {
  _token = token;
  _expiry = Date.now() + ttlSeconds * 1000;
}

function clearToken() {
  _token = null;
  _expiry = 0;
}

// Generic response cache keyed by string
const _cache = new Map();

function getCached(key) {
  const entry = _cache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.value;
  return null;
}

function setCached(key, value, ttlSeconds) {
  _cache.set(key, { value, expiry: Date.now() + ttlSeconds * 1000 });
}

module.exports = { getToken, setToken, clearToken, getCached, setCached };
