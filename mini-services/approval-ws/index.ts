import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server, Socket } from 'socket.io'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApprovalRequest {
  requestId: string
  agentRole: string
  toolName: string
  requestedAction: string
  agentContext: string
  createdAt: string
}

interface ApprovalUpdate {
  requestId: string
  status: 'approved' | 'denied' | 'pending'
  humanReviewerId?: string
  reviewNotes?: string
  updatedAt: string
}

interface ClientInfo {
  id: string
  subscribed: boolean
  connectedAt: string
}

// ─── State ───────────────────────────────────────────────────────────────────

const connectedClients = new Map<string, ClientInfo>()
const pendingApprovals = new Map<string, { request: ApprovalRequest; createdAt: number }>()

let reminderInterval: ReturnType<typeof setInterval> | null = null

const PORT = 3003

// ─── Helper: parse JSON body from HTTP request ──────────────────────────────

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString()
        resolve(body ? JSON.parse(body) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

// ─── Helper: send JSON response ─────────────────────────────────────────────

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

// ─── Create HTTP server and Socket.IO ────────────────────────────────────────

const httpServer = createServer()

const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ─── REST API via engine.io middleware ───────────────────────────────────────
// This middleware intercepts REST endpoint requests BEFORE socket.io processes
// them. If we handle a request, we don't call next(), preventing socket.io
// from trying to interpret it as a transport request.

// Store body data for POST requests since engine.io middleware consumes the stream
const REST_ROUTES = new Set(['/health', '/notify/new', '/notify/update'])

io.engine.use((req: any, res: any, next: any) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`)
  const pathname = url.pathname

  // Only intercept known REST routes
  if (!REST_ROUTES.has(pathname)) {
    return next()
  }

  // Health check - synchronous, no body needed
  if (pathname === '/health' && req.method === 'GET') {
    sendJson(res, 200, {
      status: 'ok',
      service: 'approval-ws',
      port: PORT,
      connectedClients: connectedClients.size,
      subscribedClients: Array.from(connectedClients.values()).filter((c) => c.subscribed).length,
      pendingApprovals: pendingApprovals.size,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    })
    return // Don't call next() - we handled this request
  }

  // POST endpoints need body parsing - handle asynchronously
  if ((pathname === '/notify/new' || pathname === '/notify/update') && req.method === 'POST') {
    parseBody(req as IncomingMessage)
      .then((body) => {
        if (pathname === '/notify/new') {
          return handleNotifyNew(body, res as ServerResponse)
        } else {
          return handleNotifyUpdate(body, res as ServerResponse)
        }
      })
      .catch((err) => {
        console.error('[ERROR] Request handling error:', err)
        if (!(res as ServerResponse).headersSent) {
          sendJson(res as ServerResponse, 500, { error: 'Internal server error' })
        }
      })
    return // Don't call next() - we'll handle this asynchronously
  }

  // Method not allowed for REST routes
  sendJson(res, 405, { error: 'Method not allowed' })
})

// ─── REST endpoint handlers ─────────────────────────────────────────────────

function handleNotifyNew(body: any, res: ServerResponse) {
  const { requestId, agentRole, toolName, requestedAction, agentContext } = body

  if (!requestId || !agentRole || !toolName) {
    sendJson(res, 400, { error: 'Missing required fields: requestId, agentRole, toolName' })
    return
  }

  const approvalRequest: ApprovalRequest = {
    requestId,
    agentRole,
    toolName,
    requestedAction: requestedAction || '',
    agentContext: agentContext || '',
    createdAt: new Date().toISOString(),
  }

  // Track pending approval for reminders
  pendingApprovals.set(requestId, {
    request: approvalRequest,
    createdAt: Date.now(),
  })

  // Broadcast to all subscribed clients
  io.emit('approval:new', approvalRequest)

  const subscribedCount = Array.from(connectedClients.values()).filter((c) => c.subscribed).length
  console.log(`[NOTIFY] New approval request broadcast: ${requestId} (${subscribedCount} subscribers)`)

  sendJson(res, 200, {
    success: true,
    broadcastTo: subscribedCount,
    approvalRequest,
  })
}

function handleNotifyUpdate(body: any, res: ServerResponse) {
  const { requestId, status, humanReviewerId, reviewNotes } = body

  if (!requestId || !status) {
    sendJson(res, 400, { error: 'Missing required fields: requestId, status' })
    return
  }

  const validStatuses = ['approved', 'denied', 'pending']
  if (!validStatuses.includes(status)) {
    sendJson(res, 400, { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` })
    return
  }

  const approvalUpdate: ApprovalUpdate = {
    requestId,
    status,
    humanReviewerId: humanReviewerId || undefined,
    reviewNotes: reviewNotes || undefined,
    updatedAt: new Date().toISOString(),
  }

  // Remove from pending if approved or denied
  if (status === 'approved' || status === 'denied') {
    pendingApprovals.delete(requestId)
  }

  // Broadcast to all subscribed clients
  io.emit('approval:updated', approvalUpdate)

  const subscribedCount = Array.from(connectedClients.values()).filter((c) => c.subscribed).length
  console.log(`[NOTIFY] Approval update broadcast: ${requestId} → ${status} (${subscribedCount} subscribers)`)

  sendJson(res, 200, {
    success: true,
    broadcastTo: subscribedCount,
    approvalUpdate,
  })
}

