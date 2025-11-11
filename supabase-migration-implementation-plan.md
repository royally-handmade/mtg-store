# Supabase Database Migration Implementation Plan

## Executive Summary

This document provides a comprehensive implementation plan for managing database migrations in your Magic: The Gathering card marketplace application. The plan includes setup procedures, best practices, migration templates, and a rollout strategy to ensure safe and reliable database schema management.

---

## 1. Current State Analysis

### Database Tables Identified
From the codebase analysis, the following tables are in use:

- **Core Tables**: `cards`, `profiles`, `listings`, `orders`, `cart_items`
- **User Management**: `wishlists`, `saved_searches`, `user_addresses`
- **Seller Management**: `seller_inventory`, `seller_payouts`
- **Pricing**: `price_history`, `external_price_sources`
- **Deck Building**: `decks`, `deck_cards`
- **Admin**: Various admin-related tables

### Current Migration Gaps
- No structured migration system in place
- Manual table checks in code (e.g., `saved_searches` table existence checks)
- Inconsistent schema management across environments
- No version control for database schema changes

---

## 2. Recommended Migration Strategy

### A. Use Supabase CLI for Migration Management

Supabase provides a built-in migration system through their CLI that integrates with version control.

**Benefits:**
- Official Supabase support
- Version control integration
- Automatic migration tracking
- Rollback capabilities
- Environment-specific migrations

---

## 3. Implementation Steps

### Phase 1: Setup & Configuration (Week 1)

#### Step 1.1: Install Supabase CLI

**Note**: Supabase CLI cannot be installed as a global npm package. Use one of the following methods:

**Option A: Using Homebrew (macOS/Linux - Recommended)**
```bash
# Install via Homebrew
brew install supabase/tap/supabase

# Verify installation
supabase --version
```

**Option B: Using Scoop (Windows)**
```bash
# Install via Scoop
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Verify installation
supabase --version
```

**Option C: Direct Binary Download**
```bash
# Download the appropriate binary for your OS from:
# https://github.com/supabase/cli/releases

# For macOS/Linux, make it executable and move to PATH:
chmod +x supabase
sudo mv supabase /usr/local/bin/

# Verify installation
supabase --version
```

**Option D: Using npm scripts (Project-specific)**
```bash
# Add Supabase CLI as a dev dependency in your backend
cd backend
npm install --save-dev supabase

# Run via npx
npx supabase --version

# Or add npm scripts to package.json (see below)
```

If using Option D (npm scripts), add these to your `backend/package.json`:

```json
{
  "scripts": {
    "supabase": "supabase",
    "supabase:init": "supabase init",
    "supabase:link": "supabase link",
    "supabase:migration:new": "supabase migration new",
    "supabase:db:push": "supabase db push",
    "supabase:db:reset": "supabase db reset",
    "supabase:start": "supabase start",
    "supabase:stop": "supabase stop"
  },
  "devDependencies": {
    "supabase": "^1.0.0"
  }
}
```

Then use commands like:
```bash
npm run supabase:init
npm run supabase:migration:new add_new_table
npm run supabase:db:push
```

**Recommended Approach**: Use Homebrew (Option A) for macOS/Linux or Scoop (Option B) for Windows as these provide the most seamless experience. Option D is suitable if you want to keep everything project-specific.

#### Step 1.2: Initialize Supabase Project

```bash
# Navigate to your backend directory
cd backend

# Initialize Supabase (this creates a supabase/ directory)
supabase init
# or if using npm: npx supabase init

# Link to your remote project
supabase link --project-ref YOUR_PROJECT_REF
# or if using npm: npx supabase link --project-ref YOUR_PROJECT_REF
```

**Note**: Replace `YOUR_PROJECT_REF` with your actual Supabase project reference ID, which you can find in your Supabase dashboard URL or project settings.

#### Step 1.3: Create Migration Directory Structure

```bash
backend/
├── supabase/
│   ├── migrations/
│   │   └── [timestamp]_[description].sql
│   ├── config.toml
│   └── seed.sql
├── package.json
└── ...
```

#### Step 1.4: Update `.gitignore`

```gitignore
# Add to your .gitignore
.env.local
supabase/.branches/
supabase/.temp/
```

---

### Phase 2: Create Initial Migration (Week 1-2)

#### Step 2.1: Generate Current Schema Baseline

```bash
# Dump current database schema
supabase db dump --local > supabase/migrations/20250101000000_initial_schema.sql
# or if using npm: npx supabase db dump --local > supabase/migrations/20250101000000_initial_schema.sql

# Or manually create the initial migration
supabase migration new initial_schema
# or if using npm: npx supabase migration new initial_schema
```

#### Step 2.2: Create Initial Migration File

**File**: `supabase/migrations/20250101000000_initial_schema.sql`

