const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const path = require('path');

const app = express();
const server = http.createServer(app);

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'chat-app-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
});

const USERS = {
  alice:  { password: 'pass1', displayName: 'Alice' },
  bob:    { password: 'pass2', displayName: 'Bob' },
  carol:  { password: 'pass3', displayName: 'Carol' },
  dave:   { password: 'pass4', displayName: 'Dave' },
  eve:    { password: 'pass5', displayName: 'Eve' },
  frank:  { password: 'pass6', displayName: 'Frank' },
};

const io = new Server(server);
const onlineUsers = new Map(); // socketId -> username
const messages = [];          // in-memory message history (last 100)

app.use(sessionMiddleware);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = USERS[username?.toLowerCase()];
  if (user && user.password === password) {
    req.session.username = username.toLowerCase();
    res.json({ ok: true, displayName: user.displayName });
  } else {
    res.status(401).json({ ok: false, error: 'Invalid username or password' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/me', (req, res) => {
  const username = req.session.username;
  if (username && USERS[username]) {
    res.json({ username, displayName: USERS[username].displayName });
  } else {
    res.status(401).json({ error: 'Not logged in' });
  }
});

io.use((socket, next) => {
  sessionMiddleware(socket.request, socket.request.res || {}, next);
});

io.on('connection', (socket) => {
  const username = socket.request.session?.username;
  if (!username || !USERS[username]) {
    socket.disconnect(true);
    return;
  }

  const displayName = USERS[username].displayName;
  onlineUsers.set(socket.id, username);

  socket.emit('history', messages.slice(-100));
  io.emit('online', [...new Set(onlineUsers.values())].map(u => USERS[u].displayName));
  io.emit('system', `${displayName} joined the chat`);

  socket.on('message', (text) => {
    if (typeof text !== 'string' || !text.trim()) return;
    const msg = {
      displayName,
      text: text.trim().slice(0, 1000),
      time: new Date().toISOString(),
    };
    messages.push(msg);
    if (messages.length > 100) messages.shift();
    io.emit('message', msg);
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    io.emit('online', [...new Set(onlineUsers.values())].map(u => USERS[u].displayName));
    io.emit('system', `${displayName} left the chat`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Chat app running at http://localhost:${PORT}`));
