import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { Low, JSONFile } from 'lowdb'
import { nanoid } from 'nanoid'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import geoip from 'geoip-lite'
import paypal from '@paypal/checkout-server-sdk'
import path from 'path'
import fs from 'fs'
import rateLimit from 'express-rate-limit'
import { fileURLToPath } from 'url'

dotenv.config()

const PORT = process.env.PORT || 3001
const JWT_SECRET=process.env.JWT_SECRET || 'dev_secret'
const DB_FILE = process.env.DB_FILE || './data/db.json'
const ADMIN_API_KEY=process.env.ADMIN_API_KEY || ''
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || ''
const PAYPAL_SECRET_KEY = process.env.PAYPAL_SECRET_KEY || ''
const VIETQR_WEBHOOK_SECRET=process.env.VIETQR_WEBHOOK_SECRET || ''
const RESEND_API_KEY=process.env.RESEND_API_KEY || ''

let paypalClient = null
if (PAYPAL_CLIENT_ID && PAYPAL_SECRET_KEY) {
  const environment = new paypal.core.SandboxEnvironment(PAYPAL_CLIENT_ID, PAYPAL_SECRET_KEY)
  // For production use LiveEnvironment
  paypalClient = new paypal.core.PayPalHttpClient(environment)
}


// Setup DB
const adapter = new JSONFile(DB_FILE)
const db = new Low(adapter)
await db.read()

// Initialize default data
db.data = db.data || { users: [], orders: [], workflows: [], downloadTokens: [] }
await db.write()

const app = express()
app.use(cors())
// Keep raw body available for webhooks by capturing it in `req.rawBody`.
import { blocklistMiddleware, addToBlocklist } from './security.js'
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf } }))
// Blocklisted IPs middleware
app.use(blocklistMiddleware)

// Rate limiting
const downloadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // limit each IP to 100 download requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: 'Too many download requests, try later' })
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit login attempts
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: 'Too many requests, slow down' })
})

const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: 'Too many admin requests' })
})

// NOTE: static /downloads route removed to prevent direct file access. Use /api/download/:token instead.
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Secure download endpoint using signed short-lived tokens
import { verifyAndConsumeToken } from './downloads.js'
app.get('/api/download/:token', downloadLimiter, async (req, res) => {
  const { token } = req.params
  const result = await verifyAndConsumeToken(db, token)
  if (!result.ok) return res.status(404).send('Invalid or expired download link')
  const filename = result.filename
  const filePath = path.join(__dirname, '..', 'data', 'workflows', filename)
  if (!fs.existsSync(filePath)) return res.status(404).send('File not found')
  // Basic abuse detection: if remaining close to 0 and many attempts from same IP, consider blocking
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress || req.ip
  if (result.remaining <= 0) {
    // if the token is exhausted, record IP for review / optional block
    addToBlocklist(ip)
    console.warn('Token exhausted, blocking IP:', ip)
  }
  // set headers for download
  res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filename)}"`)
  res.setHeader('Content-Type', 'application/octet-stream')
  const stream = fs.createReadStream(filePath)
  stream.pipe(res)
})

// Helper: auth middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Missing token' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = payload
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// Locale detection via GeoIP
app.get('/api/locale', (req, res) => {
  // Allow override for testing: ?ip=1.2.3.4
  const testIp = req.query.ip
  let ip = testIp || req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress || req.ip
  // strip IPv6 prefix
  if (ip && ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '')
  // Local dev fallback
  if (!ip || ip === '::1' || ip === '127.0.0.1') ip = req.query.ip || '8.8.8.8'
  const geo = geoip.lookup(ip) || { country: 'US' }
  const country = geo.country || 'US'
  const isVN = country === 'VN'
  res.json({ country, isVN, currency: isVN ? 'vnd' : 'usd' })
})

