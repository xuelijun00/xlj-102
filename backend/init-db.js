const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const fs = require('fs');

if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data');
}

const db = new sqlite3.Database('./data/workbench.db');

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
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

const init = async () => {
  try {
    await runQuery(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('sample_receiver', 'inspector', 'qc_leader')),
  name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);`);

    await runQuery(`
CREATE TABLE IF NOT EXISTS samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sample_code TEXT UNIQUE NOT NULL,
  source_unit TEXT NOT NULL,
  sample_type TEXT NOT NULL,
  test_items TEXT NOT NULL,
  received_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_handover' CHECK(status IN ('pending_handover', 'handover_assigned', 'inspection_in_progress', 'pending_review', 'review_passed', 'review_returned', 'cancelled')),
  current_owner_id INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (current_owner_id) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);`);

    await runQuery(`
CREATE TABLE IF NOT EXISTS sample_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sample_id INTEGER NOT NULL,
  inspector_id INTEGER NOT NULL,
  assigned_by INTEGER NOT NULL,
  assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sample_id) REFERENCES samples(id),
  FOREIGN KEY (inspector_id) REFERENCES users(id),
  FOREIGN KEY (assigned_by) REFERENCES users(id)
);`);

    await runQuery(`
CREATE TABLE IF NOT EXISTS inspection_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sample_id INTEGER NOT NULL,
  inspector_id INTEGER NOT NULL,
  progress TEXT NOT NULL CHECK(progress IN ('not_started', 'in_progress', 'completed')),
  abnormal_note TEXT,
  submitted_for_review INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sample_id) REFERENCES samples(id),
  FOREIGN KEY (inspector_id) REFERENCES users(id)
);`);

    await runQuery(`
CREATE TABLE IF NOT EXISTS review_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sample_id INTEGER NOT NULL,
  qc_leader_id INTEGER NOT NULL,
  result TEXT NOT NULL CHECK(result IN ('passed', 'returned', 'cancelled')),
  review_note TEXT,
  reviewed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sample_id) REFERENCES samples(id),
  FOREIGN KEY (qc_leader_id) REFERENCES users(id)
);`);

    await runQuery(`
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  from_state TEXT,
  to_state TEXT,
  detail TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);`);

    await runQuery('CREATE INDEX IF NOT EXISTS idx_samples_status ON samples(status);');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_samples_owner ON samples(current_owner_id);');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_type, target_id);');

    const hashPassword = (password) => bcrypt.hashSync(password, 10);

    await runQuery('INSERT OR IGNORE INTO users (username, password, role, name) VALUES (?, ?, ?, ?)', ['receiver001', hashPassword('123456'), 'sample_receiver', '张收样员']);
    await runQuery('INSERT OR IGNORE INTO users (username, password, role, name) VALUES (?, ?, ?, ?)', ['inspector001', hashPassword('123456'), 'inspector', '李检测员']);
    await runQuery('INSERT OR IGNORE INTO users (username, password, role, name) VALUES (?, ?, ?, ?)', ['inspector002', hashPassword('123456'), 'inspector', '王检测员']);
    await runQuery('INSERT OR IGNORE INTO users (username, password, role, name) VALUES (?, ?, ?, ?)', ['qc001', hashPassword('123456'), 'qc_leader', '赵质控']);

    const receiverId = (await getQuery('SELECT id FROM users WHERE username = ?', ['receiver001'])).id;

    await runQuery('INSERT INTO samples (sample_code, source_unit, sample_type, test_items, received_at, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', ['S20260706001', '第一医院', '血液', '血常规,生化全套', '2026-07-06 08:30:00', 'pending_handover', receiverId]);
    await runQuery('INSERT INTO samples (sample_code, source_unit, sample_type, test_items, received_at, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', ['S20260706002', '第一医院', '尿液', '尿常规,尿蛋白定量', '2026-07-06 08:35:00', 'pending_handover', receiverId]);
    await runQuery('INSERT INTO samples (sample_code, source_unit, sample_type, test_items, received_at, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', ['S20260706003', '第二医院', '血清', '肝功能,肾功能', '2026-07-06 09:00:00', 'pending_handover', receiverId]);
    await runQuery('INSERT INTO samples (sample_code, source_unit, sample_type, test_items, received_at, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', ['S20260706004', '第二医院', '痰液', '细菌培养', '2026-07-06 09:15:00', 'pending_handover', receiverId]);
    await runQuery('INSERT INTO samples (sample_code, source_unit, sample_type, test_items, received_at, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', ['S20260706005', '第三医院', '脑脊液', '生化检测', '2026-07-06 10:00:00', 'pending_handover', receiverId]);

    await runQuery('INSERT INTO audit_logs (user_id, action, target_type, target_id, from_state, to_state, detail) VALUES (?, ?, ?, ?, ?, ?, ?)', [receiverId, 'create', 'sample', 1, null, 'pending_handover', '收样员张收样员录入样本S20260706001']);
    await runQuery('INSERT INTO audit_logs (user_id, action, target_type, target_id, from_state, to_state, detail) VALUES (?, ?, ?, ?, ?, ?, ?)', [receiverId, 'create', 'sample', 2, null, 'pending_handover', '收样员张收样员录入样本S20260706002']);
    await runQuery('INSERT INTO audit_logs (user_id, action, target_type, target_id, from_state, to_state, detail) VALUES (?, ?, ?, ?, ?, ?, ?)', [receiverId, 'create', 'sample', 3, null, 'pending_handover', '收样员张收样员录入样本S20260706003']);
    await runQuery('INSERT INTO audit_logs (user_id, action, target_type, target_id, from_state, to_state, detail) VALUES (?, ?, ?, ?, ?, ?, ?)', [receiverId, 'create', 'sample', 4, null, 'pending_handover', '收样员张收样员录入样本S20260706004']);
    await runQuery('INSERT INTO audit_logs (user_id, action, target_type, target_id, from_state, to_state, detail) VALUES (?, ?, ?, ?, ?, ?, ?)', [receiverId, 'create', 'sample', 5, null, 'pending_handover', '收样员张收样员录入样本S20260706005']);

    console.log('数据库初始化完成');
    db.close();
  } catch (err) {
    console.error('数据库初始化失败:', err);
    db.close();
    process.exit(1);
  }
};

init();
