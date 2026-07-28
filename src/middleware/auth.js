import jwt from 'jsonwebtoken';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured and at least 32 characters long.');
  }
  return secret;
}

export function createToken(userId) {
  return jwt.sign({ sub: userId.toString() }, getJwtSecret(), { expiresIn: '7d' });
}

export function requireAuth(req, res, next) {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ success: false, error: 'Authentication is required.' });
    }

    const payload = jwt.verify(token, getJwtSecret());
    req.userId = payload.sub;
    return next();
  } catch (err) {
    const error = err instanceof Error && err.message.includes('JWT_SECRET')
      ? 'Authentication is not configured on the server.'
      : 'Your session is invalid or has expired. Please sign in again.';
    return res.status(401).json({ success: false, error });
  }
}