// Auth: register
app.post('/api/auth/register', async (req, res) => {
  const { email, name, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' })
  await db.read()
  const existing = db.data.users.find(u => u.email === email)
  if (existing) return res.status(409).json({ error: 'User exists' })
  const hashed = await bcrypt.hash(password, 10)
  const user = { id: nanoid(), email, name: name || '', password: hashed, createdAt: new Date().toISOString() }
  db.data.users.push(user)
  await db.write()
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } })
})

// Auth: login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' })
  await db.read()
  const user = db.data.users.find(u => u.email === email)
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })
  const ok = await bcrypt.compare(password, user.password)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } })
})

// Public: Get workflows
app.get('/api/workflows', async (req, res) => {
  await db.read()
  res.json(db.data.workflows || [])
})

// Get single workflow
app.get('/api/workflows/:id', async (req, res) => {
  const { id } = req.params
  await db.read()
  const wf = db.data.workflows.find(w => w.id === id)
  if (!wf) return res.status(404).json({ error: 'Not found' })
  res.json(wf)
})

// Create an order (public) - returns orderId and accessToken
app.post('/api/orders', async (req, res) => {
  const { items = [], currency } = req.body
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Invalid items' })
  await db.read()

  // Calculate totals
  let totalUsd = 0
  let totalVnd = 0
  const enrichedItems = items.map(it => {
    const wf = db.data.workflows.find(w => w.id === it.workflowId)
    const qty = it.quantity ? Number(it.quantity) : 1
    const priceUsd = wf ? Number(wf.price_usd || wf.price || 0) : 0
    const priceVnd = wf ? Number(wf.price_vnd || Math.round(priceUsd * 24000)) : 0
    totalUsd += priceUsd * qty
    totalVnd += priceVnd * qty
    return { workflowId: it.workflowId, qty, priceUsd, priceVnd, title: wf ? wf.title : '' }
  })

  const orderCurrency = currency || (req.body.forceCurrency) || (req.body.locale === 'vnd' ? 'vnd' : 'usd')
  const amount = orderCurrency === 'vnd' ? totalVnd : Math.round(totalUsd * 100) // for usd we store cents
  // Attach user info if Authorization header present
  let userId = null
  let userEmail = null
  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if (token) {
      const payload = jwt.verify(token, JWT_SECRET)
      userId = payload.id
      await db.read()
      const u = db.data.users.find(x => x.id === userId)
      if (u) userEmail = u.email
    }
  } catch (e) {
    // ignore token errors; order will be created as guest
  }

  const order = {
    id: nanoid(),
    items: enrichedItems,
    amount: amount,
    currency: orderCurrency,
    status: 'pending',
    paymentProvider: null,
    providerReference: null,
    accessToken: nanoid(16),
    userId: userId,
    email: userEmail,
    createdAt: new Date().toISOString()
  }
  db.data.orders.push(order)
  await db.write()
  res.json({ orderId: order.id, accessToken: order.accessToken, amount: order.amount, currency: order.currency })
})

// Create PayPal order for an existing order
app.post('/api/create-paypal-order', async (req, res) => {
  if (!paypalClient) return res.status(500).json({ error: 'PayPal not configured' })
  const { orderId, returnUrl, cancelUrl } = req.body
  if (!orderId) return res.status(400).json({ error: 'Missing orderId' })
  await db.read()
  const order = db.data.orders.find(o => o.id === orderId)
  if (!order) return res.status(404).json({ error: 'Order not found' })
  if (order.currency !== 'usd') return res.status(400).json({ error: 'PayPal payments only supported for USD orders' })

  // Build purchase units
  const purchase_units = [{
    reference_id: order.id,
    amount: {
      currency_code: 'USD',
      value: (order.amount / 100).toFixed(2) // amount stored in cents
    },
    description: `Purchase from WorkflowStore - Order ${order.id}`
  }]

  const request = new paypal.orders.OrdersCreateRequest()
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units,
    application_context: {
      return_url: returnUrl || `${process.env.APP_BASE_URL}/payment-success`,
      cancel_url: cancelUrl || `${process.env.APP_BASE_URL}/payment-cancel`
    }
  })

  try {
    const response = await paypalClient.execute(request)
    // Mark order as awaiting payment via paypal
    order.paymentProvider = 'paypal'
    order.providerReference = response.result.id
    await db.write()

    // send approval link back to frontend
    const approvalUrl = response.result.links.find(l => l.rel === 'approve')?.href
    res.json({ url: approvalUrl, id: response.result.id })
  } catch (err) {
    console.error('PayPal create order failed', err)
    res.status(500).json({ error: 'PayPal create order failed' })
  }
})

