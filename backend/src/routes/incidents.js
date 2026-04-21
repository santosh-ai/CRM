const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// GET /api/incidents
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { client_id, status, severity } = req.query;

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
    if (status) {
      query += ` AND i.status = $${idx}`;
      params.push(status);
      idx++;
    }
    if (severity) {
      query += ` AND i.severity = $${idx}`;
      params.push(severity);
      idx++;
    }

    query += ' ORDER BY i.incident_date DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get incidents error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/incidents/:id
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
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/incidents
router.post(
  '/',
  authMiddleware,
  [
    body('description').trim().notEmpty(),
    body('client_id').isInt(),
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

      res.status(201).json(incidentWithDetails.rows[0]);
    } catch (err) {
      console.error('Create incident error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /api/incidents/upload
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { client_id, title, description, incident_date, severity } = req.body;
  try {
    const fileUrl = `/uploads/${req.file.filename}`;
    const result = await pool.query(
      `INSERT INTO incidents (client_id, reported_by, title, description, incident_date, severity, file_url, file_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [client_id, req.user.id, title, description, incident_date || new Date(), severity || 'medium', fileUrl, req.file.originalname]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Upload incident error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/incidents/:id
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { title, description, status, severity, supervisor_notes } = req.body;
  try {
    const existing = await pool.query('SELECT * FROM incidents WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Incident not found' });

    // Staff can update description but not status/supervisor_notes
    let updateQuery;
    let params;

    if (req.user.role === 'staff') {
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

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update incident error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/incidents/:id (admin only)
router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM incidents WHERE id = $1', [req.params.id]);
    res.json({ message: 'Incident deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
