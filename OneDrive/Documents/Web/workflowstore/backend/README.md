Workflowstore backend

How to run

1. Install dependencies:
   cd backend
   npm install

2. Start server in dev:
   npm run dev

3. Seed demo workflows (optional):
   POST /api/admin/workflows with JSON body of a workflow (see frontend src/app/data/workflows.ts)

Notes
- Uses lowdb (JSON file storage) for simplicity; good for local dev.
- JWT secret is in .env — change it for production.