```sql
-- Initial schema migration
-- This establishes the baseline for all existing tables
-- Generated: 2025-01-15
-- Description: Complete database schema for MTG Marketplace

-- ============================================
-- EXTENSIONS
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- ============================================
-- PROFILES & AUTHENTICATION
-- ============================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    username TEXT UNIQUE,
    full_name TEXT,
    phone TEXT,
    bio TEXT,
    avatar_url TEXT,
    role TEXT CHECK (role IN ('buyer', 'seller', 'admin')) DEFAULT 'buyer',
    approved BOOLEAN DEFAULT FALSE,
    seller_tier TEXT CHECK (seller_tier IN ('standard', 'premium', 'enterprise')),
    seller_application_status TEXT CHECK (seller_application_status IN ('pending', 'approved', 'rejected', 'info_requested')),
    suspended BOOLEAN DEFAULT FALSE,
    suspended_until TIMESTAMPTZ,
    suspension_reason TEXT,
    rating NUMERIC(3,2),
    timezone TEXT DEFAULT 'America/Toronto',
    email_preferences JSONB DEFAULT '{"order_updates": true, "price_alerts": true, "marketing": false, "security": true}'::jsonb,
    shipping_address JSONB,
    approved_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cards table
CREATE TABLE IF NOT EXISTS cards (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    set_number TEXT NOT NULL,
    card_number TEXT,
    mana_cost TEXT,
    rarity TEXT CHECK (rarity IN ('common', 'uncommon', 'rare', 'mythic')),
    type_line TEXT,
    oracle_text TEXT,
    flavor_text TEXT,
    power TEXT,
    toughness TEXT,
    loyalty TEXT,
    image_url TEXT,
    treatment TEXT DEFAULT 'normal',
    market_price NUMERIC(10,2),
    market_price_source TEXT,
    market_price_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_approved ON profiles(approved) WHERE role = 'seller';

-- ============================================
-- CARDS & SETS
-- ============================================

-- Cards table
CREATE TABLE IF NOT EXISTS cards (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    set_number TEXT NOT NULL,
    set_name TEXT NOT NULL,
    card_number TEXT,
    mana_cost TEXT,
    cmc INTEGER,
    colors TEXT[],
    color_identity TEXT[],
    rarity TEXT CHECK (rarity IN ('common', 'uncommon', 'rare', 'mythic')),
    type_line TEXT,
    oracle_text TEXT,
    flavor_text TEXT,
    power TEXT,
    toughness TEXT,
    loyalty TEXT,
    image_url TEXT,
    image_uris JSONB,
    treatment TEXT DEFAULT 'normal',
    foil BOOLEAN DEFAULT FALSE,
    market_price NUMERIC(10,2),
    market_price_source TEXT,
    market_price_updated_at TIMESTAMPTZ,
    scryfall_id UUID,
    scryfall_oracle_id UUID,
    legalities JSONB,
    keywords TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for cards
CREATE INDEX IF NOT EXISTS idx_cards_name ON cards USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cards_set ON cards(set_number);
CREATE INDEX IF NOT EXISTS idx_cards_set_name ON cards(set_name);
CREATE INDEX IF NOT EXISTS idx_cards_rarity ON cards(rarity);
CREATE INDEX IF NOT EXISTS idx_cards_type_line ON cards USING gin(type_line gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cards_colors ON cards USING gin(colors);
CREATE INDEX IF NOT EXISTS idx_cards_market_price ON cards(market_price) WHERE market_price IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cards_scryfall_id ON cards(scryfall_id);

-- ============================================
-- LISTINGS
-- ============================================

-- Listings table
CREATE TABLE IF NOT EXISTS listings (
    id BIGSERIAL PRIMARY KEY,
    card_id BIGINT REFERENCES cards(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    condition TEXT CHECK (condition IN ('Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged')),
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    treatment TEXT DEFAULT 'normal',
    foil BOOLEAN DEFAULT FALSE,
    signed BOOLEAN DEFAULT FALSE,
    altered BOOLEAN DEFAULT FALSE,
    language TEXT DEFAULT 'English',
    notes TEXT,
    description TEXT,
    status TEXT CHECK (status IN ('active', 'sold', 'cancelled', 'deleted')) DEFAULT 'active',
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for listings
CREATE INDEX IF NOT EXISTS idx_listings_card ON listings(card_id);
CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price);
CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(card_id, status) WHERE status = 'active';

-- ============================================
-- ORDERS & ORDER ITEMS
-- ============================================

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')) DEFAULT 'pending',
    payment_status TEXT CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
    subtotal NUMERIC(10,2) NOT NULL,
    shipping_cost NUMERIC(10,2) DEFAULT 0,
    tax_amount NUMERIC(10,2) DEFAULT 0,
    total_amount NUMERIC(10,2) NOT NULL,
    currency TEXT DEFAULT 'CAD',
    shipping_address JSONB,
    billing_address JSONB,
    tracking_number TEXT,
    shipping_carrier TEXT,
    payment_method TEXT,
    card_last_four TEXT,
    helcim_transaction_id TEXT,
    helcim_card_token TEXT,
    notes TEXT,
    requires_manual_review BOOLEAN DEFAULT FALSE,
    payout_processed BOOLEAN DEFAULT FALSE,
    payout_id BIGINT,
    paid_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payout ON orders(payout_processed, seller_id) WHERE payout_processed = FALSE;

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    listing_id BIGINT REFERENCES listings(id) ON DELETE SET NULL,
    card_id BIGINT REFERENCES cards(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL,
    price_at_time NUMERIC(10,2) NOT NULL,
    price_at_purchase NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_listing ON order_items(listing_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON order_items(seller_id);

-- ============================================
-- CART
-- ============================================

-- Cart items table
CREATE TABLE IF NOT EXISTS cart_items (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    listing_id BIGINT REFERENCES listings(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, listing_id)
);

-- Create indexes for cart_items
CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_listing ON cart_items(listing_id);

-- ============================================
-- WISHLIST
-- ============================================

-- Wishlists table
CREATE TABLE IF NOT EXISTS wishlists (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    card_id BIGINT REFERENCES cards(id) ON DELETE CASCADE,
    max_price NUMERIC(10,2),
    condition_preference TEXT,
    alert_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, card_id)
);

-- Create indexes for wishlists
CREATE INDEX IF NOT EXISTS idx_wishlists_user ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_card ON wishlists(card_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_alerts ON wishlists(alert_enabled) WHERE alert_enabled = TRUE;

-- ============================================
-- PRICING
-- ============================================

-- Price history table
CREATE TABLE IF NOT EXISTS price_history (
    id BIGSERIAL PRIMARY KEY,
    card_id BIGINT REFERENCES cards(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    price_source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(card_id, date, price_source)
);

-- Create indexes for price_history
CREATE INDEX IF NOT EXISTS idx_price_history_card ON price_history(card_id, date DESC);

-- External price sources table
CREATE TABLE IF NOT EXISTS external_price_sources (
    id BIGSERIAL PRIMARY KEY,
    card_id BIGINT REFERENCES cards(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('tcgplayer', 'cardkingdom', 'cardmarket', 'mtgstocks')),
    price_usd NUMERIC(10,2),
    price_usd_foil NUMERIC(10,2),
    price_eur NUMERIC(10,2),
    price_cad NUMERIC(10,2),
    price_cad_foil NUMERIC(10,2),
    url TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(card_id, source)
);

-- Create indexes for external_price_sources
CREATE INDEX IF NOT EXISTS idx_external_prices_card ON external_price_sources(card_id);
CREATE INDEX IF NOT EXISTS idx_external_prices_source ON external_price_sources(source);

-- ============================================
-- SEARCH & SAVED SEARCHES
-- ============================================

-- Saved searches table
CREATE TABLE IF NOT EXISTS saved_searches (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    query_params JSONB NOT NULL,
    alert_enabled BOOLEAN DEFAULT FALSE,
    last_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for saved_searches
CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_alerts ON saved_searches(alert_enabled) WHERE alert_enabled = TRUE;

-- ============================================
-- USER ADDRESSES
-- ============================================

-- User addresses table
CREATE TABLE IF NOT EXISTS user_addresses (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    company TEXT,
    street1 TEXT NOT NULL,
    street2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip TEXT NOT NULL,
    country TEXT NOT NULL,
    phone TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    address_type TEXT CHECK (address_type IN ('shipping', 'billing', 'both')) DEFAULT 'both',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for user_addresses
CREATE INDEX IF NOT EXISTS idx_user_addresses_user ON user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_default ON user_addresses(user_id, is_default) WHERE is_default = TRUE;

-- ============================================
-- DECK BUILDER
-- ============================================

-- Decks table
CREATE TABLE IF NOT EXISTS decks (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    format TEXT CHECK (format IN ('standard', 'modern', 'commander', 'legacy', 'vintage', 'pioneer', 'pauper', 'historic', 'casual')),
    description TEXT,
    commander_id BIGINT REFERENCES cards(id),
    is_public BOOLEAN DEFAULT FALSE,
    featured BOOLEAN DEFAULT FALSE,
    likes_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for decks
CREATE INDEX IF NOT EXISTS idx_decks_user ON decks(user_id);
CREATE INDEX IF NOT EXISTS idx_decks_format ON decks(format);
CREATE INDEX IF NOT EXISTS idx_decks_public ON decks(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_decks_featured ON decks(featured) WHERE featured = TRUE;

-- Deck cards table
CREATE TABLE IF NOT EXISTS deck_cards (
    id BIGSERIAL PRIMARY KEY,
    deck_id BIGINT REFERENCES decks(id) ON DELETE CASCADE,
    card_id BIGINT REFERENCES cards(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    is_commander BOOLEAN DEFAULT FALSE,
    is_sideboard BOOLEAN DEFAULT FALSE,
    board TEXT CHECK (board IN ('mainboard', 'sideboard', 'maybeboard', 'commander')) DEFAULT 'mainboard',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(deck_id, card_id, board)
);

-- Create indexes for deck_cards
CREATE INDEX IF NOT EXISTS idx_deck_cards_deck ON deck_cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_deck_cards_card ON deck_cards(card_id);

-- ============================================
-- SELLER MANAGEMENT
-- ============================================

-- Seller applications table
CREATE TABLE IF NOT EXISTS seller_applications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    business_name TEXT NOT NULL,
    business_type TEXT CHECK (business_type IN ('individual', 'business', 'online_store')) NOT NULL,
    tax_id TEXT,
    business_address JSONB,
    phone TEXT,
    website TEXT,
    description TEXT,
    experience_level TEXT,
    average_monthly_sales TEXT,
    status TEXT CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'info_requested')) DEFAULT 'pending',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES profiles(id),
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    admin_notes TEXT,
    required_documents TEXT[],
    documents_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for seller_applications
CREATE INDEX IF NOT EXISTS idx_seller_applications_user ON seller_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_applications_status ON seller_applications(status);
CREATE INDEX IF NOT EXISTS idx_seller_applications_submitted ON seller_applications(submitted_at DESC);

-- Seller documents table
CREATE TABLE IF NOT EXISTS seller_documents (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT REFERENCES seller_applications(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES profiles(id),
    verified_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for seller_documents
CREATE INDEX IF NOT EXISTS idx_seller_documents_application ON seller_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_seller_documents_user ON seller_documents(user_id);

-- Seller settings table
CREATE TABLE IF NOT EXISTS seller_settings (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    business_name TEXT,
    business_type TEXT,
    tax_id TEXT,
    payout_method TEXT CHECK (payout_method IN ('bank_transfer', 'paypal')) DEFAULT 'bank_transfer',
    payout_threshold NUMERIC(10,2) DEFAULT 25.00 CHECK (payout_threshold >= 25),
    auto_payout BOOLEAN DEFAULT FALSE,
    bank_details JSONB,
    paypal_email TEXT,
    shipping_rates JSONB,
    return_policy TEXT,
    processing_time_days INTEGER DEFAULT 2,
    vacation_mode BOOLEAN DEFAULT FALSE,
    vacation_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for seller_settings
CREATE INDEX IF NOT EXISTS idx_seller_settings_user ON seller_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_settings_auto_payout ON seller_settings(auto_payout) WHERE auto_payout = TRUE;

-- Seller payouts table
CREATE TABLE IF NOT EXISTS seller_payouts (
    id BIGSERIAL PRIMARY KEY,
    seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    fee_amount NUMERIC(10,2) DEFAULT 0,
    net_amount NUMERIC(10,2) NOT NULL,
    payout_method TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
    external_payout_id TEXT,
    external_reference TEXT,
    order_ids UUID[],
    period_start DATE,
    period_end DATE,
    initiated_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for seller_payouts
CREATE INDEX IF NOT EXISTS idx_seller_payouts_seller ON seller_payouts(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_payouts_status ON seller_payouts(status);
CREATE INDEX IF NOT EXISTS idx_seller_payouts_date ON seller_payouts(initiated_at DESC);

-- ============================================
-- REVIEWS & RATINGS
-- ============================================

-- Seller reviews table
CREATE TABLE IF NOT EXISTS seller_reviews (
    id BIGSERIAL PRIMARY KEY,
    seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    response TEXT,
    response_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id, buyer_id)
);

-- Create indexes for seller_reviews
CREATE INDEX IF NOT EXISTS idx_seller_reviews_seller ON seller_reviews(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_reviews_buyer ON seller_reviews(buyer_id);
CREATE INDEX IF NOT EXISTS idx_seller_reviews_rating ON seller_reviews(rating);

-- ============================================
-- ADMIN & LOGGING
-- ============================================

-- Admin actions table
CREATE TABLE IF NOT EXISTS admin_actions (
    id BIGSERIAL PRIMARY KEY,
    admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    target_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    target_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    target_listing_id BIGINT REFERENCES listings(id) ON DELETE SET NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for admin_actions
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_type ON admin_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_actions_date ON admin_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target_user ON admin_actions(target_user_id);

-- Login history table
CREATE TABLE IF NOT EXISTS login_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT TRUE,
    failure_reason TEXT,
    login_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for login_history
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, login_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_ip ON login_history(ip_address);

-- Security events table
CREATE TABLE IF NOT EXISTS security_events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for security_events
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_date ON security_events(created_at DESC);

-- ============================================
-- PAYMENTS & TRANSACTIONS
-- ============================================

-- Payment transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    amount NUMERIC(10,2) NOT NULL,
    currency TEXT DEFAULT 'CAD',
    payment_method TEXT,
    status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
    helcim_transaction_id TEXT UNIQUE,
    helcim_card_token TEXT,
    card_last_four TEXT,
    card_type TEXT,
    failure_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for payment_transactions
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_helcim ON payment_transactions(helcim_transaction_id);

-- Refunds table
CREATE TABLE IF NOT EXISTS refunds (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    payment_transaction_id BIGINT REFERENCES payment_transactions(id),
    amount NUMERIC(10,2) NOT NULL,
    reason TEXT,
    refund_status TEXT CHECK (refund_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    helcim_refund_id TEXT,
    initiated_by UUID REFERENCES profiles(id),
    approved_by UUID REFERENCES profiles(id),
    notes TEXT,
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for refunds
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(refund_status);

-- ============================================
-- SHIPPING
-- ============================================

-- Shipping methods table
CREATE TABLE IF NOT EXISTS shipping_methods (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    carrier TEXT,
    service_level TEXT,
    base_rate NUMERIC(10,2) NOT NULL,
    per_item_rate NUMERIC(10,2) DEFAULT 0,
    estimated_days_min INTEGER,
    estimated_days_max INTEGER,
    regions TEXT[],
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for shipping_methods
CREATE INDEX IF NOT EXISTS idx_shipping_methods_active ON shipping_methods(active) WHERE active = TRUE;

-- Shipping rates table
CREATE TABLE IF NOT EXISTS shipping_rates (
    id BIGSERIAL PRIMARY KEY,
    seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    region TEXT NOT NULL,
    base_rate NUMERIC(10,2) NOT NULL,
    per_item_rate NUMERIC(10,2) DEFAULT 0,
    free_shipping_threshold NUMERIC(10,2),
    estimated_days_min INTEGER,
    estimated_days_max INTEGER,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for shipping_rates
CREATE INDEX IF NOT EXISTS idx_shipping_rates_seller ON shipping_rates(seller_id);

-- ============================================
-- NOTIFICATIONS
-- ============================================

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    action_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read) WHERE read = FALSE;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deck_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_reviews ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public profiles are viewable" ON profiles
    FOR SELECT USING (TRUE);

-- Listings policies
CREATE POLICY "Anyone can view active listings" ON listings
    FOR SELECT USING (status = 'active');

CREATE POLICY "Sellers can create listings" ON listings
    FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own listings" ON listings
    FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their own listings" ON listings
    FOR DELETE USING (auth.uid() = seller_id);

-- Orders policies
CREATE POLICY "Users can view their own orders" ON orders
    FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can create orders" ON orders
    FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- Cart items policies
CREATE POLICY "Users can manage their own cart" ON cart_items
    FOR ALL USING (auth.uid() = user_id);

-- Wishlists policies
CREATE POLICY "Users can manage their own wishlist" ON wishlists
    FOR ALL USING (auth.uid() = user_id);

-- Saved searches policies
CREATE POLICY "Users can manage their own saved searches" ON saved_searches
    FOR ALL USING (auth.uid() = user_id);

-- User addresses policies
CREATE POLICY "Users can manage their own addresses" ON user_addresses
    FOR ALL USING (auth.uid() = user_id);

-- Decks policies
CREATE POLICY "Users can view public decks" ON decks
    FOR SELECT USING (is_public = TRUE OR auth.uid() = user_id);

CREATE POLICY "Users can manage their own decks" ON decks
    FOR ALL USING (auth.uid() = user_id);

-- Seller applications policies
CREATE POLICY "Users can view their own application" ON seller_applications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own application" ON seller_applications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own application" ON seller_applications
    FOR UPDATE USING (auth.uid() = user_id AND status IN ('pending', 'info_requested'));

-- Seller settings policies
CREATE POLICY "Sellers can view their own settings" ON seller_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Sellers can update their own settings" ON seller_settings
    FOR ALL USING (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_listings_updated_at BEFORE UPDATE ON listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON cart_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wishlists_updated_at BEFORE UPDATE ON wishlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_searches_updated_at BEFORE UPDATE ON saved_searches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_addresses_updated_at BEFORE UPDATE ON user_addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_decks_updated_at BEFORE UPDATE ON decks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seller_applications_updated_at BEFORE UPDATE ON seller_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seller_settings_updated_at BEFORE UPDATE ON seller_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seller_payouts_updated_at BEFORE UPDATE ON seller_payouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipping_methods_updated_at BEFORE UPDATE ON shipping_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipping_rates_updated_at BEFORE UPDATE ON shipping_rates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile after user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, role, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'buyer'),
        NOW(),
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update seller rating
CREATE OR REPLACE FUNCTION update_seller_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles
    SET rating = (
        SELECT AVG(rating)::NUMERIC(3,2)
        FROM seller_reviews
        WHERE seller_id = NEW.seller_id
    )
    WHERE id = NEW.seller_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update seller rating on new review
CREATE TRIGGER update_seller_rating_trigger
    AFTER INSERT OR UPDATE ON seller_reviews
    FOR EACH ROW EXECUTE FUNCTION update_seller_rating();

-- Function to log security events
CREATE OR REPLACE FUNCTION log_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.email != NEW.email OR OLD.role != NEW.role) THEN
            INSERT INTO security_events (user_id, event_type, severity, details, created_at)
            VALUES (
                NEW.id,
                'profile_modified',
                'medium',
                jsonb_build_object(
                    'old_email', OLD.email,
                    'new_email', NEW.email,
                    'old_role', OLD.role,
                    'new_role', NEW.role
                ),
                NOW()
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for profile changes
CREATE TRIGGER log_profile_changes_trigger
    AFTER UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION log_profile_changes();

-- ============================================
-- VIEWS
-- ============================================

-- View for active listings with seller info
CREATE OR REPLACE VIEW active_listings_view AS
SELECT 
    l.*,
    c.name as card_name,
    c.set_name,
    c.set_number,
    c.image_url,
    c.rarity,
    p.display_name as seller_name,
    p.rating as seller_rating,
    p.shipping_address as seller_shipping_address
FROM listings l
JOIN cards c ON l.card_id = c.id
JOIN profiles p ON l.seller_id = p.id
WHERE l.status = 'active' AND l.quantity > 0;

-- View for seller statistics
CREATE OR REPLACE VIEW seller_stats_view AS
SELECT 
    p.id as seller_id,
    p.display_name,
    p.rating,
    COUNT(DISTINCT l.id) as active_listings_count,
    COUNT(DISTINCT o.id) as total_orders_count,
    COALESCE(SUM(o.total_amount), 0) as total_sales_amount,
    COUNT(DISTINCT CASE WHEN o.status = 'pending' THEN o.id END) as pending_orders_count
FROM profiles p
LEFT JOIN listings l ON p.id = l.seller_id AND l.status = 'active'
LEFT JOIN orders o ON p.id = o.seller_id
WHERE p.role = 'seller' AND p.approved = true
GROUP BY p.id, p.display_name, p.rating;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant access to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Record migration completion
COMMENT ON SCHEMA public IS 'MTG Marketplace - Initial Schema Migration - Version 1.0';
```

