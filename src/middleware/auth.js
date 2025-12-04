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
  // For cross-origin requests (frontend on different domain), we need:
  // - sameSite: 'none' (allows cross-origin cookies)
  // - secure: true (required when sameSite is 'none')
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOpts = {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-origin in production
    secure: isProduction, // true in production (required for sameSite: 'none')
  };
  res.cookie('access_token', tokens.accessToken, { ...cookieOpts, maxAge: 15 * 60 * 1000 });
  res.cookie('refresh_token', tokens.refreshToken, { ...cookieOpts, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

function clearAuthCookies(res) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOpts = {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
  };
  res.clearCookie('access_token', cookieOpts);
  res.clearCookie('refresh_token', cookieOpts);
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