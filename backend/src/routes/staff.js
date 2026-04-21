const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/staff
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, role, is_active } = req.query;
    let query = `
      SELECT u.id, u.name, u.email, u.role, u.position, u.employment_type,
             u.phone, u.address, u.availability, u.is_active, u.created_at,
             COUNT(CASE WHEN d.status = 'expired' THEN 1 END) AS expired_docs,
             COUNT(CASE WHEN d.status = 'expiring_soon' THEN 1 END) AS expiring_docs
      FROM users u
      LEFT JOIN documents d ON d.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (search) {
      query += ` AND (u.name ILIKE $${idx} OR u.email ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }
    if (role) {
      query += ` AND u.role = $${idx}`;
      params.push(role);
      idx++;
    }
    if (is_active !== undefined) {
      query += ` AND u.is_active = $${idx}`;
      params.push(is_active === 'true');
      idx++;
    }

    // Staff users see only themselves
    if (req.user.role === 'staff') {
      query += ` AND u.id = $${idx}`;
      params.push(req.user.id);
      idx++;
    }

    query += ' GROUP BY u.id ORDER BY u.name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get staff error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/staff/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Staff can only view themselves
    if (req.user.role === 'staff' && req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `SELECT id, name, email, role, position, employment_type, phone, address, availability, is_active, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Staff member not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/staff
router.post(
  '/',
  authMiddleware,
  requireRole('admin'),
  [
    body('name').trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('role').isIn(['admin', 'manager', 'staff']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, password, role, position, employment_type, phone, address, availability } = req.body;
    try {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already registered' });

      const password_hash = await bcrypt.hash(password, 10);
      const result = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, position, employment_type, phone, address, availability)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id, name, email, role, position, employment_type, phone, address, availability, is_active, created_at`,
        [name, email, password_hash, role, position, employment_type, phone, address, availability]
      );

      await pool.query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
        [req.user.id, 'CREATE_STAFF', 'users', result.rows[0].id]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Create staff error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /api/staff/:id
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  // Staff can only update themselves; admin/manager can update anyone
  if (req.user.role === 'staff' && req.user.id !== parseInt(id)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { name, email, role, position, employment_type, phone, address, availability, is_active, password } = req.body;
  try {
    // Only admins can change roles or deactivate
    const updateRole = req.user.role === 'admin' ? role : undefined;
    const updateActive = req.user.role === 'admin' ? is_active : undefined;

    let updateQuery = `
      UPDATE users SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        position = COALESCE($3, position),
        employment_type = COALESCE($4, employment_type),
        phone = COALESCE($5, phone),
        address = COALESCE($6, address),
        availability = COALESCE($7, availability),
        updated_at = NOW()
    `;
    const params = [name, email, position, employment_type, phone, address, availability];
    let idx = 8;

    if (updateRole !== undefined) {
      updateQuery += `, role = $${idx}`;
      params.push(updateRole);
      idx++;
    }
    if (updateActive !== undefined) {
      updateQuery += `, is_active = $${idx}`;
      params.push(updateActive);
      idx++;
    }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      updateQuery += `, password_hash = $${idx}`;
      params.push(hash);
      idx++;
    }

    updateQuery += ` WHERE id = $${idx} RETURNING id, name, email, role, position, employment_type, phone, address, availability, is_active, updated_at`;
    params.push(id);

    const result = await pool.query(updateQuery, params);
    if (!result.rows[0]) return res.status(404).json({ error: 'Staff member not found' });

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
      [req.user.id, 'UPDATE_STAFF', 'users', id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update staff error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/staff/:id (admin only - soft delete)
router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot deactivate your own account' });
  }
  try {
    const result = await pool.query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Staff member not found' });

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
      [req.user.id, 'DEACTIVATE_STAFF', 'users', id]
    );

    res.json({ message: 'Staff member deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
