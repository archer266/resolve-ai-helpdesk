# Resolve

Resolve is an AI-assisted IT help desk. Employees can create support tickets while technicians receive an automatically generated category, priority, summary, and recommended next action.

Version 0.3 includes a working command center, searchable knowledge base with locally saved custom articles, live analytics derived from ticket data, and persistent workspace settings.

## Stack

- React + Vite
- Node.js + Express
- SQLite + Prisma
- OpenAI Responses API with Structured Outputs

## Start the app on Windows

From the `resolve-app` folder:

```powershell
npm.cmd install
npm.cmd run install:all
Copy-Item .\server\.env.example .\server\.env
npm.cmd run db:setup
npm.cmd run dev
```

Open <http://localhost:5173>.

## Enable AI triage

Open `server/.env` and add an OpenAI API key:

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY="your_api_key_here"
OPENAI_MODEL="gpt-4o-mini"
```

Restart `npm.cmd run dev` after changing the file. Keep the API key in `server/.env`; never place it in the client folder or commit it to GitHub.

Without a key, Resolve stays fully usable and clearly labels triage as `Local fallback`.

## API routes

- `GET /api/health`
- `GET /api/tickets`
- `POST /api/tickets`
- `PATCH /api/tickets/:id/status`
- `POST /api/tickets/:id/retriage`
- `GET /api/ai/status`
