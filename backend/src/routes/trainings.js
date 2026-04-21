const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

const STATUS_SQL = `
  CASE
    WHEN expiry_date IS NULL THEN 'valid'
    WHEN expiry_date < CURRENT_DATE THEN 'expired'
    WHEN expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
    ELSE 'valid'
  END
`;

// GET /api/trainings
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { user_id, status } = req.query;
    const effectiveUserId = req.user.role === 'staff' ? req.user.id : user_id;

    let query = `
      SELECT t.id, t.user_id, t.training_name, t.completion_date, t.expiry_date,
             t.certificate_url, t.certificate_name,
             ${STATUS_SQL} AS status,
             t.notes, t.created_at, t.updated_at,
             u.name AS staff_name
      FROM trainings t
      JOIN users u ON u.id = t.user_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (effectiveUserId) {
      query += ` AND t.user_id = $${idx}`;
      params.push(effectiveUserId);
      idx++;
    }
    if (status) {
      query += ` AND ${STATUS_SQL} = $${idx}`;
      params.push(status);
      idx++;
    }

    query += ' ORDER BY t.expiry_date ASC NULLS LAST';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get trainings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/trainings/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, ${STATUS_SQL} AS computed_status, u.name AS staff_name
       FROM trainings t JOIN users u ON u.id = t.user_id
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Training not found' });
    if (req.user.role === 'staff' && result.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trainings
router.post('/', authMiddleware, requireRole('admin', 'manager'), async (req, res) => {
  const { user_id, training_name, completion_date, expiry_date, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO trainings (user_id, training_name, completion_date, expiry_date, notes)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *, ${STATUS_SQL} AS computed_status`,
      [user_id, training_name, completion_date || null, expiry_date || null, notes]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
      [req.user.id, 'CREATE_TRAINING', 'trainings', result.rows[0].id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create training error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trainings/upload
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { user_id, training_name, completion_date, expiry_date, notes } = req.body;
  const targetUserId = req.user.role === 'staff' ? req.user.id : (user_id || req.user.id);

  try {
    const certificateUrl = `/uploads/${req.file.filename}`;
    const result = await pool.query(
      `INSERT INTO trainings (user_id, training_name, certificate_url, certificate_name, completion_date, expiry_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *, ${STATUS_SQL} AS computed_status`,
      [targetUserId, training_name, certificateUrl, req.file.originalname, completion_date || null, expiry_date || null, notes]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
      [req.user.id, 'UPLOAD_TRAINING', 'trainings', result.rows[0].id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Upload training error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/trainings/:id
router.put('/:id', authMiddleware, requireRole('admin', 'manager'), async (req, res) => {
  const { id } = req.params;
  const { training_name, completion_date, expiry_date, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE trainings SET
        training_name = COALESCE($1, training_name),
        completion_date = COALESCE($2, completion_date),
        expiry_date = COALESCE($3, expiry_date),
        notes = COALESCE($4, notes),
        updated_at = NOW()
       WHERE id = $5
       RETURNING *, ${STATUS_SQL} AS computed_status`,
      [training_name, completion_date || null, expiry_date || null, notes, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Training not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update training error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/trainings/:id
router.delete('/:id', authMiddleware, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM trainings WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Training not found' });

    if (existing.rows[0].certificate_url) {
      const filePath = path.join(process.env.UPLOAD_DIR || './uploads', path.basename(existing.rows[0].certificate_url));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await pool.query('DELETE FROM trainings WHERE id = $1', [req.params.id]);

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
      [req.user.id, 'DELETE_TRAINING', 'trainings', req.params.id]
    );

    res.json({ message: 'Training deleted' });
  } catch (err) {
    console.error('Delete training error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
