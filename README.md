# Faculty Attendance

A small faculty attendance demo built with HTML, CSS, and JavaScript, running on Netlify. The static pages live in `public/`, the API is a Netlify Function (`netlify/functions/api.mts`), and data is stored in Netlify Database (managed Postgres) through Drizzle ORM.

## Run locally

1. Install Node.js 18 or newer and the Netlify CLI.
2. Run `npm install`.
3. Run `npm run dev` (this runs `netlify dev`).

## Database

The schema is defined in `db/schema.ts`. Migrations live in `netlify/database/migrations/` and are applied automatically by Netlify on each deploy. After changing the schema, run `npx drizzle-kit generate --name <change_name>` to create a new migration.

The migrations include repeatable sample data: 19 sample faculty members and two weeks of varied attendance records ending on the day the migration was applied.

## Demo mode and sign-in

Set the `DEMO_MODE` environment variable to `true` (in the Netlify UI for deployed sites, or in `.env` for `netlify dev`) to let any non-empty username and password sign in as an administrator. Only enable this for demos — anyone who can reach the site gets full access.

With demo mode off, sign-in checks the `users` table using bcrypt. To provision an administrator, set `ADMIN_USERNAME` and `ADMIN_PASSWORD` as environment variables; the account is created with a hashed password the first time that username signs in, and is never overwritten afterwards.

Sessions are stored in the database and expire after eight hours.

## Pages

- `login.html` — login form
- `admin-dashboard.html` — admin overview
- `faculty.html` — add, edit, and delete faculty
- `attendance.html` — mark and update attendance
- `reports.html` — monthly totals and CSV download
