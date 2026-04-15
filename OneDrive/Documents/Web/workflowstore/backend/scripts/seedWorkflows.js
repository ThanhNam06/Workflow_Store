import fs from 'fs'
import path from 'path'

const frontendWorkflowsPath = path.resolve('../frontend/src/app/data/workflows.ts')
const dbPath = path.resolve('./data/db.json')

function extractJsonFromTs(tsContent) {
  const marker = 'export const workflows'
  const idx = tsContent.indexOf(marker)
  if (idx === -1) throw new Error('workflows export not found')
  const start = tsContent.indexOf('[', idx)
  const end = tsContent.lastIndexOf(']')
  const arrayText = tsContent.slice(start, end + 1)
  const cleaned = arrayText.replace(/\/\/.*$/gm, '')
  return cleaned
}

const ts = fs.readFileSync(frontendWorkflowsPath, 'utf-8')
const jsonText = extractJsonFromTs(ts)
const js = 'const data = ' + jsonText + '; data'

const workflows = Function(js)()

const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'))

for (const wf of workflows) {
  if (!db.workflows.find(w => w.id === wf.id)) {
    db.workflows.push(wf)
  }
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2))
console.log('Seeded', workflows.length, 'workflows')
