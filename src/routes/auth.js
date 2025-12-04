const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { signTokens, setAuthCookies, clearAuthCookies } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    // Support both JSON and form-encoded bodies
    const contentType = (req.headers['content-type'] || '').toLowerCase();
    let name, email, password;
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const body = req.body || {};
      name = body.name;
      email = body.email;
      password = body.password;
    } else {
      ({ name, email, password } = req.body || {});
    }

    if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' });

    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });

    // Ensure JWT secrets exist
    if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
      console.error('JWT secrets not configured');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const tokens = signTokens(user);
    setAuthCookies(res, tokens);

    return res.json({
      data: { user: { id: user.id, name: user.name, email: user.email } }
    });
  } catch (err) {
    console.error('Register error:', err.name, err.message);
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Email already registered' });
    }
    res.status(500).json({ message: 'Internal server error', details: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const contentType = req.headers['content-type'] || '';
    let email, password;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(req.body);
      email = params.get('email');
      password = params.get('password');
    } else {
      ({ email, password } = req.body);
    }

    if (!email || !password) return res.status(400).json({ message: 'Missing credentials' });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const tokens = signTokens(user);
    setAuthCookies(res, tokens);

    return res.json({
      data: { user: { id: user.id, name: user.name, email: user.email } }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/logout', async (req, res) => {
  clearAuthCookies(res);
  res.json({ message: 'Logged out' });
});

router.post('/refresh', async (req, res) => {
  const refresh = req.cookies.refresh_token;
  if (!refresh) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const payload = jwt.verify(refresh, process.env.JWT_REFRESH_SECRET);
    const accessToken = jwt.sign({ id: payload.id, email: payload.email, name: payload.name }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: process.env.TOKEN_EXPIRES_IN || '15m',
    });
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: (process.env.COOKIE_SECURE || 'false') === 'true',
      maxAge: 15 * 60 * 1000,
    });
    res.json({ message: 'refreshed' });
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
});

router.get('/me', async (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findByPk(payload.id);
    if (!user) return res.status(404).json({ message: 'Not found' });
    res.json({ data: { user: { id: user.id, name: user.name, email: user.email } } });
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
});

module.exports = router;