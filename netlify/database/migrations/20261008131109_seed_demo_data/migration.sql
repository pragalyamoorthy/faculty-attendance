INSERT INTO faculty (name, department, email)
VALUES
  ('Avery Morgan', 'Computer Science', 'avery.morgan@example.test'),
  ('Jordan Lee', 'Mathematics', 'jordan.lee@example.test'),
  ('Taylor Patel', 'Physics', 'taylor.patel@example.test'),
  ('Morgan Chen', 'Biology', 'morgan.chen@example.test'),
  ('Riley Johnson', 'Chemistry', 'riley.johnson@example.test'),
  ('Casey Williams', 'English', 'casey.williams@example.test'),
  ('Jamie Garcia', 'History', 'jamie.garcia@example.test'),
  ('Alex Robinson', 'Computer Science', 'alex.robinson@example.test'),
  ('Drew Martinez', 'Mathematics', 'drew.martinez@example.test'),
  ('Quinn Davis', 'Physics', 'quinn.davis@example.test'),
  ('Cameron Wilson', 'Biology', 'cameron.wilson@example.test'),
  ('Skyler Anderson', 'Chemistry', 'skyler.anderson@example.test'),
  ('Reese Thomas', 'English', 'reese.thomas@example.test'),
  ('Parker Taylor', 'History', 'parker.taylor@example.test'),
  ('Rowan Moore', 'Computer Science', 'rowan.moore@example.test'),
  ('Emerson Clark', 'Mathematics', 'emerson.clark@example.test'),
  ('Finley Lewis', 'Physics', 'finley.lewis@example.test'),
  ('Dakota Hall', 'Biology', 'dakota.hall@example.test'),
  ('Harper Young', 'Chemistry', 'harper.young@example.test')
ON CONFLICT(email) DO NOTHING;
--> statement-breakpoint
INSERT INTO attendance (faculty_id, date, status)
SELECT faculty.id, to_char(CURRENT_DATE - 13 + day_offset, 'YYYY-MM-DD'),
       CASE (faculty.id + day_offset) % 7
         WHEN 0 THEN 'absent'
         WHEN 1 THEN 'late'
         ELSE 'present'
       END
FROM faculty
CROSS JOIN generate_series(0, 13) AS day_offset
WHERE faculty.email LIKE '%@example.test'
ON CONFLICT (faculty_id, date) DO NOTHING;