// Capture PayPal order (server-side capture). Frontend should call this after approval or you can rely on webhook.
app.post('/api/capture-paypal-order', async (req, res) => {
  if (!paypalClient) return res.status(500).json({ error: 'PayPal not configured' })
  const { paypalOrderId } = req.body
  if (!paypalOrderId) return res.status(400).json({ error: 'Missing paypalOrderId' })

  try {
    const captureRequest = new paypal.orders.OrdersCaptureRequest(paypalOrderId)
    captureRequest.requestBody({})
    const captureResponse = await paypalClient.execute(captureRequest)

    // Attempt to find matching order by providerReference or by purchase_unit reference_id
    await db.read()
    let order = db.data.orders.find(o => o.providerReference === paypalOrderId)
    if (!order) {
      const ref = captureResponse.result.purchase_units?.[0]?.reference_id
      if (ref) order = db.data.orders.find(o => o.id === ref)
    }

    if (!order) {
      // Still create a log and return success - but warn
      console.warn('capture-paypal-order: matching local order not found for', paypalOrderId)
      return res.status(404).json({ error: 'Local order not found' })
    }

    order.status = 'paid'
    order.paidAt = new Date().toISOString()
    order.paymentProvider = 'paypal'
    order.providerReference = paypalOrderId
    order.paypalCapture = captureResponse.result
    await db.write()

    try { await sendOrderPaidEmailFromModule(db, order) } catch (e) { console.error('sendOrderPaidEmail failed', e) }
    console.log('Order captured and marked paid via PayPal capture:', order.id)
    return res.json({ success: true, orderId: order.id })
  } catch (err) {
    console.error('PayPal capture failed', err)
    return res.status(500).json({ error: 'PayPal capture failed' })
  }
})

// PayPal webhook endpoint
app.post('/api/webhooks/paypal', async (req, res) => {
  // PayPal sends events for order captures. We'll accept a simple flow where providerReference is the PayPal order id.
  // For higher security, implement PayPal webhook signature verification. For now, require orderId in body.
  const { resource_type, event_type, resource } = req.body || {}
  // We expect event_type 'CHECKOUT.ORDER.APPROVED' or 'PAYMENT.CAPTURE.COMPLETED' or similar.
  const providerOrderId = resource?.id || req.body?.orderId || req.body?.id
  if (!providerOrderId) return res.status(400).json({ error: 'Missing provider order id' })

  await db.read()
  // Find order by providerReference or by matching reference_id in purchase_units
  let order = db.data.orders.find(o => o.providerReference === providerOrderId)
  if (!order) {
    // try to match by nested purchase_units reference_id
    const ref = resource?.purchase_units?.[0]?.reference_id || resource?.purchase_units?.[0]?.reference_id
    if (ref) order = db.data.orders.find(o => o.id === ref)
  }

  if (!order) return res.status(404).json({ error: 'Order not found' })

  // Mark as paid and capture time
  order.status = 'paid'
  order.paidAt = new Date().toISOString()
  order.paymentProvider = 'paypal'
  order.providerReference = providerOrderId
  await db.write()
  try { await sendOrderPaidEmailFromModule(db, order) } catch (e) { console.error('sendOrderPaidEmail failed', e) }
  console.log('Order marked paid via PayPal webhook:', order.id)
  res.json({ success: true })
})

