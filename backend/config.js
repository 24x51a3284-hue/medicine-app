const crypto = require('crypto');

// Centralized JWT secret handling.
// If JWT_SECRET isn't set in .env, we generate a random one at boot instead
// of using a guessable hardcoded value like 'secret123'. This still isn't
// ideal (tokens become invalid on every restart), so ALWAYS set a real
// JWT_SECRET in your .env before deploying to production.
let secret = process.env.JWT_SECRET;

if (!secret) {
  secret = crypto.randomBytes(48).toString('hex');
  console.warn('⚠️  WARNING: JWT_SECRET not set in .env — using a random secret for this session.');
  console.warn('⚠️  All users will be logged out on every server restart until you set JWT_SECRET in .env.');
  console.warn('⚠️  Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
}

module.exports = { JWT_SECRET: secret };
