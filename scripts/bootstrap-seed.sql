-- ========== SEED: providers ==========
INSERT INTO "providers" ("name", "slug", "domain") VALUES
  ('Coursera', 'coursera', 'coursera.org'),
  ('Udemy', 'udemy', 'udemy.com'),
  ('edX', 'edx', 'edx.org'),
  ('Microsoft Learn', 'microsoft-learn', 'learn.microsoft.com'),
  ('freeCodeCamp', 'freecodecamp', 'freecodecamp.org'),
  ('AWS', 'aws', 'aws.amazon.com'),
  ('Google', 'google', 'developers.google.com'),
  ('LinkedIn Learning', 'linkedin-learning', 'linkedin.com')
ON CONFLICT ("slug") DO NOTHING;

-- ========== SEED: categories ==========
INSERT INTO "categories" ("name", "slug", "description") VALUES
  ('Artificial Intelligence', 'ai', 'Free artificial intelligence courses curated by FreeLearn Radar.'),
  ('Programming', 'programming', 'Free programming courses curated by FreeLearn Radar.'),
  ('Data Science', 'data-science', 'Free data science courses curated by FreeLearn Radar.'),
  ('Cybersecurity', 'cybersecurity', 'Free cybersecurity courses curated by FreeLearn Radar.'),
  ('Cloud', 'cloud', 'Free cloud courses curated by FreeLearn Radar.'),
  ('DevOps', 'devops', 'Free devops courses curated by FreeLearn Radar.'),
  ('Project Management', 'project-management', 'Free project management courses curated by FreeLearn Radar.'),
  ('Product Management', 'product-management', 'Free product management courses curated by FreeLearn Radar.'),
  ('Business', 'business', 'Free business courses curated by FreeLearn Radar.'),
  ('Marketing', 'marketing', 'Free marketing courses curated by FreeLearn Radar.'),
  ('Design', 'design', 'Free design courses curated by FreeLearn Radar.'),
  ('Soft Skills', 'soft-skills', 'Free soft skills courses curated by FreeLearn Radar.')
ON CONFLICT ("slug") DO NOTHING;

-- ========== SEED: discovery queries ==========
-- Intentionally omitted. The query set is large and changes often; running
-- `npm run db:seed` keeps it in step with src/db/seed/data.ts instead of
-- drifting inside this file.

-- ========== SEED: admin user ==========
-- Email: admin@example.com | Password: FreeLearnRadar2026!
-- Change this password immediately after first login.
INSERT INTO "users" ("email", "name", "password_hash", "role")
VALUES (
  'admin@example.com',
  'Admin',
  '$2b$12$/RzasQ3Re0V3P9FzmgmxT.FzRI7ogGlrqzuTqrsLZK2xvw3vtgkLu',
  'ADMIN'
)
ON CONFLICT ("email") DO NOTHING;
