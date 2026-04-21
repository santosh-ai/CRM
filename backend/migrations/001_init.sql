-- NDIS CRM Database Migration 001
-- Run this file to initialize the database schema and seed data

-- Users (staff) table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'staff',
  position VARCHAR(100),
  employment_type VARCHAR(50),
  phone VARCHAR(50),
  address TEXT,
  availability TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  ndis_number VARCHAR(100),
  dob DATE,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(50),
  emergency_contact_relation VARCHAR(100),
  care_plan TEXT,
  support_needs TEXT,
  risk_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents (compliance docs per staff)
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(100) NOT NULL,
  file_url VARCHAR(500),
  file_name VARCHAR(255),
  issue_date DATE,
  expiry_date DATE,
  status VARCHAR(50) DEFAULT 'valid',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trainings table
CREATE TABLE IF NOT EXISTS trainings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  training_name VARCHAR(255) NOT NULL,
  completion_date DATE,
  expiry_date DATE,
  certificate_url VARCHAR(500),
  certificate_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'valid',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes (case notes per client)
CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  staff_id INTEGER REFERENCES users(id),
  note TEXT NOT NULL,
  note_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Incidents table
CREATE TABLE IF NOT EXISTS incidents (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  reported_by INTEGER REFERENCES users(id),
  title VARCHAR(255),
  description TEXT NOT NULL,
  incident_date TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'open',
  severity VARCHAR(50) DEFAULT 'medium',
  file_url VARCHAR(500),
  file_name VARCHAR(255),
  supervisor_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100),
  entity_id INTEGER,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default admin account (password: Admin@123)
-- Hash generated with bcryptjs rounds=10
INSERT INTO users (name, email, password_hash, role, position, employment_type, phone, is_active)
VALUES (
  'System Administrator',
  'admin@ndis.com',
  '$2a$10$NG0WVq4eB.b8aasFTUGos.6cvepI/2MysCuvSZgzsalLrAoz0Jf5e',
  'admin',
  'Admin',
  'full-time',
  '0400000000',
  true
) ON CONFLICT (email) DO NOTHING;

-- Sample Manager
INSERT INTO users (name, email, password_hash, role, position, employment_type, phone, is_active)
VALUES (
  'Sarah Johnson',
  'manager@ndis.com',
  '$2a$10$NG0WVq4eB.b8aasFTUGos.6cvepI/2MysCuvSZgzsalLrAoz0Jf5e',
  'manager',
  'Support Coordinator',
  'full-time',
  '0411111111',
  true
) ON CONFLICT (email) DO NOTHING;

-- Sample Staff
INSERT INTO users (name, email, password_hash, role, position, employment_type, phone, address, availability, is_active)
VALUES (
  'Michael Chen',
  'michael.chen@ndis.com',
  '$2a$10$NG0WVq4eB.b8aasFTUGos.6cvepI/2MysCuvSZgzsalLrAoz0Jf5e',
  'staff',
  'Support Worker',
  'part-time',
  '0422222222',
  '45 Park Street, Sydney NSW 2000',
  'Mon-Fri 9am-5pm',
  true
) ON CONFLICT (email) DO NOTHING;

INSERT INTO users (name, email, password_hash, role, position, employment_type, phone, address, availability, is_active)
VALUES (
  'Emily Rodriguez',
  'emily.rodriguez@ndis.com',
  '$2a$10$NG0WVq4eB.b8aasFTUGos.6cvepI/2MysCuvSZgzsalLrAoz0Jf5e',
  'staff',
  'RN',
  'casual',
  '0433333333',
  '12 Garden Ave, Melbourne VIC 3000',
  'Weekends + evenings',
  true
) ON CONFLICT (email) DO NOTHING;

-- Sample Clients
INSERT INTO clients (name, ndis_number, dob, address, phone, email, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, care_plan, support_needs, risk_notes, is_active)
VALUES (
  'Robert Williams',
  'NDIS4301234567',
  '1975-06-15',
  '22 Maple Street, Brisbane QLD 4000',
  '0444444444',
  'robert.w@email.com',
  'Jane Williams',
  '0445555555',
  'Spouse',
  'Daily living support including personal care, meal preparation, and community access. Review scheduled quarterly.',
  'Physical disability - mobility support, personal hygiene assistance, medication management',
  'Fall risk - requires supervision on stairs. Allergic to penicillin.',
  true
),
(
  'Patricia Thompson',
  'NDIS4309876543',
  '1989-11-22',
  '8 Ocean Drive, Perth WA 6000',
  '0446666666',
  'patricia.t@email.com',
  'Mark Thompson',
  '0447777777',
  'Brother',
  'Supported independent living with focus on social skills, employment readiness, and daily routine management.',
  'Autism spectrum disorder - communication support, sensory processing, routine management',
  'Sensory overload triggers - avoid loud environments. Communication board required.',
  true
),
(
  'James Anderson',
  'NDIS4305554321',
  '1962-03-08',
  '99 Hill Road, Adelaide SA 5000',
  '0448888888',
  'james.a@email.com',
  'Susan Anderson',
  '0449999999',
  'Daughter',
  'High-intensity daily support. Dementia care protocols in place. Regular GP reviews monthly.',
  'Acquired brain injury - cognitive support, medication reminders, personal care',
  'Wandering risk - door alarms required. Sundowning behaviours in late afternoon.',
  true
) ON CONFLICT DO NOTHING;