---

## Rollback Instructions (if needed)

To rollback this migration, you would need to drop all tables in reverse order of dependencies:

```sql
-- This is for documentation purposes only
-- DO NOT RUN unless you need to completely reset the database

/*
DROP VIEW IF EXISTS seller_stats_view CASCADE;
DROP VIEW IF EXISTS active_listings_view CASCADE;

DROP TRIGGER IF EXISTS log_profile_changes_trigger ON profiles;
DROP TRIGGER IF EXISTS update_seller_rating_trigger ON seller_reviews;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP FUNCTION IF EXISTS log_profile_changes();
DROP FUNCTION IF EXISTS update_seller_rating();
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS update_updated_at_column();

DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS shipping_rates CASCADE;
DROP TABLE IF EXISTS shipping_methods CASCADE;
DROP TABLE IF EXISTS refunds CASCADE;
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS security_events CASCADE;
DROP TABLE IF EXISTS login_history CASCADE;
DROP TABLE IF EXISTS admin_actions CASCADE;
DROP TABLE IF EXISTS seller_reviews CASCADE;
DROP TABLE IF EXISTS seller_payouts CASCADE;
DROP TABLE IF EXISTS seller_settings CASCADE;
DROP TABLE IF EXISTS seller_documents CASCADE;
DROP TABLE IF EXISTS seller_applications CASCADE;
DROP TABLE IF EXISTS deck_cards CASCADE;
DROP TABLE IF EXISTS decks CASCADE;
DROP TABLE IF EXISTS user_addresses CASCADE;
DROP TABLE IF EXISTS saved_searches CASCADE;
DROP TABLE IF EXISTS external_price_sources CASCADE;
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS wishlists CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS listings CASCADE;
DROP TABLE IF EXISTS cards CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

DROP EXTENSION IF EXISTS pg_trgm;
DROP EXTENSION IF EXISTS "uuid-ossp";
*/
```
CREATE TABLE IF NOT EXISTS listings (
    id BIGSERIAL PRIMARY KEY,
    card_id BIGINT REFERENCES cards(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    condition TEXT CHECK (condition IN ('Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged')),
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    treatment TEXT DEFAULT 'normal',
    language TEXT DEFAULT 'English',
    notes TEXT,
    status TEXT CHECK (status IN ('active', 'sold', 'cancelled')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for listings
CREATE INDEX IF NOT EXISTS idx_listings_card ON listings(card_id);
CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    buyer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    total_amount NUMERIC(10,2) NOT NULL,
    status TEXT CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')) DEFAULT 'pending',
    shipping_address_id BIGINT,
    tracking_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
    listing_id BIGINT REFERENCES listings(id) ON DELETE SET NULL,
    card_id BIGINT REFERENCES cards(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL,
    price_at_purchase NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cart items table
CREATE TABLE IF NOT EXISTS cart_items (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    listing_id BIGINT REFERENCES listings(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, listing_id)
);

-- Wishlists table
CREATE TABLE IF NOT EXISTS wishlists (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    card_id BIGINT REFERENCES cards(id) ON DELETE CASCADE,
    max_price NUMERIC(10,2),
    condition_preference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, card_id)
);

-- Price history table
CREATE TABLE IF NOT EXISTS price_history (
    id BIGSERIAL PRIMARY KEY,
    card_id BIGINT REFERENCES cards(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    price_source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(card_id, date, price_source)
);

-- External price sources table
CREATE TABLE IF NOT EXISTS external_price_sources (
    id BIGSERIAL PRIMARY KEY,
    card_id BIGINT REFERENCES cards(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('tcgplayer', 'cardkingdom', 'cardmarket', 'mtgstocks')),
    price_usd NUMERIC(10,2),
    price_usd_foil NUMERIC(10,2),
    price_eur NUMERIC(10,2),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(card_id, source)
);

-- Saved searches table
CREATE TABLE IF NOT EXISTS saved_searches (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    query_params JSONB NOT NULL,
    alert_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User addresses table
CREATE TABLE IF NOT EXISTS user_addresses (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL,
    state_province TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    country TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Decks table
CREATE TABLE IF NOT EXISTS decks (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    format TEXT,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deck cards table
CREATE TABLE IF NOT EXISTS deck_cards (
    id BIGSERIAL PRIMARY KEY,
    deck_id BIGINT REFERENCES decks(id) ON DELETE CASCADE,
    card_id BIGINT REFERENCES cards(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    is_commander BOOLEAN DEFAULT FALSE,
    board TEXT CHECK (board IN ('mainboard', 'sideboard', 'maybeboard')) DEFAULT 'mainboard',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(deck_id, card_id, board)
);

-- Row Level Security (RLS) Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deck_cards ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Listings policies
CREATE POLICY "Anyone can view active listings" ON listings
    FOR SELECT USING (status = 'active');

CREATE POLICY "Sellers can create listings" ON listings
    FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own listings" ON listings
    FOR UPDATE USING (auth.uid() = seller_id);

-- Cart items policies
CREATE POLICY "Users can manage their own cart" ON cart_items
    FOR ALL USING (auth.uid() = user_id);

-- Wishlists policies
CREATE POLICY "Users can manage their own wishlist" ON wishlists
    FOR ALL USING (auth.uid() = user_id);

-- Saved searches policies
CREATE POLICY "Users can manage their own saved searches" ON saved_searches
    FOR ALL USING (auth.uid() = user_id);

-- User addresses policies
CREATE POLICY "Users can manage their own addresses" ON user_addresses
    FOR ALL USING (auth.uid() = user_id);

-- Decks policies
CREATE POLICY "Users can view public decks" ON decks
    FOR SELECT USING (is_public = TRUE OR auth.uid() = user_id);

CREATE POLICY "Users can manage their own decks" ON decks
    FOR ALL USING (auth.uid() = user_id);

-- Functions and triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_listings_updated_at BEFORE UPDATE ON listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON cart_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wishlists_updated_at BEFORE UPDATE ON wishlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_searches_updated_at BEFORE UPDATE ON saved_searches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_addresses_updated_at BEFORE UPDATE ON user_addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_decks_updated_at BEFORE UPDATE ON decks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Phase 3: Migration Workflow (Ongoing)

#### Creating New Migrations

```bash
# Create a new migration
supabase migration new add_seller_analytics_table
# or if using npm: npx supabase migration new add_seller_analytics_table

# This creates: supabase/migrations/[timestamp]_add_seller_analytics_table.sql
```

**Example Migration File**:

```sql
-- Migration: Add seller analytics table
-- Created: 2025-01-15

CREATE TABLE seller_analytics (
    id BIGSERIAL PRIMARY KEY,
    seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    total_sales NUMERIC(10,2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    average_rating NUMERIC(3,2),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_seller_analytics_seller ON seller_analytics(seller_id);

-- Add RLS
ALTER TABLE seller_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view their own analytics" ON seller_analytics
    FOR SELECT USING (auth.uid() = seller_id);

-- Add trigger
CREATE TRIGGER update_seller_analytics_updated_at 
    BEFORE UPDATE ON seller_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### Running Migrations

```bash
# Apply all pending migrations locally
supabase db push
# or if using npm: npx supabase db push

# Apply migrations to remote (production)
supabase db push --db-url "postgresql://[connection-string]"
# or if using npm: npx supabase db push --db-url "postgresql://[connection-string]"

# Or use the Supabase dashboard to run migrations (recommended for production)
```

**Important**: For production deployments, it's recommended to use the Supabase Dashboard's migration interface or ensure you have proper backups before running migrations via CLI.

---

### Phase 4: Migration Best Practices

#### 4.1 Migration File Naming Convention

```
[timestamp]_[action]_[subject].sql

Examples:
20250115100000_create_seller_analytics.sql
20250115110000_add_index_cards_name.sql
20250115120000_alter_listings_add_featured.sql
20250115130000_drop_unused_table.sql
```

#### 4.2 Migration Content Structure

```sql
-- Migration: [Description]
-- Created: [Date]
-- Author: [Your Name]

-- ============================================
-- UP Migration
-- ============================================

-- Your migration code here
CREATE TABLE example (...);

-- ============================================
-- DOWN Migration (for rollback)
-- ============================================

-- DROP TABLE IF EXISTS example;
-- Note: Supabase doesn't use DOWN migrations by default
-- but documenting rollback steps is good practice
```

#### 4.3 Safety Checklist

Before running any migration:

- [ ] **Backup**: Always backup production database before migrations
- [ ] **Test Locally**: Run migration on local Supabase instance first
- [ ] **Staging**: Run on staging environment if available
- [ ] **Review**: Have another developer review the migration
- [ ] **Rollback Plan**: Document how to undo the migration
- [ ] **Data Impact**: Consider impact on existing data
- [ ] **Downtime**: Estimate any required downtime

#### 4.4 Common Migration Patterns

**Adding a Column:**
```sql
ALTER TABLE cards 
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
```

**Adding an Index:**
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_market_price 
ON cards(market_price) 
WHERE market_price IS NOT NULL;
```

**Modifying a Column:**
```sql
-- Be careful with existing data!
ALTER TABLE listings 
ALTER COLUMN price TYPE NUMERIC(12,2);
```

**Adding a Foreign Key:**
```sql
ALTER TABLE order_items
ADD CONSTRAINT fk_order_items_shipping
FOREIGN KEY (shipping_id) 
REFERENCES shipping_methods(id)
ON DELETE SET NULL;
```

---

### Phase 5: Code Integration

#### Update Backend Code

**File**: `backend/config/database.js` (new file)

```javascript
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

// Migration status check utility
export async function checkMigrationStatus() {
  try {
    const { data, error } = await supabase
      .from('_migrations')
      .select('*')
      .order('version', { ascending: false })
      .limit(1)

    if (error) throw error
    
    return {
      latestVersion: data[0]?.version,
      appliedAt: data[0]?.applied_at
    }
  } catch (error) {
    console.error('Migration status check failed:', error)
    return null
  }
}
```

#### Remove Table Existence Checks

**Before** (in `backend/routes/search.js`):
```javascript
// Check if saved_searches table exists
const { data: tables, error: tableError } = await supabase
  .from('information_schema.tables')
  .select('table_name')
  .eq('table_schema', 'public')
  .eq('table_name', 'saved_searches')

if (tableError || !tables || tables.length === 0) {
  return res.status(501).json({ 
    error: 'Saved searches feature not available.' 
  })
}
```

**After**:
```javascript
// Assume table exists (managed by migrations)
const { data, error } = await supabase
  .from('saved_searches')
  .insert({ /* ... */ })

if (error) {
  console.error('Saved search error:', error)
  return res.status(500).json({ error: error.message })
}
```

---

### Phase 6: Deployment Strategy

#### 6.1 Local Development

```bash
# Start local Supabase
supabase start
# or if using npm: npx supabase start

# Apply migrations
supabase db reset  # Resets and applies all migrations
# or if using npm: npx supabase db reset

# Stop local Supabase
supabase stop
# or if using npm: npx supabase stop
```

**Note**: Local Supabase requires Docker to be running on your machine.

#### 6.2 Staging Environment

```bash
# Link to staging project
supabase link --project-ref STAGING_PROJECT_REF
# or if using npm: npx supabase link --project-ref STAGING_PROJECT_REF

# Push migrations
supabase db push
# or if using npm: npx supabase db push
```

#### 6.3 Production Deployment

```bash
# 1. Backup production database (via Supabase Dashboard or CLI)
supabase db dump --db-url "postgresql://[prod-connection]" > backup.sql
# or if using npm: npx supabase db dump --db-url "postgresql://[prod-connection]" > backup.sql

# 2. Link to production
supabase link --project-ref PROD_PROJECT_REF
# or if using npm: npx supabase link --project-ref PROD_PROJECT_REF

# 3. Review pending migrations
supabase migration list
# or if using npm: npx supabase migration list

# 4. Apply migrations (consider maintenance window)
supabase db push
# or if using npm: npx supabase db push

# 5. Verify application functionality
# 6. Monitor for errors
```

**Best Practice**: For production, consider using the Supabase Dashboard's migration interface which provides additional safety features and visibility.

---

## 4. Monitoring & Maintenance

### Migration Tracking Table

Supabase automatically creates a `_migrations` table to track applied migrations:

```sql
SELECT * FROM _migrations ORDER BY version DESC;
```

### Health Check Endpoint

**File**: `backend/routes/health.js`

```javascript
import express from 'express'
import { checkMigrationStatus } from '../config/database.js'

const router = express.Router()

router.get('/health', async (req, res) => {
  try {
    const migrationStatus = await checkMigrationStatus()
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        latestMigration: migrationStatus?.latestVersion
      }
    })
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    })
  }
})

export default router
```

---

## 5. Rollback Procedures

### Manual Rollback

If a migration causes issues:

1. **Immediate**: Restore from backup
   ```bash
   psql -h [host] -U postgres -d postgres < backup.sql
   ```

2. **Surgical**: Create a reverse migration
   ```bash
   supabase migration new rollback_feature_x
   ```

3. **Document**: Always document what went wrong and how it was fixed

---

## 6. Team Workflow

### Git Branch Strategy

```
main (production)
├── develop (staging)
└── feature/add-analytics-table (developer)
    └── includes migration file
```

### Pull Request Checklist

- [ ] Migration file included in PR
- [ ] Migration tested locally
- [ ] Migration reviewed by team
- [ ] Rollback procedure documented
- [ ] Schema changes documented in PR description

---

## 7. Documentation Standards

### Migration Documentation

Each migration should include:

```sql
/*
 * Migration: Add seller analytics table
 * Ticket: JIRA-123
 * Author: Developer Name
 * Date: 2025-01-15
 * 
 * Description:
 * Adds a new table to track seller performance metrics including
 * total sales, order count, and average rating.
 *
 * Dependencies:
 * - Requires profiles table
 * - Requires orders table
 *
 * Rollback:
 * DROP TABLE IF EXISTS seller_analytics;
 *
 * Testing:
 * 1. Verify table creation
 * 2. Test RLS policies
 * 3. Verify triggers work correctly
 */
```

---

## 8. Troubleshooting

### Common Issues

**Issue**: Migration fails on production
```bash
# Solution: Check logs
supabase functions logs
# or if using npm: npx supabase functions logs

# Restore from backup if needed
psql -h [host] -U postgres -d postgres < backup.sql
```

**Issue**: Schema drift between environments
```bash
# Solution: Reset local to match remote
supabase db reset
# or if using npm: npx supabase db reset
```

**Issue**: Conflicting migrations from multiple developers
```bash
# Solution: Rebase and renumber migrations
# Keep migration order consistent with git history
# Coordinate with team to avoid simultaneous migration creation
```

**Issue**: "Command not found" when using npm-installed Supabase
```bash
# Solution: Use npx prefix or npm scripts
npx supabase --version

# Or add to package.json scripts and use:
npm run supabase -- --version
```

---

## 9. Timeline & Milestones

### Week 1: Setup
- Install Supabase CLI
- Initialize project
- Create initial migration
- Document current schema

### Week 2: Migration
- Test initial migration locally
- Apply to staging
- Apply to production (with backup)
- Verify all functionality

### Week 3: Team Training
- Train team on new workflow
- Update documentation
- Create migration templates
- Set up CI/CD integration (optional)

### Week 4+: Ongoing
- Use migration system for all schema changes
- Regular review of migration practices
- Optimize and refine as needed

---

## 10. Success Metrics

- **Zero** manual schema changes in production
- **100%** of schema changes tracked in version control
- **< 5 minutes** migration application time
- **Zero** data loss from migrations
- **100%** team adoption of migration workflow

---

## 11. Additional Resources

- [Supabase Migration Documentation](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Don't_Do_This)
- [Database Migration Patterns](https://martinfowler.com/articles/evodb.html)

---

## 12. Next Steps

1. **Immediate**: Install Supabase CLI and initialize project
2. **Short-term**: Create and test initial migration
3. **Medium-term**: Migrate one feature using new workflow
4. **Long-term**: Fully adopt migration system for all database changes

---

## Appendix: Quick Reference Commands

```bash
# Installation (choose one method)
# Homebrew: brew install supabase/tap/supabase
# Scoop: scoop install supabase
# npm project: npm install --save-dev supabase (then use npx or npm scripts)

# Initialize
supabase init
supabase link --project-ref YOUR_REF

# Create migration
supabase migration new migration_name

# Apply migrations
supabase db push

# Reset local database
supabase db reset

# View migration status
supabase migration list

# Dump schema
supabase db dump --local

# Start/stop local Supabase
supabase start
supabase stop
```

**Note**: If using npm project installation, prefix commands with `npx` or use npm scripts:
```bash
npx supabase init
# or
npm run supabase:init
```

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-15  
**Status**: Ready for Implementation
