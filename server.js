const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Enable CORS with credentials so browser can send/receive cookies
app.use(cors({ origin: true, credentials: true }));

// If deployed behind a proxy (Heroku, Vercel, etc.) trust the first proxy
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'replace_this_with_a_strong_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Load users from users.json if present, otherwise fall back to a default in-memory user.
const fs = require('fs');
let users = [];
try {
  const data = fs.readFileSync(path.join(__dirname, 'users.json'), 'utf8');
  users = JSON.parse(data);
  console.log('[users] loaded from users.json', users.map(u => u.username));
} catch (e) {
  console.log('[users] users.json not found or invalid, using default in-memory user');
  users = [ { username: 'admin', passwordHash: bcrypt.hashSync('admin123', 10) } ];
}

const usersPath = path.join(__dirname, 'users.json');

function saveUsers() {
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

const appointmentsPath = path.join(__dirname, 'appointments.json');
let appointments = [];
try {
  appointments = JSON.parse(fs.readFileSync(appointmentsPath, 'utf8'));
} catch (e) {
  appointments = [];
}

function saveAppointments() {
  fs.writeFileSync(appointmentsPath, JSON.stringify(appointments, null, 2));
}

function authRequired(req, res, next) {
  if (req.session && req.session.user) return next();
  res.redirect('/login.html');
}

function adminRequired(req, res, next) {
  if (req.session && req.session.user && req.session.user.username === 'admin') return next();
  res.status(403).json({ error: 'Administrator access required' });
}

// Protected HTML pages (serve after auth)
app.get('/student-dashboard.html', authRequired, (req, res) => {
  res.sendFile(path.join(__dirname, 'student-dashboard.html'));
});
app.get('/book-appointment.html', authRequired, (req, res) => {
  res.sendFile(path.join(__dirname, 'book-appointment.html'));
});
app.get('/my-appointments.html', authRequired, (req, res) => {
  res.sendFile(path.join(__dirname, 'my-appointments.html'));
});
app.get('/profile.html', authRequired, (req, res) => {
  res.sendFile(path.join(__dirname, 'profile.html'));
});
app.get('/admin-dashboard.html', authRequired, (req, res) => {
  if (req.session.user.username !== 'admin') return res.redirect('/student-dashboard.html');
  res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

// API: login
app.post('/api/register', (req, res) => {
  const { username, password, fullName, email, phone, matricNumber, programme } = req.body || {};
  const normalizedUsername = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(normalizedUsername)) {
    return res.status(400).json({ error: 'Username must be 3-30 characters using letters, numbers, dots, underscores, or hyphens.' });
  }
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (!fullName || !email || !phone || !matricNumber || !programme || programme === 'Select Programme') {
    return res.status(400).json({ error: 'Please complete all registration fields.' });
  }
  if (users.some(user => user.username === normalizedUsername)) {
    return res.status(409).json({ error: 'That username is already registered.' });
  }

  users.push({
    username: normalizedUsername,
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'student',
    fullName: String(fullName).trim(),
    email: String(email).trim(),
    phone: String(phone).trim(),
    matricNumber: String(matricNumber).trim(),
    programme: String(programme).trim()
  });
  saveUsers();
  res.status(201).json({ ok: true, username: normalizedUsername });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  console.log('[login] attempt for username:', username);
  const user = users.find(u => u.username === username);
  if (!user) {
    console.log('[login] user not found:', username);
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const ok = bcrypt.compareSync(password, user.passwordHash);
  console.log('[login] password match:', ok);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  req.session.user = { username };
  console.log('[login] success for', username);
  res.json({ ok: true, username });
});

// API: current user
app.get('/api/me', (req, res) => {
  if (req.session && req.session.user) return res.json({ username: req.session.user.username });
  res.status(401).json({ error: 'Not authenticated' });
});

// API: appointment requests and status notifications
app.get('/api/appointments', authRequired, (req, res) => {
  const isAdmin = req.session.user.username === 'admin';
  const result = isAdmin ? appointments : appointments.filter(item => item.student === req.session.user.username);
  res.json(result);
});

app.post('/api/appointments', authRequired, (req, res) => {
  const { date, time, department, purpose } = req.body || {};
  if (req.session.user.username === 'admin') return res.status(403).json({ error: 'Administrators cannot submit student appointments' });
  if (!date || !time || !department || !purpose) {
    return res.status(400).json({ error: 'Date, time, department, and purpose are required' });
  }

  const appointment = {
    id: Date.now().toString(),
    student: req.session.user.username,
    date,
    time,
    department,
    purpose,
    status: 'Pending',
    remark: '',
    createdAt: new Date().toISOString(),
    studentUnread: true,
    adminUnread: true
  };
  appointments.push(appointment);
  saveAppointments();
  res.status(201).json(appointment);
});

app.patch('/api/appointments/:id', adminRequired, (req, res) => {
  const { date, time, department, purpose } = req.body || {};
  if (!date || !time || !department || !purpose) {
    return res.status(400).json({ error: 'Date, time, department, and purpose are required' });
  }
  const appointment = appointments.find(item => item.id === req.params.id);
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

  appointment.date = date;
  appointment.time = time;
  appointment.department = String(department).trim();
  appointment.purpose = String(purpose).trim();
  appointment.studentUnread = true;
  appointment.updatedAt = new Date().toISOString();
  saveAppointments();
  res.json(appointment);
});

app.patch('/api/appointments/:id/status', adminRequired, (req, res) => {
  const { status, remark } = req.body || {};
  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be Approved or Rejected' });
  }
  const appointment = appointments.find(item => item.id === req.params.id);
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

  appointment.status = status;
  appointment.remark = String(remark || '').trim();
  appointment.studentUnread = true;
  appointment.adminUnread = false;
  appointment.updatedAt = new Date().toISOString();
  saveAppointments();
  res.json(appointment);
});

app.patch('/api/appointments/:id/read', authRequired, (req, res) => {
  const appointment = appointments.find(item => item.id === req.params.id);
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  const isAdmin = req.session.user.username === 'admin';
  if (!isAdmin && appointment.student !== req.session.user.username) return res.status(403).json({ error: 'Not allowed' });
  if (isAdmin) appointment.adminUnread = false;
  else appointment.studentUnread = false;
  saveAppointments();
  res.json({ ok: true });
});

// API: logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ ok: true });
  });
});

// Serve static assets and remaining pages
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});