-- Documents with various statuses (using dynamic dates relative to NOW())
DO $$
DECLARE
  michael_id INTEGER;
  emily_id INTEGER;
  sarah_id INTEGER;
BEGIN
  SELECT id INTO michael_id FROM users WHERE email = 'michael.chen@ndis.com';
  SELECT id INTO emily_id FROM users WHERE email = 'emily.rodriguez@ndis.com';
  SELECT id INTO sarah_id FROM users WHERE email = 'manager@ndis.com';

  -- Michael's documents (mix of valid, expiring soon, expired)
  INSERT INTO documents (user_id, document_type, issue_date, expiry_date, status, notes)
  VALUES
    (michael_id, 'WWVP', CURRENT_DATE - INTERVAL '2 years', CURRENT_DATE + INTERVAL '1 year', 'valid', 'Working With Vulnerable People check - clear'),
    (michael_id, 'Police Check', CURRENT_DATE - INTERVAL '2 years', CURRENT_DATE + INTERVAL '20 days', 'expiring_soon', 'Renewal reminder sent'),
    (michael_id, 'First Aid', CURRENT_DATE - INTERVAL '3 years', CURRENT_DATE - INTERVAL '10 days', 'expired', 'EXPIRED - renewal required urgently'),
    (michael_id, 'NDIS Worker Screening', CURRENT_DATE - INTERVAL '1 year', CURRENT_DATE + INTERVAL '2 years', 'valid', 'NDIS Worker Screening Check - cleared');

  -- Emily's documents
  INSERT INTO documents (user_id, document_type, issue_date, expiry_date, status, notes)
  VALUES
    (emily_id, 'WWVP', CURRENT_DATE - INTERVAL '1 year', CURRENT_DATE + INTERVAL '2 years', 'valid', NULL),
    (emily_id, 'Police Check', CURRENT_DATE - INTERVAL '6 months', CURRENT_DATE + INTERVAL '18 months', 'valid', NULL),
    (emily_id, 'CPR', CURRENT_DATE - INTERVAL '11 months', CURRENT_DATE + INTERVAL '15 days', 'expiring_soon', 'CPR renewal booked for next week'),
    (emily_id, 'Manual Handling', CURRENT_DATE - INTERVAL '1 year', CURRENT_DATE + INTERVAL '6 months', 'valid', NULL),
    (emily_id, 'NDIS Worker Screening', CURRENT_DATE - INTERVAL '2 years', CURRENT_DATE - INTERVAL '5 days', 'expired', 'Application lodged for renewal');

  -- Sarah's documents
  INSERT INTO documents (user_id, document_type, issue_date, expiry_date, status, notes)
  VALUES
    (sarah_id, 'WWVP', CURRENT_DATE - INTERVAL '1 year', CURRENT_DATE + INTERVAL '2 years', 'valid', NULL),
    (sarah_id, 'Police Check', CURRENT_DATE - INTERVAL '1 year', CURRENT_DATE + INTERVAL '2 years', 'valid', NULL),
    (sarah_id, 'First Aid', CURRENT_DATE - INTERVAL '1 year', CURRENT_DATE + INTERVAL '1 year', 'valid', NULL),
    (sarah_id, 'NDIS Worker Screening', CURRENT_DATE - INTERVAL '1 year', CURRENT_DATE + INTERVAL '3 years', 'valid', NULL);

END $$;

-- Trainings
DO $$
DECLARE
  michael_id INTEGER;
  emily_id INTEGER;
BEGIN
  SELECT id INTO michael_id FROM users WHERE email = 'michael.chen@ndis.com';
  SELECT id INTO emily_id FROM users WHERE email = 'emily.rodriguez@ndis.com';

  INSERT INTO trainings (user_id, training_name, completion_date, expiry_date, status, notes)
  VALUES
    (michael_id, 'NDIS Practice Standards', CURRENT_DATE - INTERVAL '6 months', CURRENT_DATE + INTERVAL '18 months', 'valid', 'Completed online module'),
    (michael_id, 'Safeguarding Vulnerable People', CURRENT_DATE - INTERVAL '1 year', CURRENT_DATE + INTERVAL '25 days', 'expiring_soon', 'Refresher course needed'),
    (michael_id, 'Manual Handling and Moving', CURRENT_DATE - INTERVAL '2 years', CURRENT_DATE - INTERVAL '15 days', 'expired', 'Book refresher ASAP'),
    (emily_id, 'NDIS Practice Standards', CURRENT_DATE - INTERVAL '3 months', CURRENT_DATE + INTERVAL '21 months', 'valid', NULL),
    (emily_id, 'Medication Administration', CURRENT_DATE - INTERVAL '6 months', CURRENT_DATE + INTERVAL '18 months', 'valid', 'RN specific training'),
    (emily_id, 'Behaviour Support', CURRENT_DATE - INTERVAL '8 months', CURRENT_DATE + INTERVAL '16 months', 'valid', NULL);
