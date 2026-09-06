const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');

const { authenticateJwt } = require('../middleware/auth.middleware');
const { findAuthUserByEmail, toPublicUser } = require('../data/auth-users');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Email and password are required',
    });
  }

  const user = findAuthUserByEmail(email);

  if (!user) {
    return res.status(401).json({
      error: 'InvalidCredentialsError',
      message: 'Invalid email or password',
    });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return res.status(401).json({
      error: 'InvalidCredentialsError',
      message: 'Invalid email or password',
    });
  }

  const publicUser = toPublicUser(user);
  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    },
  );

  return res.json({
    token,
    tokenType: 'Bearer',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    user: publicUser,
  });
});

router.get('/me', authenticateJwt, (req, res) => {
  res.json({
    user: req.user,
  });
});

module.exports = router;
