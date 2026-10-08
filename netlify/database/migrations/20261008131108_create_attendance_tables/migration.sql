CREATE TABLE "attendance" (
	"id" serial PRIMARY KEY,
	"faculty_id" integer NOT NULL,
	"date" text NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "attendance_faculty_date_unique" UNIQUE("faculty_id","date"),
	CONSTRAINT "attendance_status_check" CHECK ("status" IN ('present', 'absent', 'late'))
);
--> statement-breakpoint
CREATE TABLE "faculty" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"department" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY,
	"user_id" integer,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY,
	"username" text NOT NULL UNIQUE,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "users_role_check" CHECK ("role" IN ('admin', 'faculty'))
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_faculty_id_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;