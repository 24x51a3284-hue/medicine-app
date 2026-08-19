const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../db', () => {
  const fakeDb = { prescriptions: [] };
  return {
    readDB: jest.fn(() => fakeDb),
    writeDB: jest.fn((data) => { Object.assign(fakeDb, data); }),
  };
});

const prescriptionRoutes = require('../backend/routes/prescriptionRoutes');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/prescriptions', prescriptionRoutes);
  return app;
}

function tokenFor(user) {
  return jwt.sign(user, process.env.JWT_SECRET);
}

describe('prescriptionRoutes', () => {
  test('GET /mine requires authentication', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/prescriptions/mine');
    expect(res.status).toBe(401);
  });

  test('POST /upload rejects a request with no file attached', async () => {
    const app = buildApp();
    const token = tokenFor({ id: 'user123', role: 'user' });
    const res = await request(app).post('/api/prescriptions/upload').set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no file/i);
  });

  test('POST /upload requires authentication', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/prescriptions/upload');
    expect(res.status).toBe(401);
  });
});