// ─── WebSocket Connection Handling ──────────────────────────────────────────

io.on('connection', (socket: Socket) => {
  const clientInfo: ClientInfo = {
    id: socket.id,
    subscribed: false,
    connectedAt: new Date().toISOString(),
  }
  connectedClients.set(socket.id, clientInfo)

  console.log(`[CONNECT] Client connected: ${socket.id} (total: ${connectedClients.size})`)

  // Send welcome message with current state
  socket.emit('connected', {
    message: 'Connected to approval notification service',
    clientId: socket.id,
    pendingApprovals: pendingApprovals.size,
    timestamp: new Date().toISOString(),
  })

  // ─── Subscribe to approval updates ──────────────────────────────────────

  socket.on('subscribe:approvals', () => {
    clientInfo.subscribed = true
    connectedClients.set(socket.id, clientInfo)

    const subscribedCount = Array.from(connectedClients.values()).filter((c) => c.subscribed).length
    console.log(`[SUBSCRIBE] Client ${socket.id} subscribed to approvals (subscribers: ${subscribedCount})`)

    // Send current pending approvals to the newly subscribed client
    const pendingList = Array.from(pendingApprovals.values()).map((p) => p.request)
    socket.emit('subscription:confirmed', {
      subscribed: true,
      pendingApprovals: pendingList,
      timestamp: new Date().toISOString(),
    })
  })

  // ─── Unsubscribe from approval updates ──────────────────────────────────

  socket.on('unsubscribe:approvals', () => {
    clientInfo.subscribed = false
    connectedClients.set(socket.id, clientInfo)

    console.log(`[UNSUBSCRIBE] Client ${socket.id} unsubscribed from approvals`)

    socket.emit('subscription:confirmed', {
      subscribed: false,
      pendingApprovals: [],
      timestamp: new Date().toISOString(),
    })
  })

  // ─── Disconnect ──────────────────────────────────────────────────────────

  socket.on('disconnect', (reason) => {
    connectedClients.delete(socket.id)
    console.log(`[DISCONNECT] Client disconnected: ${socket.id} (reason: ${reason}, total: ${connectedClients.size})`)
  })

  // ─── Error handling ──────────────────────────────────────────────────────

  socket.on('error', (error) => {
    console.error(`[ERROR] Socket error (${socket.id}):`, error)
  })
})

// ─── Reminder Interval: check for pending approvals > 5 minutes ─────────────

const REMINDER_INTERVAL_MS = 60_000 // Check every 1 minute
const PENDING_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

reminderInterval = setInterval(() => {
  if (pendingApprovals.size === 0) return

  const now = Date.now()
  const reminders: ApprovalRequest[] = []

  for (const [requestId, data] of pendingApprovals.entries()) {
    const pendingDuration = now - data.createdAt
    if (pendingDuration > PENDING_THRESHOLD_MS) {
      reminders.push(data.request)
    }
  }

  if (reminders.length > 0) {
    const subscribedCount = Array.from(connectedClients.values()).filter((c) => c.subscribed).length
    if (subscribedCount > 0) {
      io.emit('approval:reminder', {
        reminders,
        count: reminders.length,
        timestamp: new Date().toISOString(),
      })
      console.log(`[REMINDER] Sent ${reminders.length} pending approval reminder(s) to ${subscribedCount} subscriber(s)`)
    }
  }
}, REMINDER_INTERVAL_MS)

// ─── Server Start ───────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`[START] Approval WebSocket service running on port ${PORT}`)
  console.log(`[START] Health check: http://localhost:${PORT}/health`)
  console.log(`[START] Notify new: POST http://localhost:${PORT}/notify/new`)
  console.log(`[START] Notify update: POST http://localhost:${PORT}/notify/update`)
})

// ─── Graceful Shutdown ──────────────────────────────────────────────────────

function shutdown(signal: string) {
  console.log(`[SHUTDOWN] Received ${signal}, shutting down...`)

  if (reminderInterval) {
    clearInterval(reminderInterval)
  }

  io.disconnectSockets(true)

  httpServer.close(() => {
    console.log('[SHUTDOWN] Server closed')
    process.exit(0)
  })

  // Force exit after 5 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('[SHUTDOWN] Forced exit after timeout')
    process.exit(1)
  }, 5000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
