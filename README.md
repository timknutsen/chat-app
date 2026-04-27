# Chat App

Real-time multi-user chat with reactions and voting polls. Built for the Vibe Force Six.

**Live:** https://chat-app-production-1225.up.railway.app

## Features

- Real-time messaging via WebSockets
- Emoji reactions (👍 ❤️) — toggle per user, live counts
- Voting polls — `/vote Question` or `/vote Question | A | B | C`
- Background notifications — desktop notification (where supported) + unread count in the tab title when the window is unfocused. iOS browsers don't expose the Web Notifications API outside an installed PWA, so iOS users get the tab-title counter only.
- Mobile layout — sidebar collapses and chat fills the viewport on narrow screens
- Session persistence — stay logged in on refresh

## Stack

- **Server:** Node.js, Express 5, Socket.io 4, express-session
- **Client:** Single HTML file, no build step, no framework
- **Hosting:** Railway

## Running locally

```bash
npm install
node server.js
```

Open at http://localhost:3000. Open multiple tabs to simulate multiple users.

## Deploying

```bash
git push
railway up --detach
railway logs   # to check build/runtime output
```

## Changing users

Users and passwords are set via a Railway environment variable — never hardcoded.

```bash
railway service chat-app
railway variables set USERS_CONFIG='{"alice":{"password":"secret","displayName":"Alice"},"bob":{"password":"secret2","displayName":"Bob"}}'
railway up --detach
```

## Using polls

Type in the chat input:

| Command | Result |
|---|---|
| `/vote What should we eat?` | Yes / No poll |
| `/vote Lunch? \| Pizza \| Sushi \| Tacos` | Custom options (up to 5) |

Click an option to vote. Click again to unvote. Poll creator can close the poll to lock results.

## Notes

- All data is in-memory — messages, reactions, and polls reset on redeploy
- Message history is capped at 100 items
