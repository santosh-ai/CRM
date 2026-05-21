const express = require('express');
const pool = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/dashboard (admin/manager: full org view) ─────────────────────
router.get('/', authMiddleware, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const [
      staffCount,
      clientCount,
      activeIncidents,
      expiringDocs,
      expiredDocs,
      expiringTrainings,
      recentIncidents,
      complianceData,
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users WHERE is_active = true AND role != 'admin'"),
      pool.query('SELECT COUNT(*) FROM clients WHERE is_active = true'),
      pool.query("SELECT COUNT(*) FROM incidents WHERE status IN ('open', 'under_review')"),
      pool.query(`
        SELECT d.id, d.document_type, d.expiry_date,
               u.name AS staff_name, u.id AS user_id
        FROM documents d
        JOIN users u ON u.id = d.user_id
        WHERE d.expiry_date IS NOT NULL
          AND d.expiry_date >= CURRENT_DATE
          AND d.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
          AND u.is_active = true
        ORDER BY d.expiry_date ASC
      `),
      pool.query(`
        SELECT d.id, d.document_type, d.expiry_date,
               u.name AS staff_name, u.id AS user_id
        FROM documents d
        JOIN users u ON u.id = d.user_id
        WHERE d.expiry_date IS NOT NULL
          AND d.expiry_date < CURRENT_DATE
          AND u.is_active = true
        ORDER BY d.expiry_date ASC
      `),
      pool.query(`
        SELECT t.id, t.training_name, t.expiry_date,
               u.name AS staff_name, u.id AS user_id
        FROM trainings t
        JOIN users u ON u.id = t.user_id
        WHERE t.expiry_date IS NOT NULL
          AND t.expiry_date >= CURRENT_DATE
          AND t.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
          AND u.is_active = true
        ORDER BY t.expiry_date ASC
      `),
      pool.query(`
        SELECT i.id, i.title, i.incident_date, i.status, i.severity,
               c.name AS client_name, u.name AS reported_by_name
        FROM incidents i
        LEFT JOIN clients c ON c.id = i.client_id
        LEFT JOIN users u ON u.id = i.reported_by
        ORDER BY i.incident_date DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT
          COUNT(DISTINCT u.id) AS total_staff,
          COUNT(DISTINCT CASE WHEN d_bad.user_id IS NULL THEN u.id END) AS compliant_staff
        FROM users u
        LEFT JOIN (
          SELECT DISTINCT user_id
          FROM documents
          WHERE expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE
        ) d_bad ON d_bad.user_id = u.id
        WHERE u.is_active = true AND u.role != 'admin'
      `),
    ]);

    const totalStaff = parseInt(complianceData.rows[0].total_staff) || 0;
    const compliantStaff = parseInt(complianceData.rows[0].compliant_staff) || 0;
    const complianceRate = totalStaff > 0 ? Math.round((compliantStaff / totalStaff) * 100) : 100;

    res.json({
      stats: {
        total_staff: parseInt(staffCount.rows[0].count),
        total_clients: parseInt(clientCount.rows[0].count),
        active_incidents: parseInt(activeIncidents.rows[0].count),
        compliance_rate: complianceRate,
      },
      expiring_docs: expiringDocs.rows,
      expired_docs: expiredDocs.rows,
      expiring_trainings: expiringTrainings.rows,
      recent_incidents: recentIncidents.rows,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/dashboard/me (staff: personal compliance summary) ────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const [myDocs, myTrainings, myIncidents] = await Promise.all([
      pool.query(`
        SELECT id, document_type, expiry_date,
          CASE
            WHEN expiry_date IS NULL THEN 'valid'
            WHEN expiry_date < CURRENT_DATE THEN 'expired'
            WHEN expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
            ELSE 'valid'
          END AS status
        FROM documents WHERE user_id = $1 ORDER BY expiry_date ASC NULLS LAST
      `, [userId]),
      pool.query(`
        SELECT id, training_name, expiry_date,
          CASE
            WHEN expiry_date IS NULL THEN 'valid'
            WHEN expiry_date < CURRENT_DATE THEN 'expired'
            WHEN expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
            ELSE 'valid'
          END AS status
        FROM trainings WHERE user_id = $1 ORDER BY expiry_date ASC NULLS LAST
      `, [userId]),
      pool.query(`
        SELECT id, title, incident_date, status, severity
        FROM incidents WHERE reported_by = $1 ORDER BY incident_date DESC LIMIT 5
      `, [userId]),
    ]);

    res.json({
      documents: myDocs.rows,
      trainings: myTrainings.rows,
      my_incidents: myIncidents.rows,
    });
  } catch (err) {
    console.error('Personal dashboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
