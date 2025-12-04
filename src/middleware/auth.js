const jwt = require('jsonwebtoken');

function signTokens(user) {
  const payload = { id: user.id, email: user.email, name: user.name };
  const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.TOKEN_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
}

function setAuthCookies(res, tokens) {
  const isSecure = (process.env.COOKIE_SECURE || 'false') === 'true';
  const cookieOpts = {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
  };
  res.cookie('access_token', tokens.accessToken, { ...cookieOpts, maxAge: 15 * 60 * 1000 });
  res.cookie('refresh_token', tokens.refreshToken, { ...cookieOpts, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

function clearAuthCookies(res) {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
}

function requireAuth(req, res, next) {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

module.exports = { signTokens, setAuthCookies, clearAuthCookies, requireAuth };