const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { validateMagicBytes, safeDeleteFile } = require('../middleware/upload');

const router = express.Router();

const VALID_STATUSES   = ['open', 'under_review', 'resolved', 'closed'];
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];

// Strip fields that staff should not see
const sanitizeForRole = (row, role) => {
  if (role === 'staff') {
    const { supervisor_notes, ...rest } = row;
    return rest;
  }
  return row;
};

// ── GET /api/incidents ──────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { client_id, status, severity } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    let query = `
      SELECT i.id, i.client_id, i.reported_by, i.title, i.description,
             i.incident_date, i.status, i.severity, i.file_url, i.file_name,
             i.supervisor_notes, i.created_at, i.updated_at,
             c.name AS client_name,
             u.name AS reported_by_name
      FROM incidents i
      LEFT JOIN clients c ON c.id = i.client_id
      LEFT JOIN users u ON u.id = i.reported_by
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (client_id) {
      query += ` AND i.client_id = $${idx}`;
      params.push(client_id);
      idx++;
    }
    if (status && VALID_STATUSES.includes(status)) {
      query += ` AND i.status = $${idx}`;
      params.push(status);
      idx++;
    }
    if (severity && VALID_SEVERITIES.includes(severity)) {
      query += ` AND i.severity = $${idx}`;
      params.push(severity);
      idx++;
    }

    query += ` ORDER BY i.incident_date DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json(result.rows.map(r => sanitizeForRole(r, req.user.role)));
  } catch (err) {
    console.error('Get incidents error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/incidents/:id ──────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, c.name AS client_name, u.name AS reported_by_name
       FROM incidents i
       LEFT JOIN clients c ON c.id = i.client_id
       LEFT JOIN users u ON u.id = i.reported_by
       WHERE i.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Incident not found' });
    res.json(sanitizeForRole(result.rows[0], req.user.role));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/incidents ─────────────────────────────────────────────────────
router.post(
  '/',
  authMiddleware,
  [
    body('description').trim().notEmpty().isLength({ max: 10000 }),
    body('client_id').isInt({ min: 1 }),
    body('title').optional().trim().isLength({ max: 255 }),
    body('severity').optional().isIn(VALID_SEVERITIES),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { client_id, title, description, incident_date, severity } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO incidents (client_id, reported_by, title, description, incident_date, severity)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [client_id, req.user.id, title, description, incident_date || new Date(), severity || 'medium']
      );

      const incidentWithDetails = await pool.query(
        `SELECT i.*, c.name AS client_name, u.name AS reported_by_name
         FROM incidents i
         LEFT JOIN clients c ON c.id = i.client_id
         LEFT JOIN users u ON u.id = i.reported_by
         WHERE i.id = $1`,
        [result.rows[0].id]
      );

      await pool.query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
        [req.user.id, 'CREATE_INCIDENT', 'incidents', result.rows[0].id]
      );

      res.status(201).json(sanitizeForRole(incidentWithDetails.rows[0], req.user.role));
    } catch (err) {
      console.error('Create incident error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ── POST /api/incidents/upload ──────────────────────────────────────────────
router.post(
  '/upload',
  authMiddleware,
  upload.single('file'),
  [
    body('description').trim().notEmpty().isLength({ max: 10000 }),
    body('client_id').isInt({ min: 1 }),
    body('title').optional().trim().isLength({ max: 255 }),
    body('severity').optional().isIn(VALID_SEVERITIES),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.file) {
        safeDeleteFile(req.file.filename);
      }
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Magic-byte validation
    if (!validateMagicBytes(req.file.filename, req.file.originalname)) {
      return res.status(400).json({ error: 'File content does not match its declared type' });
    }

    const { client_id, title, description, incident_date, severity } = req.body;
    try {
      const fileUrl = `/uploads/${req.file.filename}`;
      const result = await pool.query(
        `INSERT INTO incidents (client_id, reported_by, title, description, incident_date, severity, file_url, file_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [client_id, req.user.id, title, description, incident_date || new Date(), severity || 'medium', fileUrl, req.file.originalname]
      );

      await pool.query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
        [req.user.id, 'CREATE_INCIDENT', 'incidents', result.rows[0].id]
      );

      res.status(201).json(sanitizeForRole(result.rows[0], req.user.role));
    } catch (err) {
      console.error('Upload incident error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ── PUT /api/incidents/:id ──────────────────────────────────────────────────
router.put('/:id', authMiddleware, [
  body('title').optional().trim().isLength({ max: 255 }),
  body('description').optional().trim().isLength({ max: 10000 }),
  body('status').optional().isIn(VALID_STATUSES),
  body('severity').optional().isIn(VALID_SEVERITIES),
  body('supervisor_notes').optional().trim().isLength({ max: 10000 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { id } = req.params;
  const { title, description, status, severity, supervisor_notes } = req.body;
  try {
    const existing = await pool.query('SELECT * FROM incidents WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Incident not found' });

    let updateQuery;
    let params;

    if (req.user.role === 'staff') {
      // Staff can only edit their own incident reports, and only title/description
      if (existing.rows[0].reported_by !== req.user.id) {
        return res.status(403).json({ error: 'Can only edit your own incidents' });
      }
      updateQuery = `UPDATE incidents SET title = COALESCE($1, title), description = COALESCE($2, description), updated_at = NOW() WHERE id = $3 RETURNING *`;
      params = [title, description, id];
    } else {
      updateQuery = `UPDATE incidents SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        severity = COALESCE($4, severity),
        supervisor_notes = COALESCE($5, supervisor_notes),
        updated_at = NOW()
       WHERE id = $6 RETURNING *`;
      params = [title, description, status, severity, supervisor_notes, id];
    }

    const result = await pool.query(updateQuery, params);

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
      [req.user.id, 'UPDATE_INCIDENT', 'incidents', id]
    );

    res.json(sanitizeForRole(result.rows[0], req.user.role));
  } catch (err) {
    console.error('Update incident error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/incidents/:id (admin only) ──────────────────────────────────
router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const existing = await pool.query('SELECT id FROM incidents WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Incident not found' });

    await pool.query('DELETE FROM incidents WHERE id = $1', [req.params.id]);

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
      [req.user.id, 'DELETE_INCIDENT', 'incidents', req.params.id]
    );

    res.json({ message: 'Incident deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
