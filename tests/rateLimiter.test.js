const express = require('express');
const request = require('supertest');
const { authLimiter, otpLimiter, generalLimiter, uploadLimiter } = require('../backend/middleware/rateLimiter');

describe('rateLimiter middleware', () => {
  test('exports all four limiters as callable middleware functions', () => {
    [authLimiter, otpLimiter, generalLimiter, uploadLimiter].forEach(limiter => {
      expect(typeof limiter).toBe('function');
    });
  });

  test('authLimiter blocks the 6th request from the same IP within the window', async () => {
    const app = express();
    app.get('/test', authLimiter, (req, res) => res.json({ ok: true }));
    let lastStatus;
    for (let i = 0; i < 6; i++) {
      const res = await request(app).get('/test');
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
