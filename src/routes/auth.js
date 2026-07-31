import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { isDBReady } from '../config/db.js';
import { requireAuth, createToken } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { sendPasswordResetEmail } from '../services/emailService.js';

const router = Router();

function normalizeCredentials(body) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  return { email, password };
}

function publicUser(user) {
  return { id: user._id.toString(), email: user.email };
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

router.post('/register', async (req, res) => {
  try {
    if (!isDBReady()) return res.status(503).json({ success: false, error: 'Database is not connected.' });
    const { email, password } = normalizeCredentials(req.body);
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
    if (password.length < 8) return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });

    const exists = await User.exists({ email });
    if (exists) return res.status(409).json({ success: false, error: 'An account with that email already exists.' });

    const user = await User.create({ email, passwordHash: await bcrypt.hash(password, 12) });
    return res.status(201).json({ success: true, token: createToken(user._id), user: publicUser(user) });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ success: false, error: 'An account with that email already exists.' });
    console.error('[POST /auth/register] error:', err);
    return res.status(500).json({ success: false, error: 'Could not create your account.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    if (!isDBReady()) return res.status(503).json({ success: false, error: 'Database is not connected.' });
    const { email, password } = normalizeCredentials(req.body);
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ success: false, error: 'Incorrect email or password.' });
    }
    return res.json({ success: true, token: createToken(user._id), user: publicUser(user) });
  } catch (err) {
    console.error('[POST /auth/login] error:', err);
    return res.status(500).json({ success: false, error: 'Could not sign you in.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).lean();
  if (!user) return res.status(401).json({ success: false, error: 'Your account no longer exists.' });
  return res.json({ success: true, user: { id: user._id.toString(), email: user.email } });
});

function getPasswordResetRedirectUrl() {
  const redirectUrl = process.env.PASSWORD_RESET_REDIRECT_URL?.trim();
  if (redirectUrl) return redirectUrl;

  const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean);
  return origins[0] || 'http://localhost:5173';
}

function buildPasswordResetUrl(email, token) {
  const base = getPasswordResetRedirectUrl();
  try {
    return new URL(`/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`, base).toString();
  } catch {
    return `${base.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  }
}

router.post('/forgot-password', async (req, res) => {
  try {
    if (!isDBReady()) return res.status(503).json({ success: false, error: 'Database is not connected.' });

    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
    }

    const user = await User.findOne({ email });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + (parseInt(process.env.PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES, 10) || 60) * 60000);

      user.resetPasswordToken = hashResetToken(token);
      user.resetPasswordExpires = expires;
      await user.save();

      const resetUrl = buildPasswordResetUrl(email, token);
      await sendPasswordResetEmail(email, resetUrl);
    }

    return res.json({ success: true, message: 'If that email is registered, password reset instructions have been sent.' });
  } catch (err) {
    console.error('[POST /auth/forgot-password] error:', err);
    return res.status(500).json({ success: false, error: 'Could not send password reset instructions.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    if (!isDBReady()) return res.status(503).json({ success: false, error: 'Database is not connected.' });

    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const token = typeof req.body.token === 'string' ? req.body.token : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
    }
    if (!token) {
      return res.status(400).json({ success: false, error: 'Reset token is required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
    }

    const user = await User.findOne({
      email,
      resetPasswordToken: hashResetToken(token),
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset token.' });
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.json({ success: true, message: 'Password has been reset. Please sign in with your new password.' });
  } catch (err) {
    console.error('[POST /auth/reset-password] error:', err);
    return res.status(500).json({ success: false, error: 'Could not reset your password.' });
  }
});

export default router;
