const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/clients
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, is_active } = req.query;
    let query = `
      SELECT id, name, ndis_number, dob, address, phone, email,
             emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
             care_plan, support_needs, risk_notes, is_active, created_at, updated_at
      FROM clients WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (search) {
      query += ` AND (name ILIKE $${idx} OR ndis_number ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }
    if (is_active !== undefined) {
      query += ` AND is_active = $${idx}`;
      params.push(is_active === 'true');
      idx++;
    }

    query += ' ORDER BY name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get clients error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/clients/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM clients WHERE id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Client not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/clients
router.post(
  '/',
  authMiddleware,
  requireRole('admin', 'manager'),
  [
    body('name').trim().notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      name, ndis_number, dob, address, phone, email,
      emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
      care_plan, support_needs, risk_notes
    } = req.body;

    try {
      const result = await pool.query(
        `INSERT INTO clients (name, ndis_number, dob, address, phone, email,
          emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
          care_plan, support_needs, risk_notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [name, ndis_number, dob || null, address, phone, email,
         emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
         care_plan, support_needs, risk_notes]
      );

      await pool.query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
        [req.user.id, 'CREATE_CLIENT', 'clients', result.rows[0].id]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Create client error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /api/clients/:id
router.put('/:id', authMiddleware, requireRole('admin', 'manager'), async (req, res) => {
  const { id } = req.params;
  const {
    name, ndis_number, dob, address, phone, email,
    emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
    care_plan, support_needs, risk_notes, is_active
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE clients SET
        name = COALESCE($1, name),
        ndis_number = COALESCE($2, ndis_number),
        dob = COALESCE($3, dob),
        address = COALESCE($4, address),
        phone = COALESCE($5, phone),
        email = COALESCE($6, email),
        emergency_contact_name = COALESCE($7, emergency_contact_name),
        emergency_contact_phone = COALESCE($8, emergency_contact_phone),
        emergency_contact_relation = COALESCE($9, emergency_contact_relation),
        care_plan = COALESCE($10, care_plan),
        support_needs = COALESCE($11, support_needs),
        risk_notes = COALESCE($12, risk_notes),
        is_active = COALESCE($13, is_active),
        updated_at = NOW()
       WHERE id = $14 RETURNING *`,
      [name, ndis_number, dob || null, address, phone, email,
       emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
       care_plan, support_needs, risk_notes, is_active, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Client not found' });

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
      [req.user.id, 'UPDATE_CLIENT', 'clients', id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update client error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/clients/:id (soft delete)
router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE clients SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Client not found' });

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
      [req.user.id, 'DEACTIVATE_CLIENT', 'clients', req.params.id]
    );

    res.json({ message: 'Client deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
