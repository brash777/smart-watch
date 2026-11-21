import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { readError } from '../test/http';
import { createTestApp } from '../test/test-app';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('app', () => {
  it('answers unknown routes with 404 ROUTE_NOT_FOUND in the error shape', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(readError(response.body)).toEqual({
      code: 'ROUTE_NOT_FOUND',
      message: 'Route GET /api/does-not-exist not found',
      details: null,
    });
  });

  it('answers a malformed JSON body with 400 INVALID_JSON', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(response.status).toBe(400);
    expect(readError(response.body).code).toBe('INVALID_JSON');
  });

  it('answers a body over JSON_BODY_LIMIT with 413 PAYLOAD_TOO_LARGE', async () => {
    const { app } = createTestApp({ JSON_BODY_LIMIT: '10b' });

    const response = await request(app).post('/api/health').send({ note: 'longer than ten bytes' });

    expect(response.status).toBe(413);
    expect(readError(response.body).code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('gives every response a request id and keeps a valid incoming one', async () => {
    const { app } = createTestApp();
    const incoming = '0b8f6a4e-4f7d-4c55-9a0a-3c7f1c2d9e10';

    const generated = await request(app).get('/api/health');
    const echoed = await request(app).get('/api/health').set('X-Request-Id', incoming);
    const replaced = await request(app).get('/api/health').set('X-Request-Id', 'not-a-uuid');

    expect(generated.headers['x-request-id']).toMatch(UUID_PATTERN);
    expect(echoed.headers['x-request-id']).toBe(incoming);
    expect(replaced.headers['x-request-id']).toMatch(UUID_PATTERN);
  });

  it('sends security headers and hides the framework', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/api/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('allows the configured CORS origins only', async () => {
    const { app } = createTestApp({ CORS_ORIGINS: 'http://allowed.test' });

    const allowed = await request(app).get('/api/health').set('Origin', 'http://allowed.test');
    const blocked = await request(app).get('/api/health').set('Origin', 'http://evil.test');

    expect(allowed.headers['access-control-allow-origin']).toBe('http://allowed.test');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers 429 RATE_LIMITED once a client goes over RATE_LIMIT_MAX', async () => {
    const { app } = createTestApp({ RATE_LIMIT_MAX: '2' });

    await request(app).get('/api/health').expect(200);
    await request(app).get('/api/health').expect(200);
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(429);
    expect(readError(response.body).code).toBe('RATE_LIMITED');
  });
});
