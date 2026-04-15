export default function registerAdminRoutes(app, db){
  const adminAuth = (req, res, next) => {
    const key = req.headers['x-admin-key'] || req.query.admin_key || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1])
    const ADMIN_API_KEY = process.env.ADMIN_API_KEY
    if (!ADMIN_API_KEY) return res.status(500).json({ error: 'Admin key not configured' })
    if (!key || key !== ADMIN_API_KEY) return res.status(401).json({ error: 'Unauthorized' })
    next()
  }

  app.post('/api/admin/workflows', adminAuth, async (req, res) => {
    const wf = req.body
    if (!wf || !wf.id) return res.status(400).json({ error: 'Invalid workflow' })
    await db.read()
    const normalized = {
      id: wf.id,
      name: wf.name || wf.title || wf.id,
      desc: wf.desc || wf.description || '',
      price_vnd: wf.price_vnd || wf.price || 0,
      price_usd: wf.price_usd || 0,
      category: wf.category || 'uncategorized',
      thumbnail: wf.thumbnail || wf.image || '',
      instructions: wf.instructions || '',
      file_path: wf.file_path || '',
      createdAt: new Date().toISOString()
    }
    db.data.workflows.push(normalized)
    await db.write()
    res.json({ success: true, workflow: normalized })
  })

  app.put('/api/admin/workflows/:id', adminAuth, async (req, res) => {
    const { id } = req.params
    const updates = req.body
    await db.read()
    const idx = db.data.workflows.findIndex(w => w.id === id)
    if (idx === -1) return res.status(404).json({ error: 'Not found' })
    const existing = db.data.workflows[idx]
    const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() }
    db.data.workflows[idx] = merged
    await db.write()
    res.json({ success: true, workflow: merged })
  })

  app.delete('/api/admin/workflows/:id', adminAuth, async (req, res) => {
    const { id } = req.params
    await db.read()
    const idx = db.data.workflows.findIndex(w => w.id === id)
    if (idx === -1) return res.status(404).json({ error: 'Not found' })
    const removed = db.data.workflows.splice(idx, 1)
    await db.write()
    res.json({ success: true, removed })
  })
}
