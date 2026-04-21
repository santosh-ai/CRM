const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/notes?client_id=
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { client_id } = req.query;
    if (!client_id) return res.status(400).json({ error: 'client_id is required' });

    const result = await pool.query(
      `SELECT n.id, n.client_id, n.staff_id, n.note, n.note_date, n.created_at,
              u.name AS staff_name
       FROM notes n
       LEFT JOIN users u ON u.id = n.staff_id
       WHERE n.client_id = $1
       ORDER BY n.note_date DESC`,
      [client_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get notes error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/notes
router.post(
  '/',
  authMiddleware,
  [body('note').trim().notEmpty(), body('client_id').isInt()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { client_id, note, note_date } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO notes (client_id, staff_id, note, note_date)
         VALUES ($1,$2,$3,$4)
         RETURNING *`,
        [client_id, req.user.id, note, note_date || new Date()]
      );

      const noteWithStaff = await pool.query(
        `SELECT n.*, u.name AS staff_name
         FROM notes n LEFT JOIN users u ON u.id = n.staff_id
         WHERE n.id = $1`,
        [result.rows[0].id]
      );

      await pool.query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
        [req.user.id, 'CREATE_NOTE', 'notes', result.rows[0].id]
      );

      res.status(201).json(noteWithStaff.rows[0]);
    } catch (err) {
      console.error('Create note error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /api/notes/:id
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;
  try {
    const existing = await pool.query('SELECT * FROM notes WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Note not found' });

    // Staff can only edit their own notes
    if (req.user.role === 'staff' && existing.rows[0].staff_id !== req.user.id) {
      return res.status(403).json({ error: 'Cannot edit another staff member\'s note' });
    }

    const result = await pool.query(
      'UPDATE notes SET note = $1 WHERE id = $2 RETURNING *',
      [note, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM notes WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Note not found' });

    if (req.user.role === 'staff' && existing.rows[0].staff_id !== req.user.id) {
      return res.status(403).json({ error: 'Cannot delete another staff member\'s note' });
    }

    await pool.query('DELETE FROM notes WHERE id = $1', [req.params.id]);
    res.json({ message: 'Note deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
