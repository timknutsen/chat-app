# Chat App

Real-time multi-user chat. Node.js + Socket.io + Express. Deployed on Railway.

## Running locally

```bash
node server.js        # default port 3000
PORT=4000 node server.js
```

Open multiple browser tabs to simulate multiple users. Login with any credentials from `USERS_DEFAULT` in [server.js](server.js).

## Stack

- **Server**: Express 5, Socket.io 4, express-session (in-memory store)
- **Client**: Single HTML file at [public/index.html](public/index.html) — no build step, no framework
- **Deployment**: Railway via `start` script, `PORT` env var

## Architecture

Everything is in-memory. No database. Server restart clears all messages, reactions, and polls.

Key server state:
- `messages[]` — capped at 100, in chronological order
- `onlineUsers` Map — socketId → username
- `reactionUsers` Map — msgId → { emoji → Set(displayName) }; cleaned up when messages are pruned
- `msgCounter` — monotonic ID for messages

Socket events (client → server): `message`, `react`, `create-poll`, `vote-poll`, `close-poll`
Socket events (server → client): `history`, `message`, `system`, `online`, `reaction`, `poll`

## Users

Defined in `USERS_DEFAULT` in [server.js](server.js). Override at runtime with:

```bash
USERS_CONFIG='{"alice":{"password":"pw","displayName":"Alice"}}' node server.js
```

Current users: Simeon, Martin, Tim, Lars, Arturo, Felix.

## Adding features

### New socket event pattern (server)
```js
socket.on('my-event', (payload) => {
  try {
    // validate input first, return silently on bad input
    if (!isValid(payload)) return;
    // mutate state
    // broadcast
    io.emit('my-event', result);
  } catch (e) {
    console.error('my-event error:', e);
  }
});
```

Always wrap handlers in try/catch — an unhandled exception inside a socket handler will drop the connection.

### New UI element pattern (client)
Poll cards, reaction bars, and system messages all appear inline in `#messages`. Append a DOM element via `messagesEl.appendChild(el)`, set `data-*` attributes for later lookup, call `scrollBottom()`.

## Testing

No test framework yet. Before pushing any change:

1. Open two browser tabs, log in as different users
2. Send messages — confirm they appear in both tabs
3. Add a reaction — confirm count updates in both tabs, toggles off on re-click
4. Create a poll with `/vote` — confirm card appears, votes update live, close disables buttons
5. Refresh one tab — confirm session restores and history loads

To add unit tests: use `node:test` (built-in, no install needed). Extract pure logic functions from socket handlers and test those directly.

## Security notes

- Passwords are plaintext in env vars — acceptable for this internal use case
- All user content is HTML-escaped via `escHtml()` before insertion into the DOM
- Emoji reactions are validated against a server-side allowlist
- Session secret defaults to a hardcoded string; set `SESSION_SECRET` env var in production
