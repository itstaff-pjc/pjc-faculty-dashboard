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

module.exports = { getToken, setToken, clearToken };