END $$;

-- Case Notes
DO $$
DECLARE
  robert_id INTEGER;
  patricia_id INTEGER;
  james_id INTEGER;
  michael_id INTEGER;
  emily_id INTEGER;
  sarah_id INTEGER;
BEGIN
  SELECT id INTO robert_id FROM clients WHERE ndis_number = 'NDIS4301234567';
  SELECT id INTO patricia_id FROM clients WHERE ndis_number = 'NDIS4309876543';
  SELECT id INTO james_id FROM clients WHERE ndis_number = 'NDIS4305554321';
  SELECT id INTO michael_id FROM users WHERE email = 'michael.chen@ndis.com';
  SELECT id INTO emily_id FROM users WHERE email = 'emily.rodriguez@ndis.com';
  SELECT id INTO sarah_id FROM users WHERE email = 'manager@ndis.com';

  INSERT INTO notes (client_id, staff_id, note, note_date)
  VALUES
    (robert_id, michael_id, 'Assisted Robert with morning routine including personal hygiene and breakfast preparation. Client was in good spirits and participated well. No concerns noted.', NOW() - INTERVAL '2 days'),
    (robert_id, emily_id, 'Conducted medication review with Robert. All medications administered as prescribed. Blood pressure reading: 128/82 - within normal range. Appointment with GP scheduled for next Tuesday.', NOW() - INTERVAL '1 day'),
    (patricia_id, michael_id, 'Supported Patricia with community access - visited local library. She was initially hesitant but engaged well with librarian. Used communication board effectively. Great progress.', NOW() - INTERVAL '3 days'),
    (patricia_id, sarah_id, 'Reviewed Patricia''s support plan with family. Mark expressed satisfaction with current supports. Plan updated to include additional social skills sessions on Thursdays.', NOW() - INTERVAL '1 week'),
    (james_id, emily_id, 'Evening support shift. James showed some sundowning behaviour around 4pm - redirected with familiar music and photo album. Settled well by 6pm. Sleep pattern improving.', NOW() - INTERVAL '1 day'),
    (james_id, michael_id, 'Morning personal care and breakfast. James required extra prompting today for hygiene routine. Daughter Susan called to check in - updated her on the morning.', NOW() - INTERVAL '5 days');
END $$;

-- Incidents
DO $$
DECLARE
  robert_id INTEGER;
  james_id INTEGER;
  michael_id INTEGER;
  emily_id INTEGER;
  sarah_id INTEGER;
BEGIN
  SELECT id INTO robert_id FROM clients WHERE ndis_number = 'NDIS4301234567';
  SELECT id INTO james_id FROM clients WHERE ndis_number = 'NDIS4305554321';
  SELECT id INTO michael_id FROM users WHERE email = 'michael.chen@ndis.com';
  SELECT id INTO emily_id FROM users WHERE email = 'emily.rodriguez@ndis.com';
  SELECT id INTO sarah_id FROM users WHERE email = 'manager@ndis.com';

  INSERT INTO incidents (client_id, reported_by, title, description, incident_date, status, severity, supervisor_notes)
  VALUES
    (robert_id, michael_id, 'Minor Fall in Bathroom', 'Client slipped on wet bathroom floor during morning routine. No injuries sustained. Client was shaken but calm. Non-slip mat was not in place. Incident reported to supervisor immediately.', NOW() - INTERVAL '3 days', 'resolved', 'low', 'Non-slip mats have been installed in all bathrooms. Risk assessment updated. No further action required.'),
    (james_id, emily_id, 'Medication Error - Near Miss', 'Staff nearly administered wrong dosage of blood pressure medication. Error caught before administration when double-checking the medication chart. No harm to client.', NOW() - INTERVAL '1 week', 'under_review', 'high', 'Full investigation underway. Medication double-check protocol being reviewed. All staff to attend medication management refresher.'),
    (james_id, michael_id, 'Aggressive Behaviour Incident', 'Client became verbally aggressive during afternoon support. Staff used de-escalation techniques as per behaviour support plan. Client calmed within 20 minutes. No physical harm.', NOW() - INTERVAL '2 days', 'open', 'medium', NULL);
END $$;
