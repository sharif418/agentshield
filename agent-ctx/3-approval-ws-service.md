# Task 3: WebSocket Mini-Service for Real-Time HITL Notifications

## Agent: approval-ws-service
## Date: 2026-04-20

## Summary
Created a standalone WebSocket mini-service at `/home/z/my-project/mini-services/approval-ws/` for real-time Human-in-the-Loop (HITL) approval notifications.

## Files Created

### 1. `/home/z/my-project/mini-services/approval-ws/package.json`
- Name: approval-ws
- Runtime: bun
- Dev script: `bun --hot index.ts` (auto-restart on file changes)
- Dependencies: socket.io ^4.8.1

### 2. `/home/z/my-project/mini-services/approval-ws/index.ts`
Main service file implementing:

**WebSocket Events (Socket.IO):**
- `subscribe:approvals` - Client subscribes to approval updates
- `unsubscribe:approvals` - Client unsubscribes from approval updates
- `approval:new` - Broadcast new approval request to all subscribers
- `approval:updated` - Broadcast approval status change to all subscribers
- `approval:reminder` - Auto-reminder for pending approvals > 5 minutes
- `connected` - Welcome message on connection with current state
- `subscription:confirmed` - Confirmation of subscription/unsubscription with pending approvals

**REST Endpoints (via engine.io middleware):**
- `GET /health` - Health check with service metrics
- `POST /notify/new` - Broadcast new approval request (body: { requestId, agentRole, toolName, requestedAction, agentContext })
- `POST /notify/update` - Broadcast approval update (body: { requestId, status, humanReviewerId, reviewNotes })

**Key Technical Decisions:**
- Used `io.engine.use()` middleware to handle REST endpoints BEFORE socket.io processes them. This was necessary because socket.io with `path: '/'` intercepts ALL HTTP requests. The middleware intercepts known REST routes and handles them, passing unknown routes to socket.io.
- Port hardcoded to 3003 as required
- CORS enabled for all origins (development mode)
- Heartbeat/ping-pong via socket.io's built-in pingTimeout/pingInterval (60s/25s)
- Client tracking with subscription state
- Pending approval tracking for reminder functionality
- Graceful shutdown with SIGTERM/SIGINT handling

### 3. `/home/z/my-project/mini-services/approval-ws/run.sh`
Respawn wrapper script that automatically restarts the service if it crashes.

### 4. `/home/z/my-project/mini-services/approval-ws/start.sh`
Simple start script that runs `bun run dev`.

## Test Results
All 6 tests passed in a single Bash session:
1. ✅ Health check - returns service metrics
2. ✅ Notify new - creates and broadcasts approval request
3. ✅ Notify update - updates status and broadcasts, removes from pending
4. ✅ Validation - returns 400 for missing required fields
5. ✅ Invalid status - returns 400 for invalid status values
6. ✅ Health after approval - pending approvals count is 0 after approval

## Service Start Command
```bash
cd /home/z/my-project/mini-services/approval-ws && bun run dev
```

## Frontend Connection Pattern
```typescript
// Connect to the approval WebSocket service via Caddy gateway
const socket = io('/?XTransformPort=3003', {
  transports: ['websocket', 'polling'],
})

// Subscribe to approvals
socket.emit('subscribe:approvals')

// Listen for events
socket.on('approval:new', (data) => { /* handle new approval */ })
socket.on('approval:updated', (data) => { /* handle status change */ })
socket.on('approval:reminder', (data) => { /* handle pending reminder */ })
```

## API Call Pattern (from Next.js API routes)
```typescript
// Create new approval notification
await fetch('/api/notify/new?XTransformPort=3003', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ requestId, agentRole, toolName, requestedAction, agentContext }),
})

// Update approval status
await fetch('/api/notify/update?XTransformPort=3003', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ requestId, status, humanReviewerId, reviewNotes }),
})
```
