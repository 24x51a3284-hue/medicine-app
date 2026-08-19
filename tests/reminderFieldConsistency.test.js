const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../db', () => {
  const fakeDb = { reminders: [], users: [] };
  return {
    readDB: jest.fn(() => fakeDb),
    writeDB: jest.fn((data) => { Object.assign(fakeDb, data); }),
  };
});

const profileRoutes = require('../backend/routes/profileRoutes');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/profile', profileRoutes);
  return app;
}

function tokenFor(user) {
  return jwt.sign(user, process.env.JWT_SECRET);
}

describe('profileRoutes reminders — scheduler field consistency', () => {
  test('POST /api/profile/reminders writes the "user" field the scheduler reads', async () => {
    const app = buildApp();
    const token = tokenFor({ id: 'user123', role: 'user' });
    const res = await request(app)
      .post('/api/profile/reminders')
      .set('Authorization', 'Bearer ' + token)
      .send({ medicineName: 'Paracetamol', time: '09:00', frequency: 'Daily' });
    expect(res.status).toBe(201);
    expect(res.body.user).toBe('user123');
  });
});
