CREATE TABLE IF NOT EXISTS home (
  id TEXT PRIMARY KEY,
  badge TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  button_one TEXT NOT NULL DEFAULT '',
  button_two TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  business_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  hours TEXT NOT NULL DEFAULT '',
  instagram TEXT NOT NULL DEFAULT '',
  facebook TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  about_title TEXT NOT NULL DEFAULT '',
  about_description TEXT NOT NULL DEFAULT '',
  about_image TEXT NOT NULL DEFAULT '',
  footer_description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gallery (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Residential',
  image_url TEXT,
  image_path TEXT NOT NULL DEFAULT '',
  video_url TEXT,
  media_type TEXT NOT NULL DEFAULT 'image',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  project TEXT NOT NULL,
  review TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS faq (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS marquee (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  logo_url TEXT NOT NULL,
  logo_path TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_services_created_at ON services(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_created_at ON gallery(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_faq_created_at ON faq(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marquee_created_at ON marquee(created_at ASC);

INSERT INTO home (
  id, badge, title, description, button_one, button_two, image_url, created_at, updated_at
) VALUES (
  'main',
  'Alobaidi Group Painting',
  'Premium Painting. Built To Last.',
  'Transform your home or business with professional painting services built around quality craftsmanship, premium materials, and attention to every detail.',
  'Contact Us',
  'View Our Work',
  '',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT(id) DO NOTHING;

INSERT INTO settings (
  id, business_name, phone, email, hours, instagram, facebook, description,
  about_title, about_description, about_image, footer_description, created_at, updated_at
) VALUES (
  'main',
  'Alobaidi Group Painting',
  '',
  '',
  '',
  '',
  '',
  'Premium residential and commercial painting services built with quality craftsmanship and attention to detail.',
  'About Alobaidi Group Painting',
  'Alobaidi Group Painting provides premium residential and commercial painting services with expert craftsmanship, quality materials, and attention to every detail.',
  '',
  'Premium residential and commercial painting services built with quality craftsmanship and attention to detail.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT(id) DO NOTHING;
