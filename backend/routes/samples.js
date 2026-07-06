const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { getBroadcast } = require('../utils/broadcast');

const router = express.Router();

const broadcast = (event) => {
  const fn = getBroadcast();
  if (fn) {
    fn(event);
  }
};

const getQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

router.get('/', verifyToken, async (req, res) => {
  const { status, inspector_id, qc_id } = req.query;
  let query = `
    SELECT s.*, u.name as current_owner_name, u2.name as created_by_name
    FROM samples s
    LEFT JOIN users u ON s.current_owner_id = u.id
    LEFT JOIN users u2 ON s.created_by = u2.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND s.status = ?';
    params.push(status);
  }

  if (inspector_id && req.user.role === 'inspector') {
    query += ' AND s.current_owner_id = ?';
    params.push(inspector_id);
  }

  if (qc_id && req.user.role === 'qc_leader') {
    query += ' AND s.status = ?';
    params.push('pending_review');
  }

  if (req.user.role === 'sample_receiver') {
    query += ' AND s.status IN (?, ?)';
    params.push('pending_handover', 'handover_assigned');
  } else if (req.user.role === 'inspector') {
    query += ' AND s.current_owner_id = ?';
    params.push(req.user.id);
  } else if (req.user.role === 'qc_leader') {
    query += ' AND s.status = ?';
    params.push('pending_review');
  }

  query += ' ORDER BY s.created_at DESC';

  try {
    const samples = await allQuery(query, params);
    res.json(samples);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', verifyToken, requireRole(['sample_receiver']), async (req, res) => {
  const { source_unit, sample_type, test_items, received_at } = req.body;

  if (!source_unit || !sample_type || !test_items || !received_at) {
    return res.status(400).json({ error: '请填写完整的样本信息' });
  }

  try {
    const count = await getQuery("SELECT COUNT(*) as cnt FROM samples WHERE DATE(created_at) = DATE('now')");
    const sampleCode = `S${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String((count.cnt || 0) + 1).padStart(3, '0')}`;

    const result = await runQuery(`
      INSERT INTO samples (sample_code, source_unit, sample_type, test_items, received_at, status, created_by)
      VALUES (?, ?, ?, ?, ?, 'pending_handover', ?)
    `, [sampleCode, source_unit, sample_type, test_items, received_at, req.user.id]);

    await runQuery(`
      INSERT INTO audit_logs (user_id, action, target_type, target_id, from_state, to_state, detail)
      VALUES (?, 'create', 'sample', ?, NULL, 'pending_handover', ?)
    `, [req.user.id, result.lastID, `收样员${req.user.name}录入样本${sampleCode}`]);

    broadcast({ type: 'sample_created', sampleId: result.lastID });
    res.status(201).json({ message: '样本录入成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/assign', verifyToken, requireRole(['sample_receiver']), async (req, res) => {
  const { sample_ids, inspector_id } = req.body;

  if (!sample_ids || !inspector_id) {
    return res.status(400).json({ error: '请选择样本和检测员' });
  }

  try {
    let successCount = 0;
    let failedCount = 0;

    for (const sampleId of sample_ids) {
      const sample = await getQuery('SELECT id, status, version FROM samples WHERE id = ?', [sampleId]);
      
      if (!sample || sample.status !== 'pending_handover') {
        failedCount++;
        continue;
      }

      const updateResult = await runQuery(`
        UPDATE samples SET status = 'handover_assigned', current_owner_id = ?, version = version + 1
        WHERE id = ? AND version = ? AND status = 'pending_handover'
      `, [inspector_id, sampleId, sample.version]);

      if (updateResult.changes > 0) {
        successCount++;
        
        await runQuery(`
          INSERT INTO sample_assignments (sample_id, inspector_id, assigned_by)
          VALUES (?, ?, ?)
        `, [sampleId, inspector_id, req.user.id]);

        await runQuery(`
          INSERT INTO audit_logs (user_id, action, target_type, target_id, from_state, to_state, detail)
          VALUES (?, 'assign', 'sample', ?, 'pending_handover', 'handover_assigned', ?)
        `, [req.user.id, sampleId, `收样员${req.user.name}将样本分配给检测员${inspector_id}`]);
      } else {
        failedCount++;
      }
    }

    broadcast({ type: 'samples_assigned', sampleIds: sample_ids });
    res.json({ success: successCount, failed: failedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/receive', verifyToken, requireRole(['inspector']), async (req, res) => {
  const { id } = req.params;
  const { version } = req.body;

  try {
    const sample = await getQuery('SELECT id, status, current_owner_id, version FROM samples WHERE id = ?', [id]);
    
    if (!sample) {
      return res.status(404).json({ error: '样本不存在' });
    }

    if (sample.current_owner_id !== req.user.id) {
      return res.status(403).json({ error: '此样本未分配给您' });
    }

    const updateResult = await runQuery(`
      UPDATE samples SET status = 'inspection_in_progress', version = version + 1
      WHERE id = ? AND version = ? AND status = 'handover_assigned'
    `, [id, version]);

    if (updateResult.changes === 0) {
      return res.status(409).json({ error: '样本状态已变更，请刷新页面后重试' });
    }

    await runQuery(`
      INSERT INTO inspection_records (sample_id, inspector_id, progress, abnormal_note)
      VALUES (?, ?, 'not_started', '')
    `, [id, req.user.id]);

    await runQuery(`
      INSERT INTO audit_logs (user_id, action, target_type, target_id, from_state, to_state, detail)
      VALUES (?, 'receive', 'sample', ?, 'handover_assigned', 'inspection_in_progress', ?)
    `, [req.user.id, id, `检测员${req.user.name}接收样本`]);

    broadcast({ type: 'sample_received', sampleId: id });
    res.json({ message: '样本接收成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/update-progress', verifyToken, requireRole(['inspector']), async (req, res) => {
  const { id } = req.params;
  const { progress, abnormal_note, version } = req.body;

  try {
    const sample = await getQuery('SELECT id, status, current_owner_id, version FROM samples WHERE id = ?', [id]);
    
    if (!sample) {
      return res.status(404).json({ error: '样本不存在' });
    }

    if (sample.current_owner_id !== req.user.id) {
      return res.status(403).json({ error: '此样本未分配给您' });
    }

    const updateResult = await runQuery(`
      UPDATE samples SET version = version + 1
      WHERE id = ? AND version = ? AND status = 'inspection_in_progress'
    `, [id, version]);

    if (updateResult.changes === 0) {
      return res.status(409).json({ error: '样本状态已变更，请刷新页面后重试' });
    }

    const record = await getQuery('SELECT id FROM inspection_records WHERE sample_id = ? AND inspector_id = ?', [id, req.user.id]);
    if (record) {
      await runQuery(`
        UPDATE inspection_records SET progress = ?, abnormal_note = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [progress, abnormal_note || '', record.id]);
    } else {
      await runQuery(`
        INSERT INTO inspection_records (sample_id, inspector_id, progress, abnormal_note)
        VALUES (?, ?, ?, ?)
      `, [id, req.user.id, progress, abnormal_note || '']);
    }

    await runQuery(`
      INSERT INTO audit_logs (user_id, action, target_type, target_id, from_state, to_state, detail)
      VALUES (?, 'update_progress', 'sample', ?, 'inspection_in_progress', 'inspection_in_progress', ?)
    `, [req.user.id, id, `检测员${req.user.name}更新检测进度为${progress}`]);

    broadcast({ type: 'progress_updated', sampleId: id });
    res.json({ message: '进度更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/submit-for-review', verifyToken, requireRole(['inspector']), async (req, res) => {
  const { id } = req.params;
  const { version } = req.body;

  try {
    const sample = await getQuery('SELECT id, status, current_owner_id, version FROM samples WHERE id = ?', [id]);
    
    if (!sample) {
      return res.status(404).json({ error: '样本不存在' });
    }

    if (sample.current_owner_id !== req.user.id) {
      return res.status(403).json({ error: '此样本未分配给您' });
    }

    const updateResult = await runQuery(`
      UPDATE samples SET status = 'pending_review', version = version + 1
      WHERE id = ? AND version = ? AND status = 'inspection_in_progress'
    `, [id, version]);

    if (updateResult.changes === 0) {
      return res.status(409).json({ error: '样本状态已变更，请刷新页面后重试' });
    }

    const record = await getQuery('SELECT id FROM inspection_records WHERE sample_id = ? AND inspector_id = ?', [id, req.user.id]);
    if (record) {
      await runQuery('UPDATE inspection_records SET submitted_for_review = 1 WHERE id = ?', [record.id]);
    }

    await runQuery(`
      INSERT INTO audit_logs (user_id, action, target_type, target_id, from_state, to_state, detail)
      VALUES (?, 'submit_for_review', 'sample', ?, 'inspection_in_progress', 'pending_review', ?)
    `, [req.user.id, id, `检测员${req.user.name}提交样本进行复核`]);

    broadcast({ type: 'sample_submitted', sampleId: id });
    res.json({ message: '样本已提交复核' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/review', verifyToken, requireRole(['qc_leader']), async (req, res) => {
  const { id } = req.params;
  const { result, review_note, version } = req.body;

  try {
    const sample = await getQuery('SELECT id, status, version FROM samples WHERE id = ?', [id]);
    
    if (!sample) {
      return res.status(404).json({ error: '样本不存在' });
    }

    if (sample.status !== 'pending_review') {
      return res.status(403).json({ error: '此样本未处于待复核状态' });
    }

    let newStatus;
    switch (result) {
      case 'passed':
        newStatus = 'review_passed';
        break;
      case 'returned':
        newStatus = 'review_returned';
        break;
      case 'cancelled':
        newStatus = 'cancelled';
        break;
      default:
        return res.status(400).json({ error: '无效的复核结果' });
    }

    const updateResult = await runQuery(`
      UPDATE samples SET status = ?, version = version + 1
      WHERE id = ? AND version = ? AND status = 'pending_review'
    `, [newStatus, id, version]);

    if (updateResult.changes === 0) {
      return res.status(409).json({ error: '样本状态已变更，请刷新页面后重试' });
    }

    await runQuery(`
      INSERT INTO review_records (sample_id, qc_leader_id, result, review_note)
      VALUES (?, ?, ?, ?)
    `, [id, req.user.id, result, review_note || '']);

    await runQuery(`
      INSERT INTO audit_logs (user_id, action, target_type, target_id, from_state, to_state, detail)
      VALUES (?, 'review', 'sample', ?, 'pending_review', ?, ?)
    `, [req.user.id, id, newStatus, `质控负责人${req.user.name}复核结果：${result}`]);

    broadcast({ type: 'sample_reviewed', sampleId: id });
    res.json({ message: '复核完成' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/resubmit', verifyToken, requireRole(['inspector']), async (req, res) => {
  const { id } = req.params;
  const { version } = req.body;

  try {
    const sample = await getQuery('SELECT id, status, current_owner_id, version FROM samples WHERE id = ?', [id]);
    
    if (!sample) {
      return res.status(404).json({ error: '样本不存在' });
    }

    if (sample.current_owner_id !== req.user.id) {
      return res.status(403).json({ error: '此样本未分配给您' });
    }

    const updateResult = await runQuery(`
      UPDATE samples SET status = 'inspection_in_progress', version = version + 1
      WHERE id = ? AND version = ? AND status = 'review_returned'
    `, [id, version]);

    if (updateResult.changes === 0) {
      return res.status(409).json({ error: '样本状态已变更，请刷新页面后重试' });
    }

    await runQuery(`
      INSERT INTO audit_logs (user_id, action, target_type, target_id, from_state, to_state, detail)
      VALUES (?, 'resubmit', 'sample', ?, 'review_returned', 'inspection_in_progress', ?)
    `, [req.user.id, id, `检测员${req.user.name}重新提交样本`]);

    broadcast({ type: 'sample_resubmitted', sampleId: id });
    res.json({ message: '样本已重新提交' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/audit-logs', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const logs = await allQuery(`
      SELECT al.*, u.name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.target_type = 'sample' AND al.target_id = ?
      ORDER BY al.created_at DESC
    `, [id]);

    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