// VietQR webhook endpoint (SePay / Cassso) - provider should POST { orderId, status: 'paid', providerRef }
// Authentication: expects header Authorization: Apikey <secret>
app.post('/api/webhooks/vietqr', async (req, res) => {
  // Expect Authorization: Apikey <secret>
  const authHeader = req.headers['authorization'] || ''
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.toLowerCase().startsWith('apikey ')) {
    return res.status(401).json({ error: 'Unauthorized - missing Apikey authorization' })
  }
  const provided = authHeader.slice(authHeader.indexOf(' ') + 1).trim()
  if (VIETQR_WEBHOOK_SECRET && provided !== VIETQR_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { orderId, status, providerRef } = req.body
  if (!orderId) return res.status(400).json({ error: 'Missing orderId' })
  await db.read()
  const order = db.data.orders.find(o => o.id === orderId)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  if (status === 'paid') {
    order.status = 'paid'
    order.paidAt = new Date().toISOString()
    order.paymentProvider = 'vietqr'
    order.providerReference = providerRef || order.providerReference
    await db.write()
    try { await sendOrderPaidEmailFromModule(db, order) } catch (e) { console.error('sendOrderPaidEmail failed', e) }
    console.log('Order marked paid via VietQR webhook:', orderId)
    return res.json({ success: true })
  }

  // other statuses may be handled as needed
  res.json({ received: true })
})

// Get order (public if accessToken provided, or user auth/admin)
app.get('/api/orders/:id', async (req, res) => {
  const { id } = req.params
  const accessToken = req.query.accessToken || req.headers['x-access-token']
  await db.read()
  const order = db.data.orders.find(o => o.id === id)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  // admin override
  const adminKey = req.headers['x-admin-key'] || req.query.admin_key || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1])
  if (adminKey && adminKey === ADMIN_API_KEY) return res.json(order)

  // access by token
  if (accessToken && accessToken === order.accessToken) return res.json(order)

  // authenticated user
  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if (token) {
      const payload = jwt.verify(token, JWT_SECRET)
      if (order.userId && payload.id === order.userId) return res.json(order)
    }
  } catch (err) {
    // ignore
  }

  return res.status(403).json({ error: 'Forbidden' })
})

// Provide download URLs if order paid (token-based URLs)
app.get('/api/orders/:id/downloads', async (req, res) => {
  const { id } = req.params
  const accessToken = req.query.accessToken || req.headers['x-access-token']
  await db.read()
  const order = db.data.orders.find(o => o.id === id)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  // auth: admin || accessToken || authenticated user
  const adminKey = req.headers['x-admin-key'] || req.query.admin_key || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1])
  let authed = false
  if (adminKey && adminKey === ADMIN_API_KEY) authed = true
  if (accessToken && accessToken === order.accessToken) authed = true
  if (!authed) {
    try {
      const authHeader = req.headers['authorization']
      const token = authHeader && authHeader.split(' ')[1]
      if (token) {
        const payload = jwt.verify(token, JWT_SECRET)
        if (order.userId && payload.id === order.userId) authed = true
      }
    } catch (e) { /* ignore */ }
  }
  if (!authed) return res.status(403).json({ error: 'Forbidden' })

  if (order.status !== 'paid') return res.status(402).json({ error: 'Payment not completed' })

  // reuse existing tokens if present, otherwise create new tokens per item
  const existing = await getTokensForOrder(db, order.id) // [{ token, filename, remaining, expiresAt }]
  const tokenMap = new Map()
  for (const t of existing) tokenMap.set(t.filename, t)

  const downloads = []
  for (const it of order.items) {
    const wf = db.data.workflows.find(w => w.id === it.workflowId)
    if (!wf) continue
    const filename = path.basename(wf.file_path || `${wf.id}.zip`)
    let tokenRec = tokenMap.get(filename)
    let token
    if (tokenRec) token = tokenRec.token
    else token = await createDownloadToken(db, filename, order.id, 3, 24*3600)
    const url = `${process.env.APP_BASE_URL || `http://localhost:${PORT}`}/api/download/${token}`
    downloads.push({ workflowId: wf.id, title: wf.title, filename, url })
  }

  res.json({ downloads })
})

