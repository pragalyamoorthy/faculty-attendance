import crypto from "node:crypto";
import type { Config, Context } from "@netlify/functions";
import bcrypt from "bcryptjs";
import { and, asc, eq, gt, like, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { attendance, faculty, sessions, users } from "../../db/schema.js";

const SESSION_COOKIE = "faculty.sid";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const STATUSES = ["present", "absent", "late"];

type SessionUser = { id: number | null; username: string; displayName: string; role: string };

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function isDemoMode() {
  return /^true$/i.test(Netlify.env.get("DEMO_MODE") || "false");
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function monthParam(url: URL) {
  const month = url.searchParams.get("month") || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, "Month must use YYYY-MM.");
  return month;
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

function isUniqueViolation(error: unknown) {
  const err = error as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

// Creates the administrator from ADMIN_USERNAME / ADMIN_PASSWORD the first time that username signs in.
async function ensureAdminAccount(username: string) {
  const adminUsername = Netlify.env.get("ADMIN_USERNAME");
  const adminPassword = Netlify.env.get("ADMIN_PASSWORD");
  if (!adminUsername || !adminPassword || username !== adminUsername) return;
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await db.insert(users)
    .values({ username: adminUsername, passwordHash, displayName: adminUsername, role: "admin" })
    .onConflictDoNothing({ target: users.username });
}

async function startSession(context: Context, req: Request, user: SessionUser) {
  const id = crypto.randomBytes(32).toString("hex");
  await db.insert(sessions).values({
    id,
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS)
  });
  context.cookies.set({
    name: SESSION_COOKIE,
    value: id,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: new URL(req.url).protocol === "https:",
    expires: new Date(Date.now() + SESSION_TTL_MS)
  });
}

async function currentUser(context: Context): Promise<SessionUser> {
  const id = context.cookies.get(SESSION_COOKIE);
  if (!id) throw new HttpError(401, "Please sign in to continue.");
  const [session] = await db.select().from(sessions)
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())));
  if (!session) throw new HttpError(401, "Please sign in to continue.");
  const user = {
    id: session.userId,
    username: session.username,
    displayName: session.displayName,
    role: session.role
  };
  return isDemoMode() ? { ...user, role: "admin" } : user;
}

async function requireAdmin(context: Context) {
  const user = await currentUser(context);
  if (user.role !== "admin") throw new HttpError(403, "Administrator access is required.");
  return user;
}

function facultyFields(body: Record<string, unknown>) {
  const { name, department, email } = body;
  if (![name, department, email].every((value) => typeof value === "string" && value.trim())) {
    throw new HttpError(400, "Name, department, and email are required.");
  }
  return {
    name: (name as string).trim(),
    department: (department as string).trim(),
    email: (email as string).trim()
  };
}

const facultyColumns = {
  id: faculty.id,
  name: faculty.name,
  department: faculty.department,
  email: faculty.email
};

