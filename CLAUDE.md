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
- **Deployment**: Railway. `git push` then `railway up --detach`; `railway logs` for build/runtime output. Live at https://chat-app-production-1225.up.railway.app

## File structure

```
chat-app/
├── server.js          # Express + Socket.io server, all business logic
├── public/
│   └── index.html     # Single-file client app (HTML + CSS + JS inline)
├── package.json
└── CLAUDE.md
```

## Architecture

Everything is in-memory. No database. Server restart clears all messages, reactions, and polls.

### Server state

| Variable | Type | Description |
|---|---|---|
| `messages[]` | Array | All messages, capped at 100, chronological |
| `msgCounter` | number | Monotonic ID assigned to each message |
| `onlineUsers` | Map | `socketId → username` (login key, not display name) |
| `reactionUsers` | Map | `msgId → { emoji → Set(displayName) }` — cleaned up when messages pruned |
| `polls` | Map | `pollId → poll object` |
| `pollCounter` | number | Monotonic ID for polls |

### Data structures

**Message object** (stored in `messages[]`, broadcast via `message` event):
```js
{
  id: number,
  displayName: string,
  text: string,           // max 1000 chars
  time: string,           // ISO 8601
  reactions: {            // emoji → count, only present keys included
    "👍": number,
    "❤️": number
  }
}
```

**Poll object** (stored in `polls` Map, broadcast via `poll` event):
```js
{
  id: number,
  type: 'poll',
  question: string,       // max 300 chars
  options: string[],      // 2–5 options, max 100 chars each
  votes: {                // internal only — NOT sent to client
    [optionIndex]: Set    // Set of displayName strings
  },
  counts: {               // sent to client
    [optionIndex]: number
  },
  creator: string,        // displayName of creator
  closed: boolean,
  time: string            // ISO 8601
}
```

### Socket events

**Client → server:**

| Event | Payload | Validation |
|---|---|---|
| `message` | `string` | plain string (not wrapped), max 1000 chars |
| `react` | `{ msgId: number, emoji: string }` | emoji must be in the server-side allowlist (see `server.js`) |
| `create-poll` | `{ question: string, options: string[] }` | 2–5 options |
| `vote-poll` | `{ pollId: number, optionIndex: number }` | poll must exist and be open |
| `close-poll` | `{ pollId: number }` | requester must be creator |

**Server → client:**

| Event | Payload | When |
|---|---|---|
| `history` | mixed array of messages and polls, chronological — see example below | On connect (sent only to joining socket) |
| `message` | message object | New message (broadcast to all) |
| `system` | string | User join/leave (broadcast to all) |
| `online` | `string[]` (display names) | Online list changes (broadcast to all) |
| `reaction` | `{ msgId, reactions }` | Reaction toggled (broadcast to all) |
| `poll` | poll object (without `votes`) | Poll created/updated/closed (broadcast to all) |

Example `history` payload — clients dispatch each entry by checking `type === 'poll'`:

```js
[
  { id: 1, displayName: 'Tim', text: 'morning', time: '...', reactions: {} },
  { id: 2, type: 'poll', question: 'lunch?', options: ['yes','no'], counts: {0:1,1:0}, creator: 'Tim', closed: false, time: '...' },
  { id: 3, displayName: 'Lars', text: 'sure', time: '...', reactions: { '👍': 1 } }
]
```

Note: message `id` and poll `id` come from independent counters, so an entry's identity is `(type, id)`, not `id` alone.

## Users

Defined in `USERS_DEFAULT` in [server.js](server.js). Override at runtime with:

```bash
USERS_CONFIG='{"alice":{"password":"pw","displayName":"Alice"}}' node server.js
```

Current users (username / password → display name):

| Username | Password | Display name |
|---|---|---|
| simeon | pass1 | Simeon |
| martin | pass2 | Martin |
| tim | pass3 | Tim |
| lars | pass4 | Lars |
| arturo | pass5 | Arturo |
| felix | pass6 | Felix |

## HTTP routes

