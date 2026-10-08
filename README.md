# Resolve

Resolve is an AI-assisted IT help desk built with React/Vite, Express, Prisma, and SQLite.
Employees submit tickets; technicians get a category, priority, summary, and recommended next action from OpenAI or local keyword triage.

The first workflow upgrade adds assigned technicians, manual priority changes, New / In Progress / Waiting / Resolved states, replies, team notes, and a persistent activity history. Knowledge-base articles and helpful counts now live in the database and are shared across browsers connected to the same server.

## Start on Windows

Use Node.js 20.19+ on the 20.x line, or 22.12+.
Open PowerShell in the project folder:

```powershell
npm.cmd ci
npm.cmd run install:all
npm.cmd run dev
```

Open <http://localhost:5173>. The API runs on port 3001.
`npm run dev` prepares the database automatically. A local database URL is supplied when no `.env` file is present. Port 5173 is fixed; stop another process using it before launching Resolve.

## Update an existing installation

Stop Resolve with **Ctrl+C**, keep your existing `server/.env` and SQLite database, and update the source from the upgrade branch. Run the same commands above.
The additive SQLite setup preserves existing ticket IDs, descriptions, requester names, priorities, and timestamps. Previous **Open** tickets become **New**. Existing tickets get one clearly labeled import event; older conversations and resolution timestamps are not fabricated.

Browser-saved articles are imported automatically when you open the app at the same browser address used previously. The old browser copy is retained as a backup after a successful import. Personal display, compact-view, and alert preferences remain local to each browser until user accounts are added.

`npm.cmd run db:setup` can also be run separately. Repeating it preserves edits and keeps deleted starter articles deleted. Do not use database-reset or data-loss flags to perform this upgrade.

## Enable OpenAI triage

If `server/.env` does not exist, copy `server/.env.example` to `server/.env`. Keep an existing `.env` file.
Add your API key on the server:

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY="your_api_key_here"
OPENAI_MODEL="gpt-4o-mini"
```

Restart Resolve after changing the file. API keys stay on the server and must never be committed.
With no key, Resolve uses local fallback. Failed or timed-out OpenAI requests fall back automatically.
“OpenAI configured” indicates a key is present; it does not certify service availability.

## Validation

```powershell
npm.cmd test
npm.cmd run build
```

Tests use disposable databases. They cover older four-ticket upgrades, repeated setup, assignment, status history, replies and notes, reopening, malformed requests, article import, feedback, deletion, and reconnect persistence.

See the [validation notes and screenshots](docs/phase1-validation.md).

## Scope

This version is a local support workspace. Technician assignment and activity author names are text labels. Replies and team notes are saved in the workspace. Login, enforced user roles, private notes, and message delivery are planned for the next phase.

## API routes

- `GET /api/health`, `GET /api/ai/status`
- `GET /api/tickets`, `GET /api/tickets/:id`, `POST /api/tickets`
- `PATCH /api/tickets/:id` — assignment, priority, status
- `PATCH /api/tickets/:id/status` — retained for older clients; accepts Open as New
- `POST /api/tickets/:id/comments`, `POST /api/tickets/:id/retriage`
- `GET /api/articles`, `POST /api/articles`, `POST /api/articles/import`
- `POST /api/articles/:id/helpful`, `DELETE /api/articles/:id`
