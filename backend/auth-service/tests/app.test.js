const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cpbot_auth_test?schema=public';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-that-is-long-enough-123456';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS || 'http://localhost:5173';

const app = require('../src/app');

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const server = app.listen(0, () => {
      const { port } = server.address();
      const payload = body ? JSON.stringify(body) : null;
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
          ...headers
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
        });
      });
      req.on('error', (error) => {
        server.close();
        reject(error);
      });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

test('GET /health returns service health', async () => {
  const response = await request('GET', '/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.service, 'auth-service');
});

test('POST /api/v1/auth/register rejects weak passwords', async () => {
  const response = await request('POST', '/api/v1/auth/register', {
    email: 'test@example.com',
    password: '123'
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.code, 'VALIDATION_ERROR');
});

test('GET /api/v1/auth/me requires authentication', async () => {
  const response = await request('GET', '/api/v1/auth/me');
  assert.equal(response.status, 401);
  assert.equal(response.body.code, 'AUTH_REQUIRED');
});
