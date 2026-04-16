import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { nanoid } from 'nanoid'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default function registerAdminRoutes(app, db){
  // Ensure workflows storage dir exists
  const uploadsDir = path.join(__dirname, '..', 'data', 'workflows')
  fs.mkdirSync(uploadsDir, { recursive: true })

  // Multer storage config
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || ''
      const name = `${Date.now()}-${nanoid(8)}${ext}`
      cb(null, name)
    }
  })
  const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } }) // 200MB limit

  // Admin authentication middleware using ADMIN_API_KEY from environment
  const adminAuth = (req, res, next) => {
    const key = req.headers['x-admin-key'] || req.query.admin_key || (req.headers['authorization'] && req.headers['authorization'].startsWith('Bearer ') && req.headers['authorization'].split(' ')[1])
    const ADMIN_API_KEY = process.env.ADMIN_API_KEY || ''
    if (!ADMIN_API_KEY) return res.status(500).json({ error: 'Admin key not configured' })
    if (!key || key !== ADMIN_API_KEY) return res.status(401).json({ error: 'Unauthorized' })
    next()
  }

  // Create workflow (admin only) - supports multipart upload with file field 'file'
  app.post('/api/admin/workflows', adminAuth, upload.single('file'), async (req, res) => {
    // req.body contains form fields (strings). req.file contains uploaded file info.
    const wf = req.body || {}
    await db.read()

    const priceUsd = (typeof wf.price_usd !== 'undefined' ? Number(wf.price_usd) : (typeof wf.price !== 'undefined' ? Number(wf.price) : 0))
    const priceVnd = (typeof wf.price_vnd !== 'undefined' && wf.price_vnd !== '') ? Number(wf.price_vnd) : Math.round(priceUsd * 24000)

    const filename = req.file ? req.file.filename : (wf.file_path || '')

    const normalized = {
      id: wf.id || (wf.title ? String(wf.title).toLowerCase().replace(/[^a-z0-9]+/g,'-') : `wf-${Date.now()}`),
      title: wf.title || wf.name || wf.id || '',
      description: wf.description || wf.desc || '',
      price: (typeof wf.price !== 'undefined' ? Number(wf.price) : priceUsd),
      price_usd: priceUsd,
      price_vnd: priceVnd,
      category: wf.category || 'uncategorized',
      features: (wf.features && Array.isArray(wf.features)) ? wf.features : (wf.features ? [wf.features] : (wf.items || [])),
      image: wf.image || wf.thumbnail || '',
      instructions: wf.instructions || '',
      file_path: filename,
      complexity: wf.complexity || wf.level || 'beginner',
      estimatedTime: wf.estimatedTime || wf.estimated_time || '',
      createdAt: new Date().toISOString()
    }

    db.data.workflows.push(normalized)
    await db.write()
    res.json({ success: true, workflow: normalized })
  })

  // Update workflow (admin only)
  app.put('/api/admin/workflows/:id', adminAuth, async (req, res) => {
    const { id } = req.params
    const updates = req.body || {}
    await db.read()
    const idx = db.data.workflows.findIndex(w => w.id === id)
    if (idx === -1) return res.status(404).json({ error: 'Not found' })

    const existing = db.data.workflows[idx]
    const priceUsd = (typeof updates.price_usd !== 'undefined' ? Number(updates.price_usd) : (typeof updates.price !== 'undefined' ? Number(updates.price) : existing.price_usd || existing.price || 0))
    const priceVnd = (typeof updates.price_vnd !== 'undefined' && updates.price_vnd !== '') ? Number(updates.price_vnd) : (existing.price_vnd || Math.round(priceUsd * 24000))

    const merged = { 
      ...existing, 
      ...updates, 
      price_usd: priceUsd, 
      price_vnd: priceVnd, 
      updatedAt: new Date().toISOString() 
    }

    db.data.workflows[idx] = merged
    await db.write()
    res.json({ success: true, workflow: merged })
  })

  // Delete workflow (admin only)
  app.delete('/api/admin/workflows/:id', adminAuth, async (req, res) => {
    const { id } = req.params
    await db.read()
    const idx = db.data.workflows.findIndex(w => w.id === id)
    if (idx === -1) return res.status(404).json({ error: 'Not found' })

    // remove associated file if exists
    const removed = db.data.workflows.splice(idx, 1)
    try {
      const file = removed[0] && removed[0].file_path
      if (file) {
        const fp = path.join(__dirname, '..', 'data', 'workflows', path.basename(file))
        if (fs.existsSync(fp)) fs.unlinkSync(fp)
      }
    } catch (e) {
      console.warn('Failed to delete workflow file:', e.message)
    }

    await db.write()
    res.json({ success: true, removed })
  })

  // --- Admin: order management ---
  // List orders
  app.get('/api/admin/orders', adminAuth, async (req, res) => {
    await db.read()
    res.json(db.data.orders || [])
  })

  // Get single order
  app.get('/api/admin/orders/:id', adminAuth, async (req, res) => {
    const { id } = req.params
    await db.read()
    const order = db.data.orders.find(o => o.id === id)
    if (!order) return res.status(404).json({ error: 'Not found' })
    res.json(order)
  })

  // Mark order paid (admin)
  app.post('/api/admin/orders/:id/mark-paid', adminAuth, async (req, res) => {
    const { id } = req.params
    const { providerRef } = req.body || {}
    await db.read()
    const order = db.data.orders.find(o => o.id === id)
    if (!order) return res.status(404).json({ error: 'Not found' })
    order.status = 'paid'
    order.paidAt = new Date().toISOString()
    if (providerRef) order.providerReference = providerRef
    await db.write()
    // trigger email send (best-effort)
    try {
      const { sendOrderPaidEmail } = await import('./email.js')
      if (typeof sendOrderPaidEmail === 'function') await sendOrderPaidEmail(db, order)
    } catch (e) {
      console.error('admin mark-paid: sendOrderPaidEmail failed', e)
    }
    res.json({ success: true, order })
  })
}
