const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { validateMagicBytes } = require('../middleware/upload');

const router = express.Router();

const STATUS_SQL = `
  CASE
    WHEN expiry_date IS NULL THEN 'valid'
    WHEN expiry_date < CURRENT_DATE THEN 'expired'
    WHEN expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
    ELSE 'valid'
  END
`;

// ── GET /api/documents ──────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { user_id, status, document_type } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 100, 200);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    // Staff can only view their own documents
    const effectiveUserId = req.user.role === 'staff' ? req.user.id : user_id;

    let query = `
      SELECT d.id, d.user_id, d.document_type, d.file_url, d.file_name,
             d.issue_date, d.expiry_date,
             ${STATUS_SQL} AS status,
             d.notes, d.created_at, d.updated_at,
             u.name AS staff_name, u.email AS staff_email
      FROM documents d
      JOIN users u ON u.id = d.user_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (effectiveUserId) {
      query += ` AND d.user_id = $${idx}`;
      params.push(effectiveUserId);
      idx++;
    }
    if (document_type) {
      query += ` AND d.document_type = $${idx}`;
      params.push(document_type);
      idx++;
    }
    if (status) {
      query += ` AND ${STATUS_SQL} = $${idx}`;
      params.push(status);
      idx++;
    }

    query += ` ORDER BY d.expiry_date ASC NULLS LAST LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get documents error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/documents/:id ──────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, ${STATUS_SQL} AS computed_status, u.name AS staff_name
       FROM documents d JOIN users u ON u.id = d.user_id
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Document not found' });

    if (req.user.role === 'staff' && result.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/documents (create record without file) ───────────────────────
router.post('/', authMiddleware, requireRole('admin', 'manager'), async (req, res) => {
  const { user_id, document_type, issue_date, expiry_date, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO documents (user_id, document_type, issue_date, expiry_date, notes, status)
       VALUES ($1,$2,$3,$4,$5, ${STATUS_SQL.replace(/expiry_date/g, '$4')})
       RETURNING *, ${STATUS_SQL} AS computed_status`,
      [user_id, document_type, issue_date || null, expiry_date || null, notes]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
      [req.user.id, 'CREATE_DOCUMENT', 'documents', result.rows[0].id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create document error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/documents/upload ──────────────────────────────────────────────
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Magic-byte validation — delete the file and reject if it fails
  if (!validateMagicBytes(req.file.path, req.file.originalname)) {
    return res.status(400).json({ error: 'File content does not match its declared type' });
  }

  const { user_id, document_type, issue_date, expiry_date, notes } = req.body;
  const targetUserId = req.user.role === 'staff' ? req.user.id : (user_id || req.user.id);

  try {
    const fileUrl = `/uploads/${req.file.filename}`;
    const result = await pool.query(
      `INSERT INTO documents (user_id, document_type, file_url, file_name, issue_date, expiry_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *, ${STATUS_SQL} AS computed_status`,
      [targetUserId, document_type, fileUrl, req.file.originalname, issue_date || null, expiry_date || null, notes]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
      [req.user.id, 'UPLOAD_DOCUMENT', 'documents', result.rows[0].id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Upload document error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/documents/:id ──────────────────────────────────────────────────
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { document_type, issue_date, expiry_date, notes } = req.body;
  try {
    const existing = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Document not found' });

    if (req.user.role === 'staff' && existing.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let updateQuery;
    let params;

    if (req.user.role === 'staff') {
      // Staff can only update notes — not dates or document type, to prevent
      // self-modification of compliance expiry dates
      updateQuery = `
        UPDATE documents SET
          notes = COALESCE($1, notes),
          updated_at = NOW()
        WHERE id = $2
        RETURNING *, ${STATUS_SQL} AS computed_status`;
      params = [notes, id];
    } else {
      updateQuery = `
        UPDATE documents SET
          document_type = COALESCE($1, document_type),
          issue_date = COALESCE($2, issue_date),
          expiry_date = COALESCE($3, expiry_date),
          notes = COALESCE($4, notes),
          updated_at = NOW()
        WHERE id = $5
        RETURNING *, ${STATUS_SQL} AS computed_status`;
      params = [document_type, issue_date || null, expiry_date || null, notes, id];
    }

    const result = await pool.query(updateQuery, params);

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
      [req.user.id, 'UPDATE_DOCUMENT', 'documents', id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update document error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/documents/:id ───────────────────────────────────────────────
router.delete('/:id', authMiddleware, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Document not found' });

    // Delete file from disk if exists
    if (existing.rows[0].file_url) {
      const filePath = path.join(process.env.UPLOAD_DIR || './uploads', path.basename(existing.rows[0].file_url));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await pool.query('DELETE FROM documents WHERE id = $1', [req.params.id]);

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
      [req.user.id, 'DELETE_DOCUMENT', 'documents', req.params.id]
    );

    res.json({ message: 'Document deleted' });
  } catch (err) {
    console.error('Delete document error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
