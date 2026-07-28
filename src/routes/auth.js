import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { isDBReady } from '../config/db.js';
import { requireAuth, createToken } from '../middleware/auth.js';
import { User } from '../models/User.js';

const router = Router();

function normalizeCredentials(body) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  return { email, password };
}

function publicUser(user) {
  return { id: user._id.toString(), email: user.email };
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

export default router;