function csvCell(value: unknown) {
  let safeValue = String(value == null ? "" : value);
  if (/^[=+\-@\t\r]/.test(safeValue)) safeValue = `'${safeValue}`;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

async function route(req: Request, context: Context): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const method = req.method;

  if (path === "/api/config" && method === "GET") {
    return Response.json({ demoMode: isDemoMode() });
  }

  if (path === "/api/login" && method === "POST") {
    const body = await readJson(req);
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) throw new HttpError(400, "Username and password are required.");

    if (isDemoMode()) {
      await startSession(context, req, { id: null, username, displayName: username, role: "admin" });
      return Response.json({ username, displayName: username, role: "admin" });
    }

    await ensureAdminAccount(username);
    const [user] = await db.select().from(users).where(eq(users.username, username));
    const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !passwordMatches) throw new HttpError(401, "Incorrect username or password.");

    await startSession(context, req, {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role
    });
    return Response.json({ username: user.username, displayName: user.displayName, role: user.role });
  }

  if (path === "/api/logout" && method === "POST") {
    const id = context.cookies.get(SESSION_COOKIE);
    if (id) await db.delete(sessions).where(eq(sessions.id, id));
    context.cookies.delete({ name: SESSION_COOKIE, path: "/" });
    return Response.json({ success: true });
  }

  if (path === "/api/me" && method === "GET") {
    const user = await currentUser(context);
    return Response.json({ username: user.username, displayName: user.displayName, role: user.role });
  }

  if (path === "/api/faculty") {
    await requireAdmin(context);
    if (method === "GET") {
      return Response.json(await db.select(facultyColumns).from(faculty).orderBy(asc(faculty.name)));
    }
    if (method === "POST") {
      const values = facultyFields(await readJson(req));
      try {
        const [created] = await db.insert(faculty).values(values).returning(facultyColumns);
        return Response.json(created, { status: 201 });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new HttpError(409, "A faculty member with that email already exists.");
        }
        throw error;
      }
    }
  }

  const facultyMatch = path.match(/^\/api\/faculty\/([^/]+)$/);
  if (facultyMatch) {
    await requireAdmin(context);
    const id = Number(facultyMatch[1]);
    if (!Number.isInteger(id)) throw new HttpError(404, "Faculty member not found.");
    if (method === "PUT") {
      const values = facultyFields(await readJson(req));
      try {
        const [updated] = await db.update(faculty).set(values)
          .where(eq(faculty.id, id)).returning(facultyColumns);
        if (!updated) throw new HttpError(404, "Faculty member not found.");
        return Response.json(updated);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new HttpError(409, "A faculty member with that email already exists.");
        }
        throw error;
      }
    }
    if (method === "DELETE") {
      const deleted = await db.delete(faculty).where(eq(faculty.id, id)).returning({ id: faculty.id });
      if (!deleted.length) throw new HttpError(404, "Faculty member not found.");
      return Response.json({ success: true });
    }
  }

  if (path === "/api/attendance") {
    await requireAdmin(context);
    if (method === "GET") {
      const date = url.searchParams.get("date");
      if (date && !validDate(date)) throw new HttpError(400, "Date must use YYYY-MM-DD.");
      const day = date || new Date().toISOString().slice(0, 10);
      const rows = await db.select({
        facultyId: faculty.id,
        name: faculty.name,
        department: faculty.department,
        email: faculty.email,
        status: attendance.status,
        date: attendance.date
      })
        .from(faculty)
        .leftJoin(attendance, and(eq(attendance.facultyId, faculty.id), eq(attendance.date, day)))
        .orderBy(asc(faculty.name));
      return Response.json(rows);
    }
    if (method === "POST") {
      const { facultyId, date, status } = await readJson(req);
      const id = Number(facultyId);
      if (!Number.isInteger(id) || !validDate(date) || !STATUSES.includes(status as string)) {
        throw new HttpError(400, "A faculty member, valid date, and attendance status are required.");
      }
      const [member] = await db.select({ id: faculty.id }).from(faculty).where(eq(faculty.id, id));
      if (!member) throw new HttpError(404, "Faculty member not found.");
      await db.insert(attendance)
        .values({ facultyId: id, date, status: status as string })
        .onConflictDoUpdate({
          target: [attendance.facultyId, attendance.date],
          set: { status: status as string }
        });
      return Response.json({ success: true });
    }
  }

  if (path === "/api/reports" && method === "GET") {
    await requireAdmin(context);
    const month = monthParam(url);
    const countStatus = (value: string) =>
      sql<number>`COALESCE(SUM(CASE WHEN ${attendance.status} = ${value} THEN 1 ELSE 0 END), 0)::int`;
    const rows = await db.select({
      facultyId: faculty.id,
      name: faculty.name,
      department: faculty.department,
      present: countStatus("present"),
      absent: countStatus("absent"),
      late: countStatus("late")
    })
      .from(faculty)
      .leftJoin(attendance, and(eq(attendance.facultyId, faculty.id), like(attendance.date, `${month}-%`)))
      .groupBy(faculty.id)
      .orderBy(asc(faculty.name));
    return Response.json({ month, rows });
  }

  if (path === "/api/reports/export.csv" && method === "GET") {
    await requireAdmin(context);
    const month = monthParam(url);
    const rows = await db.select({
      name: faculty.name,
      department: faculty.department,
      date: attendance.date,
      status: attendance.status
    })
      .from(attendance)
      .innerJoin(faculty, eq(faculty.id, attendance.facultyId))
      .where(like(attendance.date, `${month}-%`))
      .orderBy(asc(attendance.date), asc(faculty.name));
    const csv = [
      ["Faculty", "Department", "Date", "Status"].map(csvCell).join(","),
      ...rows.map((row) => [row.name, row.department, row.date, row.status].map(csvCell).join(","))
    ].join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance-${month}.csv"`
      }
    });
  }

  throw new HttpError(404, "Not found.");
}

export default async (req: Request, context: Context) => {
  try {
    return await route(req, context);
  } catch (error) {
    if (error instanceof HttpError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json({ error: "An unexpected server error occurred." }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/*"
};
