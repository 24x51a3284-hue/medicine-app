const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    next();
  } catch (e) {
    res.status(401).json({ message: 'Invalid token' });
  }
}

module.exports = { authMiddleware };
