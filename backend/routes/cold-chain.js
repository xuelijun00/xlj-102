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

const TEMPERATURE_RANGES = {
  '血液': { min: 2, max: 8 },
  '尿液': { min: 4, max: 8 },
  '血清': { min: -20, max: -15 },
  '痰液': { min: 2, max: 8 },
  '脑脊液': { min: 2, max: 8 },
  '其他': { min: 2, max: 8 }
};

const isAbnormal = (temperature, sampleType) => {
  const range = TEMPERATURE_RANGES[sampleType] || TEMPERATURE_RANGES['其他'];
  return temperature < range.min || temperature > range.max;
};

router.post('/readings', verifyToken, async (req, res) => {
  const { sample_id, temperature, stage } = req.body;
  
  if (!sample_id || temperature === undefined || !stage) {
    return res.status(400).json({ error: '请填写完整的温度读数信息' });
  }
  
  const validStages = ['receiving', 'handover', 'before_inspection', 'after_inspection'];
  if (!validStages.includes(stage)) {
    return res.status(400).json({ error: '无效的阶段类型' });
  }

  try {
    const sample = await getQuery('SELECT id, sample_type, status FROM samples WHERE id = ?', [sample_id]);
    if (!sample) {
      return res.status(404).json({ error: '样本不存在' });
    }

    if (sample.status === 'cancelled') {
      return res.status(403).json({ error: '样本已作废，无法录入温度' });
    }

    const abnormal = isAbnormal(temperature, sample.sample_type) ? 1 : 0;
    const recordedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await runQuery(`
      INSERT INTO temperature_readings (sample_id, temperature, recorded_by, recorded_at, stage, is_abnormal)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [sample_id, temperature, req.user.id, recordedAt, stage, abnormal]);

    if (abnormal) {
      const existingIssue = await getQuery(
        'SELECT id, status FROM cold_chain_issues WHERE sample_id = ? AND status != ?',
        [sample_id, 'resolved']
      );

      if (!existingIssue) {
        await runQuery(`
          INSERT INTO cold_chain_issues (sample_id, status)
          VALUES (?, 'pending_receiver')
        `, [sample_id]);
      }
    }

    broadcast({ type: 'temperature_recorded', sampleId: sample_id });
    res.json({ message: '温度读数录入成功', is_abnormal: abnormal === 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/readings/:sampleId', verifyToken, async (req, res) => {
  const { sampleId } = req.params;
  
  try {
    const readings = await allQuery(`
      SELECT tr.*, u.name as recorded_by_name
      FROM temperature_readings tr
      LEFT JOIN users u ON tr.recorded_by = u.id
      WHERE tr.sample_id = ?
      ORDER BY tr.recorded_at ASC
    `, [sampleId]);

    const stageLabels = {
      'receiving': '接收',
      'handover': '交接',
      'before_inspection': '检测前',
      'after_inspection': '检测后'
    };

    const result = readings.map(r => ({
      ...r,
      stage_label: stageLabels[r.stage] || r.stage
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/issues', verifyToken, async (req, res) => {
  const { role } = req.user;
  
  try {
    let statusFilter = [];
    if (role === 'sample_receiver') {
      statusFilter = ['pending_receiver'];
    } else if (role === 'inspector') {
      statusFilter = ['pending_inspector'];
    } else if (role === 'qc_leader') {
      statusFilter = ['pending_qc'];
    }

    let query = `
      SELECT ci.*, s.sample_code, s.sample_type, s.source_unit, 
             u1.name as transport_note_by_name,
             u2.name as affects_inspection_by_name,
             u3.name as final_disposition_by_name
      FROM cold_chain_issues ci
      LEFT JOIN samples s ON ci.sample_id = s.id
      LEFT JOIN users u1 ON ci.transport_note_by = u1.id
      LEFT JOIN users u2 ON ci.affects_inspection_by = u2.id
      LEFT JOIN users u3 ON ci.final_disposition_by = u3.id
      WHERE 1=1
    `;
    const params = [];

    if (statusFilter.length > 0) {
      query += ' AND ci.status IN (' + statusFilter.map(() => '?').join(', ') + ')';
      params.push(...statusFilter);
    }

    query += ' ORDER BY ci.created_at DESC';

    const issues = await allQuery(query, params);

    const statusLabels = {
      'pending_receiver': '待收样员处理',
      'pending_inspector': '待检测员评估',
      'pending_qc': '待质控处置',
      'resolved': '已解决'
    };

    const dispositionLabels = {
      'continue': '继续检测',
      'resample': '重新取样',
      'discard': '作废'
    };

    const result = issues.map(i => ({
      ...i,
      status_label: statusLabels[i.status] || i.status,
      final_disposition_label: i.final_disposition ? dispositionLabels[i.final_disposition] || i.final_disposition : null
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/issues/all', verifyToken, async (req, res) => {
  try {
    const issues = await allQuery(`
      SELECT ci.*, s.sample_code, s.sample_type, s.source_unit, 
             u1.name as transport_note_by_name,
             u2.name as affects_inspection_by_name,
             u3.name as final_disposition_by_name
      FROM cold_chain_issues ci
      LEFT JOIN samples s ON ci.sample_id = s.id
      LEFT JOIN users u1 ON ci.transport_note_by = u1.id
      LEFT JOIN users u2 ON ci.affects_inspection_by = u2.id
      LEFT JOIN users u3 ON ci.final_disposition_by = u3.id
      ORDER BY ci.created_at DESC
    `);

    const statusLabels = {
      'pending_receiver': '待收样员处理',
      'pending_inspector': '待检测员评估',
      'pending_qc': '待质控处置',
      'resolved': '已解决'
    };

    const dispositionLabels = {
      'continue': '继续检测',
      'resample': '重新取样',
      'discard': '作废'
    };

    const result = issues.map(i => ({
      ...i,
      status_label: statusLabels[i.status] || i.status,
      final_disposition_label: i.final_disposition ? dispositionLabels[i.final_disposition] || i.final_disposition : null
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/issues/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    const issue = await getQuery(`
      SELECT ci.*, s.sample_code, s.sample_type, s.source_unit, 
             u1.name as transport_note_by_name,
             u2.name as affects_inspection_by_name,
             u3.name as final_disposition_by_name
      FROM cold_chain_issues ci
      LEFT JOIN samples s ON ci.sample_id = s.id
      LEFT JOIN users u1 ON ci.transport_note_by = u1.id
      LEFT JOIN users u2 ON ci.affects_inspection_by = u2.id
      LEFT JOIN users u3 ON ci.final_disposition_by = u3.id
      WHERE ci.id = ?
    `, [id]);

    if (!issue) {
      return res.status(404).json({ error: '异常记录不存在' });
    }

    const readings = await allQuery(`
      SELECT tr.*, u.name as recorded_by_name
      FROM temperature_readings tr
      LEFT JOIN users u ON tr.recorded_by = u.id
      WHERE tr.sample_id = ? AND tr.is_abnormal = 1
      ORDER BY tr.recorded_at ASC
    `, [issue.sample_id]);

    const statusLabels = {
      'pending_receiver': '待收样员处理',
      'pending_inspector': '待检测员评估',
      'pending_qc': '待质控处置',
      'resolved': '已解决'
    };

    const dispositionLabels = {
      'continue': '继续检测',
      'resample': '重新取样',
      'discard': '作废'
    };

    const stageLabels = {
      'receiving': '接收',
      'handover': '交接',
      'before_inspection': '检测前',
      'after_inspection': '检测后'
    };

    res.json({
      ...issue,
      status_label: statusLabels[issue.status] || issue.status,
      final_disposition_label: issue.final_disposition ? dispositionLabels[issue.final_disposition] || issue.final_disposition : null,
      abnormal_readings: readings.map(r => ({
        ...r,
        stage_label: stageLabels[r.stage] || r.stage
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/issues/:id/receiver-note', verifyToken, requireRole(['sample_receiver']), async (req, res) => {
  const { id } = req.params;
  const { transport_note } = req.body;
  
  if (!transport_note) {
    return res.status(400).json({ error: '请填写运输说明' });
  }

  try {
    const issue = await getQuery('SELECT id, status, sample_id FROM cold_chain_issues WHERE id = ?', [id]);
    
    if (!issue) {
      return res.status(404).json({ error: '异常记录不存在' });
    }

    if (issue.status !== 'pending_receiver') {
      return res.status(403).json({ error: '此异常记录当前不允许收样员处理' });
    }

    const sample = await getQuery('SELECT status FROM samples WHERE id = ?', [issue.sample_id]);
    if (sample && sample.status === 'cancelled') {
      return res.status(403).json({ error: '样本已作废，无法处理' });
    }

    const updateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const updateResult = await runQuery(`
      UPDATE cold_chain_issues 
      SET status = 'pending_inspector', 
          transport_note = ?, 
          transport_note_by = ?, 
          transport_note_at = ?
      WHERE id = ? AND status = 'pending_receiver'
    `, [transport_note, req.user.id, updateTime, id]);

    if (updateResult.changes === 0) {
      return res.status(409).json({ error: '异常记录状态已变更，请刷新页面后重试' });
    }

    broadcast({ type: 'issue_updated', issueId: id });
    res.json({ message: '运输说明已提交，等待检测员评估' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/issues/:id/inspector-assess', verifyToken, requireRole(['inspector']), async (req, res) => {
  const { id } = req.params;
  const { affects_inspection } = req.body;
  
  if (affects_inspection === undefined) {
    return res.status(400).json({ error: '请选择是否影响检测' });
  }

  try {
    const issue = await getQuery('SELECT id, status, sample_id FROM cold_chain_issues WHERE id = ?', [id]);
    
    if (!issue) {
      return res.status(404).json({ error: '异常记录不存在' });
    }

    if (issue.status !== 'pending_inspector') {
      return res.status(403).json({ error: '此异常记录当前不允许检测员评估' });
    }

    const sample = await getQuery('SELECT status, current_owner_id FROM samples WHERE id = ?', [issue.sample_id]);
    if (!sample) {
      return res.status(404).json({ error: '样本不存在' });
    }

    if (sample.status === 'cancelled') {
      return res.status(403).json({ error: '样本已作废，无法处理' });
    }

    if (sample.current_owner_id !== req.user.id) {
      return res.status(403).json({ error: '此样本未分配给您' });
    }

    const updateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const updateResult = await runQuery(`
      UPDATE cold_chain_issues 
      SET status = 'pending_qc', 
          affects_inspection = ?, 
          affects_inspection_by = ?, 
          affects_inspection_at = ?
      WHERE id = ? AND status = 'pending_inspector'
    `, [affects_inspection ? 1 : 0, req.user.id, updateTime, id]);

    if (updateResult.changes === 0) {
      return res.status(409).json({ error: '异常记录状态已变更，请刷新页面后重试' });
    }

    broadcast({ type: 'issue_updated', issueId: id });
    res.json({ message: '影响评估已提交，等待质控处置' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/issues/:id/final-disposition', verifyToken, requireRole(['qc_leader']), async (req, res) => {
  const { id } = req.params;
  const { final_disposition } = req.body;
  
  if (!final_disposition) {
    return res.status(400).json({ error: '请选择最终处置结论' });
  }

  const validDispositions = ['continue', 'resample', 'discard'];
  if (!validDispositions.includes(final_disposition)) {
    return res.status(400).json({ error: '无效的处置结论' });
  }

  try {
    const issue = await getQuery('SELECT id, status, sample_id FROM cold_chain_issues WHERE id = ?', [id]);
    
    if (!issue) {
      return res.status(404).json({ error: '异常记录不存在' });
    }

    if (issue.status !== 'pending_qc') {
      return res.status(403).json({ error: '此异常记录当前不允许质控处置' });
    }

    const updateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const updateResult = await runQuery(`
      UPDATE cold_chain_issues 
      SET status = 'resolved', 
          final_disposition = ?, 
          final_disposition_by = ?, 
          final_disposition_at = ?
      WHERE id = ? AND status = 'pending_qc'
    `, [final_disposition, req.user.id, updateTime, id]);

    if (updateResult.changes === 0) {
      return res.status(409).json({ error: '异常记录状态已变更，请刷新页面后重试' });
    }

    if (final_disposition === 'discard') {
      await runQuery(`
        UPDATE samples 
        SET status = 'cancelled', 
            version = version + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [issue.sample_id]);
    }

    broadcast({ type: 'issue_updated', issueId: id });
    res.json({ message: '最终处置结论已提交' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;