import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { Low, JSONFile } from 'lowdb'
import { nanoid } from 'nanoid'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

dotenv.config()

const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret'
const DB_FILE = process.env.DB_FILE || './data/db.json'

// Setup DB
const adapter = new JSONFile(DB_FILE)
const db = new Low(adapter)
await db.read()

// Initialize default data
db.data = db.data || { users: [], orders: [], workflows: [] }
await db.write()

const app = express()
app.use(cors())
app.use(express.json())

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
app.post('/api/auth/login', async (req, res) => {
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

// Get workflows (public)
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

// Purchase workflow (protected)
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
registerAdminRoutes(app, db)

// Static serve (optional) - serve frontend build if exists
import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const frontendBuild = path.join(__dirname, '..', 'frontend', 'dist')

app.use('/static', express.static(frontendBuild))

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`)
})
