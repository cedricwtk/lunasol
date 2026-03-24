require('dotenv').config?.();
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Avatar uploads ──────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads', 'avatars');
fs.mkdirSync(uploadsDir, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `user-${req.user.id}${ext}`);
  },
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// ── Email transporter ───────────────────────────────────────────────────────
const emailTransporter = process.env.SMTP_HOST ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
}) : null;

async function sendEmail(to, subject, text) {
  if (!emailTransporter) { console.log('Email skipped (no SMTP configured):', subject); return; }
  try {
    await emailTransporter.sendMail({
      from: process.env.SMTP_FROM || 'LunaSol <noreply@lunasol.app>',
      to, subject, text,
    });
    console.log('Email sent:', subject, to);
  } catch (err) { console.error('Email failed:', err.message); }
}

// ── Expo push notifications ─────────────────────────────────────────────────
async function sendPushNotification(pushToken, title, body) {
  if (!pushToken) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: pushToken, title, body, sound: 'default' }),
    });
    console.log('Push sent:', title);
  } catch (err) { console.error('Push failed:', err.message); }
}

// ── Webhook (must be before express.json to get raw body) ────────────────────
app.post('/webhook/deploy', express.raw({ type: 'application/json' }), (req, res) => {
  if (!WEBHOOK_SECRET) return res.status(500).json({ error: 'Webhook not configured' });

  const sig = req.headers['x-hub-signature-256'];
  if (!sig) return res.status(401).json({ error: 'No signature' });

  const hmac = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(req.body).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(hmac)))
    return res.status(401).json({ error: 'Invalid signature' });

  res.json({ ok: true });

  try {
    execSync('git pull origin master && npm install', { cwd: __dirname, stdio: 'inherit' });
    execSync('pm2 restart lunasol', { stdio: 'inherit' });
  } catch (err) {
    console.error('Deploy failed:', err.message);
  }
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { error: 'Too many attempts. Try again later.' } });

// ── Database init ────────────────────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      username   VARCHAR(30) UNIQUE NOT NULL,
      email      VARCHAR(255) UNIQUE NOT NULL,
      password   TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      age            INTEGER,
      sex            VARCHAR(10) DEFAULT 'male',
      height_cm      NUMERIC(5,1),
      weight_kg      NUMERIC(5,1),
      activity_level NUMERIC(4,3) DEFAULT 1.55,
      goal           INTEGER DEFAULT -500,
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fasts (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      preset       VARCHAR(20),
      target_hours NUMERIC(5,1) NOT NULL,
      started_at   TIMESTAMPTZ NOT NULL,
      ended_at     TIMESTAMPTZ,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_logs (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      log_date   DATE NOT NULL DEFAULT CURRENT_DATE,
      success    BOOLEAN,
      notes      TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, log_date)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meal_entries (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      log_date     DATE NOT NULL DEFAULT CURRENT_DATE,
      label        VARCHAR(120) NOT NULL,
      calories     INTEGER NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS expense_categories (
      id       SERIAL PRIMARY KEY,
      user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name     VARCHAR(60) NOT NULL,
      UNIQUE(user_id, name)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount        NUMERIC(10,2) NOT NULL,
      category_type VARCHAR(12) NOT NULL CHECK (category_type IN ('necessary', 'unnecessary')),
      subcategory   VARCHAR(60) NOT NULL,
      note          TEXT,
      expense_date  DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS responsibilities (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title         VARCHAR(200) NOT NULL,
      note          TEXT,
      due_date      TIMESTAMPTZ NOT NULL,
      priority      VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high')),
      completed     BOOLEAN DEFAULT FALSE,
      reminded_24h  BOOLEAN DEFAULT FALSE,
      reminded_1w   BOOLEAN DEFAULT FALSE,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cleanse_challenges (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      total_days   INTEGER NOT NULL DEFAULT 14,
      days_left    INTEGER NOT NULL DEFAULT 14,
      started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed    BOOLEAN DEFAULT FALSE,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, started_at)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meal_prep_checks (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      check_date      DATE NOT NULL DEFAULT CURRENT_DATE,
      eggs            BOOLEAN DEFAULT FALSE,
      protein_shake   BOOLEAN DEFAULT FALSE,
      veggies         BOOLEAN DEFAULT FALSE,
      extra_protein   BOOLEAN DEFAULT FALSE,
      protein_type    VARCHAR(60),
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, check_date)
    )
  `);
  // Add avatar and push token columns if missing
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT`);
  console.log('Database ready');
}

initDB().catch(err => {
  console.error('Database connection failed:', err.message);
  process.exit(1);
});

// ── Auth helpers ─────────────────────────────────────────────────────────────
function createToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
}

