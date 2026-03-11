import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../app.js';

describe('App integration', () => {
  const app = createApp();

  describe('GET /health', () => {
    it('responds with 200 and status ok', async () => {
      const response = await request(app)
        .get('/health')
        .set('Accept', 'application/json');

      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  it('returns 404 for unknown routes', async () => {
    const response = await request(app).get('/nonexistent');
    expect(response.status).toBe(404);
  });
});
