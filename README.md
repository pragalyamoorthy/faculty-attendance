# Faculty Attendance

A small faculty attendance demo built with HTML, CSS, JavaScript, Express, and SQLite.

## Run the app

1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Run `npm start`.
4. Open [http://localhost:3000](http://localhost:3000).

The project includes a sample SQLite database at `data/faculty-attendance.sqlite` and its repeatable sample-data script at `data/demo-seed.sql`. It includes 18 sample faculty members and two weeks of varied attendance records. The database is created automatically if it is missing; to load or refresh the included examples in an existing database, run `node -e "require('better-sqlite3')('data/faculty-attendance.sqlite').exec(require('fs').readFileSync('data/demo-seed.sql','utf8'))"`. In demo mode, enter any non-empty username and password. The login creates an administrator session; faculty, attendance, reports, and CSV export continue to use the SQLite database.

On Windows, after dependencies are installed, you can also start the app by double-clicking `start-demo.bat`. It uses Node.js from PATH or the per-user Node.js runtime at `%LOCALAPPDATA%\faculty-demo-node\node-v22.23.3-win-x64`.

## How to turn off demo mode

Set `DEMO_MODE=false` in `.env` and restart the server. Normal login then checks the `users` table and compares the submitted password using bcrypt.

To provision an administrator for normal mode, set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env` before the first startup. The server stores a bcrypt hash in SQLite and only creates that account if the username does not already exist. Keep `.env` private and set a strong `SESSION_SECRET` when deploying.

## Pages

- `login.html` — login form
- `admin-dashboard.html` — admin overview
- `faculty.html` — add, edit, and delete faculty
- `attendance.html` — mark and update attendance
- `reports.html` — monthly totals and CSV download
