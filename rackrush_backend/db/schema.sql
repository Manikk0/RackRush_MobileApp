-- RackRush Database Schema
-- Run with: npx ts-node db/migrate.ts

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE enum_language AS ENUM ('sk', 'en', 'cz');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_payment_type AS ENUM ('card', 'paypal', 'apple_pay', 'google_pay');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_unit_type AS ENUM ('piece', 'gram', 'kg', 'liter', 'pack');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_day_of_week AS ENUM ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_features AS ENUM ('basic', 'premium', 'vip');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_billing_period AS ENUM ('monthly', 'yearly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SUBSCRIPTION PLANS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_detail (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  features        VARCHAR(1000),
  price           DECIMAL(10,2) NOT NULL,
  billing_period  enum_billing_period NOT NULL DEFAULT 'monthly'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id               SERIAL PRIMARY KEY,
  full_name        VARCHAR(150) NOT NULL,
  email            VARCHAR(255) UNIQUE NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  date_of_birth    DATE,
  role             VARCHAR(50) NOT NULL DEFAULT 'user',
  location         POINT,
  profile_image    VARCHAR(255),
  created_at       TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- USER PREFERENCES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_preferences (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  language             enum_language DEFAULT 'sk',
  theme_mode           BOOLEAN DEFAULT FALSE,
  high_contrast_mode   BOOLEAN DEFAULT FALSE,
  font_size            INTEGER DEFAULT 14,
  reading_out_loud     BOOLEAN DEFAULT FALSE,
  simple_navigation    BOOLEAN DEFAULT FALSE,
  region               VARCHAR(100),
  data_privacy_consent BOOLEAN DEFAULT FALSE,
  terms_of_service     BOOLEAN DEFAULT FALSE
);

-- ─────────────────────────────────────────────────────────────────────────────
-- USER NOTIFICATIONS SETTINGS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_notifications (
  id                      SERIAL PRIMARY KEY,
  user_id                 INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  order_status            BOOLEAN DEFAULT TRUE,
  delivery_app            BOOLEAN DEFAULT TRUE,
  unused_points           BOOLEAN DEFAULT TRUE,
  suspicious_activity     BOOLEAN DEFAULT TRUE,
  unfinished_order        BOOLEAN DEFAULT TRUE,
  favorite_product_sale   BOOLEAN DEFAULT TRUE,
  news_letter_email       BOOLEAN DEFAULT FALSE,
  news_letter_app         BOOLEAN DEFAULT TRUE,
  sale_app                BOOLEAN DEFAULT FALSE,
  sale_sms                BOOLEAN DEFAULT FALSE,
  sale_email              BOOLEAN DEFAULT FALSE,
  verification_code_sms   BOOLEAN DEFAULT TRUE,
  verification_code_email BOOLEAN DEFAULT TRUE,
  delivery_sms            BOOLEAN DEFAULT FALSE,
  exclusive_code          BOOLEAN DEFAULT TRUE,
  news_email              BOOLEAN DEFAULT FALSE,
  feedback                BOOLEAN DEFAULT TRUE,
  invoice                 BOOLEAN DEFAULT TRUE
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SUBSCRIPTIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
  plan_id             INTEGER REFERENCES subscription_detail(id),
  payment_card_token  VARCHAR(255),
  start_date          TIMESTAMP DEFAULT NOW(),
  expiry_date         DATE NOT NULL,
  status              VARCHAR(50) DEFAULT 'active',
  is_active           BOOLEAN DEFAULT TRUE
);

-- ─────────────────────────────────────────────────────────────────────────────
-- LOYALTY CARDS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_cards (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  qr_code_data   TEXT NOT NULL,
  current_points INTEGER DEFAULT 0
);

-- ─────────────────────────────────────────────────────────────────────────────
-- USER ACCOUNT
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_account (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  two_factor_auth  BOOLEAN DEFAULT FALSE,
  link             VARCHAR(255)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PAYMENT METHODS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_methods (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type           enum_payment_type NOT NULL,
  card_last4     VARCHAR(4),
  card_brand     VARCHAR(20),
  is_active      BOOLEAN DEFAULT TRUE,
  is_preferred   BOOLEAN DEFAULT FALSE
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STORES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stores (
  id                       SERIAL PRIMARY KEY,
  name                     VARCHAR(150) NOT NULL,
  address                  VARCHAR(300) NOT NULL,
  phone_number             VARCHAR(30),
  location                 POINT,
  opening_hours            VARCHAR(200),
  live_occupancy           INTEGER DEFAULT 0,
  max_occupancy            INTEGER DEFAULT 100
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STORE OCCUPANCY PATTERNS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_occupancy_patterns (
  id                   SERIAL PRIMARY KEY,
  store_id             INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  average_occupancy    INTEGER DEFAULT 0,
  day_of_week          enum_day_of_week NOT NULL,
  hour_of_day          INTEGER NOT NULL CHECK(hour_of_day >= 0 AND hour_of_day <= 23)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- CATEGORIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  parent_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PRODUCTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id           SERIAL PRIMARY KEY,
  category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name         VARCHAR(150) NOT NULL,
  weight       INTEGER,
  unit_type    enum_unit_type,
  description  TEXT,
  price        DECIMAL(10,2) NOT NULL,
  image_url    VARCHAR(255),
  is_available BOOLEAN DEFAULT TRUE,
  adults_only  BOOLEAN DEFAULT FALSE,
  point_value  INTEGER DEFAULT 0
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STORE INVENTORY
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_inventory (
  id             SERIAL PRIMARY KEY,
  store_id       INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  product_id     INTEGER REFERENCES products(id) ON DELETE CASCADE,
  stock_quantity INTEGER DEFAULT 0,
  UNIQUE(store_id, product_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- REWARD CATALOG
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reward_catalog (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(150) NOT NULL,
  reward_type INTEGER NOT NULL,
  point_cost  INTEGER NOT NULL,
  adults_only BOOLEAN DEFAULT FALSE,
  description TEXT
);

-- ─────────────────────────────────────────────────────────────────────────────
-- REWARDS (Allocated rewards out of the catalog)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rewards (
  id          SERIAL PRIMARY KEY,
  catalog_id  INTEGER REFERENCES reward_catalog(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  unique_code VARCHAR(255) NOT NULL,
  acquired_at TIMESTAMP DEFAULT NOW(),
  expires_at  TIMESTAMP,
  is_redeemed BOOLEAN DEFAULT FALSE
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ORDERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  store_id           INTEGER REFERENCES stores(id) ON DELETE SET NULL,
  total_price        DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method     VARCHAR(50),
  status             VARCHAR(50) DEFAULT 'pending',
  in_store_purchase  BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- USER ACTIVATED OFFERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_activated_offers (
  id           SERIAL PRIMARY KEY,
  reward_id    INTEGER REFERENCES rewards(id) ON DELETE CASCADE,
  order_id     INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  status       VARCHAR(50) DEFAULT 'active',
  activated_at TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ORDER ITEMS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id               SERIAL PRIMARY KEY,
  order_id         INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id       INTEGER REFERENCES products(id) ON DELETE SET NULL,
  quantity         INTEGER NOT NULL DEFAULT 1,
  price_at_purchase DECIMAL(10,2) NOT NULL
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RECEIPTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receipts (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  raw_content TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SHOPPING LISTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shopping_lists (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SHOPPING LIST ITEMS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shopping_list_items (
  id         SERIAL PRIMARY KEY,
  list_id    INTEGER REFERENCES shopping_lists(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  is_checked BOOLEAN DEFAULT FALSE
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FAVORITES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favorites (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(user_id, product_id)
);
