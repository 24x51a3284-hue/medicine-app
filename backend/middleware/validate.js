const { validationResult } = require('express-validator');

// Runs after express-validator's check(...) rules; returns a clean 400
// error if any rule failed, otherwise passes through to the route handler.
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  }
  next();
}

module.exports = { validate };
