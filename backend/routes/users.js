const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

router.get('/inspectors', verifyToken, requireRole(['sample_receiver']), async (req, res) => {
  try {
    const inspectors = await allQuery('SELECT id, name FROM users WHERE role = ?', ['inspector']);
    res.json(inspectors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
