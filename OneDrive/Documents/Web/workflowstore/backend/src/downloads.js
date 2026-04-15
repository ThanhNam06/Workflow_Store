import { nanoid } from 'nanoid'
import fs from 'fs'

// downloads utilities: createDownloadToken, verifyAndConsumeToken, getTokensForOrder
// Stored inside lowdb file under data.downloadTokens as objects: { token, filename, orderId, remaining, createdAt, expiresAt }

export async function createDownloadToken(db, filename, orderId, maxDownloads = 3, ttl = 24*3600) {
  await db.read()
  const token = nanoid(24)
  const rec = { token, filename, orderId, remaining: maxDownloads, createdAt: Date.now(), expiresAt: Date.now() + ttl*1000 }
  db.data.downloadTokens = db.data.downloadTokens || []
  db.data.downloadTokens.push(rec)
  await db.write()
  return token
}

export async function getTokensForOrder(db, orderId) {
  await db.read()
  return (db.data.downloadTokens || []).filter(t => t.orderId === orderId)
}

export async function verifyAndConsumeToken(db, token) {
  await db.read()
  const idx = (db.data.downloadTokens || []).findIndex(t => t.token === token)
  if (idx === -1) return { ok: false }
  const rec = db.data.downloadTokens[idx]
  const now = Date.now()
  if (rec.expiresAt && now > rec.expiresAt) {
    // remove
    db.data.downloadTokens.splice(idx, 1)
    await db.write()
    return { ok: false }
  }
  if (rec.remaining <= 0) {
    // remove
    db.data.downloadTokens.splice(idx, 1)
    await db.write()
    return { ok: false }
  }
  // consume one
  rec.remaining = rec.remaining - 1
  if (rec.remaining <= 0) {
    // keep for a short time or remove immediately
    db.data.downloadTokens.splice(idx, 1)
  } else {
    db.data.downloadTokens[idx] = rec
  }
  await db.write()
  return { ok: true, filename: rec.filename, remaining: rec.remaining }
}

export async function cleanupExpiredTokens(db) {
  await db.read()
  const now = Date.now()
  db.data.downloadTokens = (db.data.downloadTokens || []).filter(t => !(t.expiresAt && now > t.expiresAt) && t.remaining > 0)
  await db.write()
}
