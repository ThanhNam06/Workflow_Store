// Simple blocklist middleware and helper
const blocklist = new Set()

export function blocklistMiddleware(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress || req.ip
  if (ip && blocklist.has(ip)) return res.status(403).json({ error: 'Forbidden' })
  next()
}

export function addToBlocklist(ip) {
  if (!ip) return
  blocklist.add(ip)
}

export function removeFromBlocklist(ip) {
  blocklist.delete(ip)
}
