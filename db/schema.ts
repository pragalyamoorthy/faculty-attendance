import { sql } from "drizzle-orm";
import { check, integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial().primaryKey(),
  username: text().notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text().notNull()
}, (table) => [
  check("users_role_check", sql`${table.role} IN ('admin', 'faculty')`)
]);

export const faculty = pgTable("faculty", {
  id: serial().primaryKey(),
  name: text().notNull(),
  department: text().notNull(),
  email: text().notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

export const attendance = pgTable("attendance", {
  id: serial().primaryKey(),
  facultyId: integer("faculty_id").notNull().references(() => faculty.id, { onDelete: "cascade" }),
  // Stored as YYYY-MM-DD text, matching the format used by the API and browser date inputs.
  date: text().notNull(),
  status: text().notNull()
}, (table) => [
  unique("attendance_faculty_date_unique").on(table.facultyId, table.date),
  check("attendance_status_check", sql`${table.status} IN ('present', 'absent', 'late')`)
]);

// Functions are stateless, so signed-in sessions live in the database rather than in memory.
export const sessions = pgTable("sessions", {
  id: text().primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  username: text().notNull(),
  displayName: text("display_name").notNull(),
  role: text().notNull(),
  expiresAt: timestamp("expires_at").notNull()
});
