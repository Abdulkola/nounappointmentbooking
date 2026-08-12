const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(session({
  secret: 'replace_this_with_a_strong_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// In-memory user store (for demo). Passwords should be stored hashed in a real DB.
const users = [
  { username: 'admin', passwordHash: bcrypt.hashSync('admin123', 10) }
];

function authRequired(req, res, next) {
  if (req.session && req.session.user) return next();
  res.redirect('/login.html');
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

// API: login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });
  if (!bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  req.session.user = { username };
  res.json({ ok: true, username });
});

// API: current user
app.get('/api/me', (req, res) => {
  if (req.session && req.session.user) return res.json({ username: req.session.user.username });
  res.status(401).json({ error: 'Not authenticated' });
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