| Method | Path | Description |
|---|---|---|
| `POST` | `/login` | Authenticate, set session cookie |
| `POST` | `/logout` | Destroy session |
| `GET` | `/me` | Return `{ displayName }` for current session (used on page load) |
| `GET` | `/*` | Serve static files from `public/` |

## Client-side overview

Single file at `public/index.html`. Inline CSS + JS, no build step, no framework.

### Key client state

| Variable | Description |
|---|---|
| `myDisplayName` | Current user's display name (set after login) |
| `myVotes` | `Map<pollId, optionIndex>` — local vote tracking, resets on reload |
| `unread` | Unread message counter, shown in tab title |
| `focused` | Whether the browser tab is visible (via `visibilitychange`) |

### Browser notifications

On login the client calls `Notification.requestPermission()` if the API exists. While the tab is unfocused, incoming messages and new polls fire a `Notification` (body truncated to 100 chars; clicking refocuses the window). Granting is one-shot per origin — denied permission silently no-ops via the `granted` check in `notify()`. The unread counter in the tab title runs in parallel and works regardless of notification permission.

Both call sites guard with `typeof Notification !== 'undefined'`. iOS browsers (Safari and Chrome alike) do not expose the Web Notifications API outside an installed PWA — without the guard, accessing `Notification.permission` throws `ReferenceError` and aborts `enterChat()` before `connectSocket()` runs, leaving the user with a chat UI but no socket. Keep the guards in place when touching this code.

### Mobile layout

Single breakpoint at `max-width: 600px` in the inline `<style>`: chat fills the viewport (`100dvh`, no border/radius), the online sidebar is hidden, message bubbles widen to 90%, and paddings tighten. A separate `@media (hover: none)` rule keeps reaction buttons visible on touch devices where `:hover` never fires.

### Key client functions

| Function | Description |
|---|---|
| `doLogin()` | POST to `/login`, call `enterChat()` on success |
| `enterChat(displayName)` | Hide login screen, show chat, call `connectSocket()` |
| `connectSocket()` | Init Socket.IO, register all event listeners |
| `appendMessage(msg)` | Build and insert message DOM element |
| `appendPoll(poll)` | Build poll card DOM element |
| `updatePollCard(card, poll)` | Refresh vote counts/percentages in existing poll card |
| `updatePills(wrap, msgId, reactions)` | Rebuild reaction pill buttons |
| `sendMessage()` | Parse `/vote` syntax or send plain text |
| `escHtml(s)` | HTML-escape utility — always use before injecting user content |
| `scrollBottom()` | Scroll `#messages` to bottom |

### Poll command syntax

```
/vote Question                          → Yes / No poll
/vote Question | Option A | Option B    → Custom options (2–5)
```

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

Always escape user-provided strings with `escHtml()` before inserting into `innerHTML`.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP listen port |
| `SESSION_SECRET` | `'chat-app-secret-key'` | Express session signing secret |
| `USERS_CONFIG` | — | JSON override for user accounts |

## Testing

No test framework yet. Before pushing any change:

1. Open two browser tabs, log in as different users
2. Send messages — confirm they appear in both tabs
3. Add a reaction — confirm count updates in both tabs, toggles off on re-click
4. Create a poll with `/vote` — confirm card appears, votes update live, close disables buttons
5. Refresh one tab — confirm session restores and history loads
6. Background one tab and post from another — confirm tab-title counter increments and (if permission granted) a desktop notification fires
7. Open in a narrow window (≤600px) — confirm sidebar hides and chat fills the viewport

There is no automated test suite. The socket handlers in `server.js` mix validation, state mutation, and broadcasting in the same closure, so adding tests means extracting the pure pieces (e.g. poll option parsing, reaction toggling) into separate functions first.

## Security notes

- Passwords are plaintext in env vars — acceptable for this internal use case
- All user content is HTML-escaped via `escHtml()` before insertion into the DOM
- Emoji reactions are validated against a server-side allowlist (defined inline in the `react` handler in `server.js`)
- Session secret defaults to a hardcoded string; set `SESSION_SECRET` env var in production
- Socket connections are dropped immediately if the session has no authenticated user