async function requireAuth(req, res, next) {
  // Support both cookie (web) and Authorization header (mobile)
  const token = req.cookies.token
    || (req.headers.authorization?.startsWith('Bearer ') && req.headers.authorization.slice(7));
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query('SELECT id, username, email FROM users WHERE id = $1', [decoded.id]);
    if (!result.rows[0]) return res.status(401).json({ error: 'User not found' });
    req.user = result.rows[0];
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ── Auth routes ──────────────────────────────────────────────────────────────
app.post('/api/signup', authLimiter, async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'All fields are required.' });
  if (username.length < 3 || username.length > 30)
    return res.status(400).json({ error: 'Username must be 3–30 characters.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (!/[A-Z]/.test(password))
    return res.status(400).json({ error: 'Password must contain an uppercase letter.' });
  if (!/[^a-zA-Z0-9]/.test(password))
    return res.status(400).json({ error: 'Password must contain a special character.' });

  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id',
      [username.trim(), email.trim().toLowerCase(), hash]
    );
    // Create empty profile
    await pool.query('INSERT INTO user_profiles (user_id) VALUES ($1)', [result.rows[0].id]);
    const token = createToken(result.rows[0].id);
    res.json({ success: true, token });
  } catch (err) {
    if (err.code === '23505') {
      const field = err.constraint?.includes('email') ? 'Email' : 'Username';
      return res.status(409).json({ error: `${field} already taken.` });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/signin', authLimiter, async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password)
    return res.status(400).json({ error: 'All fields are required.' });

  try {
    const result = await pool.query(
      'SELECT id, password FROM users WHERE email = $1 OR username = $1',
      [login.trim().toLowerCase()]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid credentials.' });

    const token = createToken(user.id);
    res.json({ success: true, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/signout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

app.get('/api/me', requireAuth, async (req, res) => {
  const userFull = await pool.query('SELECT id, username, email, avatar_url FROM users WHERE id = $1', [req.user.id]);
  const profile = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1', [req.user.id]);
  res.json({ user: userFull.rows[0], profile: profile.rows[0] || null });
});

// ── Avatar upload ─────────────────────────────────────────────────────────
app.post('/api/avatar', requireAuth, uploadAvatar.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image provided' });
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  try {
    await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, req.user.id]);
    res.json({ success: true, avatar_url: avatarUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Profile routes ───────────────────────────────────────────────────────────
app.put('/api/profile', requireAuth, async (req, res) => {
  const { age, sex, height_cm, weight_kg, activity_level, goal } = req.body;
  try {
    await pool.query(
      `INSERT INTO user_profiles (user_id, age, sex, height_cm, weight_kg, activity_level, goal, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         age = EXCLUDED.age, sex = EXCLUDED.sex, height_cm = EXCLUDED.height_cm,
         weight_kg = EXCLUDED.weight_kg, activity_level = EXCLUDED.activity_level,
         goal = EXCLUDED.goal, updated_at = NOW()`,
      [req.user.id, age || null, sex || 'male', height_cm || null, weight_kg || null, activity_level || 1.55, goal ?? -500]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Fasting routes ───────────────────────────────────────────────────────────
app.get('/api/fasts', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM fasts WHERE user_id = $1 ORDER BY started_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json({ fasts: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/fasts', requireAuth, async (req, res) => {
  const { preset, target_hours, started_at } = req.body;
  const hours = parseFloat(target_hours);
  if (!hours || hours <= 0 || hours > 168)
    return res.status(400).json({ error: 'Invalid fasting duration.' });

  try {
    // End any active fast first
    await pool.query(
      'UPDATE fasts SET ended_at = NOW() WHERE user_id = $1 AND ended_at IS NULL',
      [req.user.id]
    );
    const result = await pool.query(
      'INSERT INTO fasts (user_id, preset, target_hours, started_at) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.id, preset || null, hours, started_at || new Date().toISOString()]
    );
    res.json({ fast: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/fasts/:id/end', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE fasts SET ended_at = NOW() WHERE id = $1 AND user_id = $2 AND ended_at IS NULL RETURNING *',
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'No active fast found.' });
    res.json({ fast: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/fasts/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM fasts WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Fast not found.' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Meal / daily log routes ──────────────────────────────────────────────────
app.get('/api/meals', requireAuth, async (req, res) => {
  const { date } = req.query;
  const d = date || new Date().toISOString().split('T')[0];
  try {
    const meals = await pool.query(
      'SELECT * FROM meal_entries WHERE user_id = $1 AND log_date = $2 ORDER BY created_at ASC',
      [req.user.id, d]
    );
    const log = await pool.query(
      'SELECT * FROM daily_logs WHERE user_id = $1 AND log_date = $2',
      [req.user.id, d]
    );
    res.json({ meals: meals.rows, log: log.rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/meals', requireAuth, async (req, res) => {
  const { label, calories, date } = req.body;
  if (!label?.trim()) return res.status(400).json({ error: 'Meal name is required.' });
  const cal = parseInt(calories, 10);
  if (!cal || cal <= 0) return res.status(400).json({ error: 'Enter a valid calorie amount.' });

  try {
    const d = date || new Date().toISOString().split('T')[0];
    const result = await pool.query(
      'INSERT INTO meal_entries (user_id, log_date, label, calories) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.id, d, label.trim(), cal]
    );
    res.json({ meal: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/meals/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM meal_entries WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Entry not found.' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/daily-log', requireAuth, async (req, res) => {
  const { date, success, notes } = req.body;
  const d = date || new Date().toISOString().split('T')[0];
  try {
    await pool.query(
      `INSERT INTO daily_logs (user_id, log_date, success, notes)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, log_date) DO UPDATE SET
         success = EXCLUDED.success, notes = EXCLUDED.notes`,
      [req.user.id, d, success ?? null, notes || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/daily-logs', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT dl.log_date, dl.success, dl.notes,
              COALESCE(SUM(me.calories), 0) AS total_calories,
              COUNT(me.id) AS meal_count
       FROM daily_logs dl
       LEFT JOIN meal_entries me ON me.user_id = dl.user_id AND me.log_date = dl.log_date
       WHERE dl.user_id = $1
       GROUP BY dl.log_date, dl.success, dl.notes
       ORDER BY dl.log_date DESC
       LIMIT 60`,
      [req.user.id]
    );
    res.json({ logs: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Expense category routes ─────────────────────────────────────────────────
app.get('/api/expense-categories', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM expense_categories WHERE user_id = $1 ORDER BY name ASC',
      [req.user.id]
    );
    res.json({ categories: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/expense-categories', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Category name is required.' });
  try {
    const result = await pool.query(
      'INSERT INTO expense_categories (user_id, name) VALUES ($1, $2) RETURNING *',
      [req.user.id, name.trim()]
    );
    res.json({ category: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Category already exists.' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/expense-categories/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM expense_categories WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Category not found.' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Expense routes ──────────────────────────────────────────────────────────
app.get('/api/expenses', requireAuth, async (req, res) => {
  const { month } = req.query; // format: YYYY-MM
  try {
    let query, params;
    if (month) {
      query = `SELECT * FROM expenses WHERE user_id = $1 AND to_char(expense_date, 'YYYY-MM') = $2 ORDER BY expense_date DESC, created_at DESC`;
      params = [req.user.id, month];
    } else {
      query = 'SELECT * FROM expenses WHERE user_id = $1 ORDER BY expense_date DESC, created_at DESC LIMIT 100';
      params = [req.user.id];
    }
    const result = await pool.query(query, params);
    res.json({ expenses: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/expenses', requireAuth, async (req, res) => {
  const { amount, category_type, subcategory, note, date } = req.body;
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Enter a valid amount.' });
  if (!['necessary', 'unnecessary'].includes(category_type))
    return res.status(400).json({ error: 'Invalid category type.' });
  if (!subcategory?.trim()) return res.status(400).json({ error: 'Subcategory is required.' });
  try {
    const d = date || new Date().toISOString().split('T')[0];
    const result = await pool.query(
      'INSERT INTO expenses (user_id, amount, category_type, subcategory, note, expense_date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.user.id, amt, category_type, subcategory.trim(), note?.trim() || null, d]
    );
    res.json({ expense: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/expenses/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Expense not found.' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/expenses/summary', requireAuth, async (req, res) => {
  const { month } = req.query;
  const m = month || new Date().toISOString().slice(0, 7);
  try {
    const result = await pool.query(
      `SELECT category_type, subcategory, SUM(amount)::numeric AS total, COUNT(*)::int AS count
       FROM expenses WHERE user_id = $1 AND to_char(expense_date, 'YYYY-MM') = $2
       GROUP BY category_type, subcategory ORDER BY total DESC`,
      [req.user.id, m]
    );
    const totals = await pool.query(
      `SELECT category_type, SUM(amount)::numeric AS total
       FROM expenses WHERE user_id = $1 AND to_char(expense_date, 'YYYY-MM') = $2
       GROUP BY category_type`,
      [req.user.id, m]
    );
    res.json({ breakdown: result.rows, totals: totals.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Push token ──────────────────────────────────────────────────────────────
app.put('/api/push-token', requireAuth, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });
  try {
    await pool.query('UPDATE users SET push_token = $1 WHERE id = $2', [token, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Responsibility routes ───────────────────────────────────────────────────
app.get('/api/responsibilities', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM responsibilities WHERE user_id = $1 ORDER BY completed ASC, due_date ASC',
      [req.user.id]
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/responsibilities', requireAuth, async (req, res) => {
  const { title, note, due_date, priority } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' });
  if (!due_date) return res.status(400).json({ error: 'Due date is required.' });
  if (priority && !['normal', 'high'].includes(priority))
    return res.status(400).json({ error: 'Priority must be normal or high.' });
  try {
    const result = await pool.query(
      'INSERT INTO responsibilities (user_id, title, note, due_date, priority) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.user.id, title.trim(), note?.trim() || null, due_date, priority || 'normal']
    );
    res.json({ item: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/responsibilities/:id', requireAuth, async (req, res) => {
  const { completed, title, note, due_date, priority } = req.body;
  try {
    const existing = await pool.query(
      'SELECT * FROM responsibilities WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: 'Not found.' });
    const item = existing.rows[0];
    const result = await pool.query(
      `UPDATE responsibilities SET title = $1, note = $2, due_date = $3, priority = $4, completed = $5
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [
        title ?? item.title, note !== undefined ? (note || null) : item.note,
        due_date ?? item.due_date, priority ?? item.priority,
        completed !== undefined ? completed : item.completed,
        req.params.id, req.user.id
      ]
    );
    res.json({ item: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/responsibilities/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM responsibilities WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found.' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Reminder cron (runs every 30 minutes) ───────────────────────────────────
cron.schedule('*/30 * * * *', async () => {
  console.log('Checking reminders...');
  try {
    const now = new Date();

    // High priority: email 1 week before
    const weekItems = await pool.query(
      `SELECT r.*, u.email, u.push_token FROM responsibilities r
       JOIN users u ON u.id = r.user_id
       WHERE r.completed = FALSE AND r.reminded_1w = FALSE AND r.priority = 'high'
         AND r.due_date <= NOW() + INTERVAL '7 days' AND r.due_date > NOW()`
    );
    for (const item of weekItems.rows) {
      const dueStr = new Date(item.due_date).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      await sendEmail(
        item.email,
        `[HIGH] Reminder: ${item.title}`,
        `Hey! This is your 1-week reminder.\n\n"${item.title}"${item.note ? `\nNote: ${item.note}` : ''}\n\nDue: ${dueStr}\n\nDon't forget!\n— LunaSol`
      );
      await sendPushNotification(item.push_token, `[HIGH] ${item.title}`, `Due ${dueStr} — 1 week reminder`);
      await pool.query('UPDATE responsibilities SET reminded_1w = TRUE WHERE id = $1', [item.id]);
    }

    // Normal + High: push notification 24h before
    const dayItems = await pool.query(
      `SELECT r.*, u.push_token FROM responsibilities r
       JOIN users u ON u.id = r.user_id
       WHERE r.completed = FALSE AND r.reminded_24h = FALSE
         AND r.due_date <= NOW() + INTERVAL '24 hours' AND r.due_date > NOW()`
    );
    for (const item of dayItems.rows) {
      const dueStr = new Date(item.due_date).toLocaleDateString('en-US', {
        weekday: 'short', hour: '2-digit', minute: '2-digit',
      });
      const prefix = item.priority === 'high' ? '[HIGH] ' : '';
      await sendPushNotification(item.push_token, `${prefix}Due tomorrow: ${item.title}`, `${dueStr}${item.note ? ` — ${item.note}` : ''}`);
      await pool.query('UPDATE responsibilities SET reminded_24h = TRUE WHERE id = $1', [item.id]);
    }

    // Also email high priority at 24h mark
    const dayHighItems = await pool.query(
      `SELECT r.*, u.email FROM responsibilities r
       JOIN users u ON u.id = r.user_id
       WHERE r.completed = FALSE AND r.reminded_24h = TRUE AND r.priority = 'high'
         AND r.due_date <= NOW() + INTERVAL '24 hours' AND r.due_date > NOW()
         AND r.reminded_1w = TRUE`
    );
    for (const item of dayHighItems.rows) {
      const dueStr = new Date(item.due_date).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      await sendEmail(
        item.email,
        `[URGENT] Tomorrow: ${item.title}`,
        `URGENT REMINDER!\n\n"${item.title}"${item.note ? `\nNote: ${item.note}` : ''}\n\nDue: ${dueStr}\n\nThis is due TOMORROW.\n— LunaSol`
      );
    }

    console.log(`Reminders processed: ${weekItems.rows.length} weekly, ${dayItems.rows.length} daily`);
  } catch (err) {
    console.error('Reminder cron error:', err.message);
  }
});

// ── Cleanse challenge routes ────────────────────────────────────────────────
app.get('/api/cleanse', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM cleanse_challenges WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );
    res.json({ challenge: result.rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/cleanse', requireAuth, async (req, res) => {
  const { total_days } = req.body;
  const days = parseInt(total_days) || 14;
  try {
    // Mark any active challenge as completed first
    await pool.query(
      'UPDATE cleanse_challenges SET completed = TRUE WHERE user_id = $1 AND completed = FALSE',
      [req.user.id]
    );
    const result = await pool.query(
      'INSERT INTO cleanse_challenges (user_id, total_days, days_left) VALUES ($1, $2, $2) RETURNING *',
      [req.user.id, days]
    );
    res.json({ challenge: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/cleanse/:id/checkin', requireAuth, async (req, res) => {
  try {
    const existing = await pool.query(
      'SELECT * FROM cleanse_challenges WHERE id = $1 AND user_id = $2 AND completed = FALSE',
      [req.params.id, req.user.id]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: 'No active challenge found.' });
    const challenge = existing.rows[0];
    const newDays = Math.max(0, challenge.days_left - 1);
    const done = newDays === 0;
    const result = await pool.query(
      'UPDATE cleanse_challenges SET days_left = $1, completed = $2 WHERE id = $3 RETURNING *',
      [newDays, done, challenge.id]
    );
    res.json({ challenge: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/cleanse/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM cleanse_challenges WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found.' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Meal prep checklist routes ──────────────────────────────────────────────
app.get('/api/meal-prep', requireAuth, async (req, res) => {
  const { date } = req.query;
  const d = date || new Date().toISOString().split('T')[0];
  try {
    const result = await pool.query(
      'SELECT * FROM meal_prep_checks WHERE user_id = $1 AND check_date = $2',
      [req.user.id, d]
    );
    res.json({ check: result.rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/meal-prep', requireAuth, async (req, res) => {
  const { date, eggs, protein_shake, veggies, extra_protein, protein_type } = req.body;
  const d = date || new Date().toISOString().split('T')[0];
  try {
    const result = await pool.query(
      `INSERT INTO meal_prep_checks (user_id, check_date, eggs, protein_shake, veggies, extra_protein, protein_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (user_id, check_date) DO UPDATE SET
         eggs = EXCLUDED.eggs, protein_shake = EXCLUDED.protein_shake,
         veggies = EXCLUDED.veggies, extra_protein = EXCLUDED.extra_protein,
         protein_type = EXCLUDED.protein_type
       RETURNING *`,
      [req.user.id, d, eggs || false, protein_shake || false, veggies || false, extra_protein || false, protein_type || null]
    );
    res.json({ check: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Test email endpoint (remove after testing) ─────────────────────────────
app.get('/api/test-email', requireAuth, async (req, res) => {
  if (!emailTransporter) return res.json({ error: 'No SMTP configured. Check env vars: SMTP_HOST, SMTP_USER, SMTP_PASS' });
  try {
    await emailTransporter.sendMail({
      from: process.env.SMTP_FROM || 'LunaSol <noreply@lunasol.app>',
      to: req.user.email,
      subject: 'LunaSol Test Email',
      text: 'If you received this, your email configuration is working correctly!\n\n— LunaSol',
    });
    res.json({ success: true, sent_to: req.user.email });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// ── Smart redirect ───────────────────────────────────────────────────────────
app.get('/dashboard', (req, res) => res.sendFile(__dirname + '/public/dashboard.html'));

app.listen(PORT, () => {
  console.log(`LunaSol running at http://localhost:${PORT}`);
});
