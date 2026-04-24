const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/auth/login ────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    try {
      const result = await pool.query(
        'SELECT id, name, email, password_hash, role, position, is_active FROM users WHERE email = $1',
        [email]
      );
      const user = result.rows[0];

      // Deliberate constant-time response to prevent user enumeration
      if (!user) {
        await pool.query(
          'INSERT INTO audit_logs (user_id, action, entity_type, details) VALUES ($1,$2,$3,$4)',
          [null, 'LOGIN_FAILED', 'users', JSON.stringify({ email, ip: req.ip })]
        );
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (!user.is_active) {
        return res.status(401).json({ error: 'Account is deactivated' });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        await pool.query(
          'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)',
          [user.id, 'LOGIN_FAILED', 'users', user.id, JSON.stringify({ ip: req.ip })]
        );
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const jti = crypto.randomUUID();
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, name: user.name, jti },
        process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      await pool.query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
        [user.id, 'LOGIN', 'users', user.id]
      );

      res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, position: user.position },
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ── POST /api/auth/logout ───────────────────────────────────────────────────
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const { jti, exp } = req.user;
    if (jti && exp) {
      // Store the revoked token until it would have naturally expired
      await pool.query(
        'INSERT INTO revoked_tokens (jti, expires_at) VALUES ($1, to_timestamp($2)) ON CONFLICT (jti) DO NOTHING',
        [jti, exp]
      );
      // Opportunistically clean up expired entries (non-blocking)
      pool.query('DELETE FROM revoked_tokens WHERE expires_at <= NOW()').catch(() => {});
    }

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
      [req.user.id, 'LOGOUT', 'users', req.user.id]
    );

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/register (admin only) ───────────────────────────────────
router.post(
  '/register',
  authMiddleware,
  requireRole('admin'),
  [
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('email').isEmail().normalizeEmail(),
    body('password')
      .isLength({ min: 12 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/)
      .withMessage('Password must be at least 12 characters and include uppercase, lowercase, number, and special character'),
    body('role').isIn(['admin', 'manager', 'staff']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role, position, employment_type, phone, address, availability } = req.body;
    try {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const password_hash = await bcrypt.hash(password, 12);
      const result = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, position, employment_type, phone, address, availability)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, name, email, role, position`,
        [name, email, password_hash, role, position, employment_type, phone, address, availability]
      );

      await pool.query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
        [req.user.id, 'CREATE_USER', 'users', result.rows[0].id]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, position, phone, address, is_active FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