// Purchase workflow (protected) - legacy
app.post('/api/purchase', authMiddleware, async (req, res) => {
  const { workflowId } = req.body
  if (!workflowId) return res.status(400).json({ error: 'Missing workflowId' })
  await db.read()
  const wf = db.data.workflows.find(w => w.id === workflowId)
  if (!wf) return res.status(404).json({ error: 'Workflow not found' })
  const order = { id: nanoid(), userId: req.user.id, workflowId, createdAt: new Date().toISOString(), status: 'pending' }
  db.data.orders.push(order)
  await db.write()
  res.json({ success: true, order })
})

// Admin routes (in separate module)
import registerAdminRoutes from './admin_routes.js'
// mount admin routes with admin rate limiter
app.use('/api/admin', adminLimiter)
registerAdminRoutes(app, db)
import registerUserRoutes from './user_routes.js'
registerUserRoutes(app, db)
import { startMaintenanceLoop } from './maintenance.js'
// Start background maintenance loop (cleans expired/exhausted tokens every hour)
startMaintenanceLoop(db)

// Send email via Resend when order becomes paid
import { createDownloadToken, getTokensForOrder } from './downloads.js'
import { sendOrderPaidEmail as sendOrderPaidEmailFromModule } from './email.js'

// Initialize resend client dynamically to handle different export shapes
let resendClient = null
if (RESEND_API_KEY) {
  try {
    const rmod = await import('resend')
    const ResendCtor = (rmod && (rmod.default || rmod.Resend || rmod))
    if (typeof ResendCtor === 'function') {
      resendClient = new ResendCtor(RESEND_API_KEY)
    } else {
      console.warn('Resend module loaded but constructor not found; send emails disabled')
    }
  } catch (err) {
    console.warn('Failed to import Resend module; emails disabled', err)
  }
}

async function sendOrderPaidEmail(order) {
  if (!resendClient) {
    console.warn('Resend not configured, skipping email')
    return
  }
  // gather recipient from order metadata or user (best-effort)
  let to = order.email || (order.userId ? (() => {
    const u = db.data.users.find(x => x.id === order.userId)
    return u ? u.email : null
  })() : null)
  if (!to) {
    console.warn('No email available for order', order.id)
    return
  }

  // prepare download tokens for each item
  const attachments = []
  const downloads = []
  for (const it of order.items) {
    const wf = db.data.workflows.find(w => w.id === it.workflowId)
    if (!wf) continue
    const filename = path.basename(wf.file_path || `${wf.id}.zip`)
    const token = await createDownloadToken(db, filename, order.id, 3, 24*3600)
    const downloadUrl = `${process.env.APP_BASE_URL || `http://localhost:${PORT}`}/api/download/${token}`
    downloads.push({ title: wf.title, url: downloadUrl })
  }

  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; color: #111;">
        <h2>Thank you for your purchase</h2>
        <p>Order ID: ${order.id}</p>
        <p>We've attached download links for the workflows you purchased below. Links expire in 24 hours and are limited to 3 downloads each.</p>
        <ul>
          ${downloads.map(d => `<li><strong>${d.title}</strong>: <a href="${d.url}">${d.url}</a></li>`).join('')}
        </ul>
        <hr />
        <h3>Usage Instructions</h3>
        <p>Each workflow comes with a README inside the archive. Unzip the download and follow the included setup instructions. If you need help, reply to this email and we'll assist.</p>
        <p>Thanks,<br/>WorkflowStore Team</p>
      </body>
    </html>`

  try {
    await resendClient.emails.send({
      from: 'no-reply@workflowstore.local',
      to,
      subject: 'Your WorkflowStore purchase  downloads inside',
      html
    })
    console.log('Sent purchase email to', to)
  } catch (err) {
    console.error('Failed to send email via Resend', err)
  }
}

// Static serve (optional) - serve frontend build if exists
const frontendBuild = path.join(__dirname, '..', 'frontend', 'dist')
app.use('/static', express.static(frontendBuild))

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`)
})
