import { cleanupExpiredTokens } from './downloads.js'

export function startMaintenanceLoop(db) {
  // Run cleanup once at startup
  try { cleanupExpiredTokens(db).catch(e => console.warn('cleanupExpiredTokens failed', e)) } catch(e) {}
  // then schedule every hour
  setInterval(() => {
    try { cleanupExpiredTokens(db).catch(e => console.warn('cleanupExpiredTokens failed', e)) } catch(e) {}
  }, 60 * 60 * 1000)
}
