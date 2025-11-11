-- =====================================================
-- Database Cleanup and Optimization Migration
-- MTG Marketplace
-- Date: 2025-11-03
-- =====================================================

-- This migration:
-- 1. Removes duplicate and unused columns
-- 2. Adds missing essential columns
-- 3. Adds performance indexes
-- 4. Consolidates redundant data

BEGIN;

-- =====================================================
-- PART 1: REMOVE DUPLICATE AND UNUSED COLUMNS
-- =====================================================

-- listings table cleanup
ALTER TABLE listings DROP COLUMN IF EXISTS views_count; -- duplicate of view_count
ALTER TABLE listings DROP COLUMN IF EXISTS favorited_count; -- feature not implemented
ALTER TABLE listings DROP COLUMN IF EXISTS watchlist_count; -- feature not implemented
ALTER TABLE listings DROP COLUMN IF EXISTS deleted_at; -- using status='removed'

-- orders table cleanup
ALTER TABLE orders DROP COLUMN IF EXISTS payment_intent_id; -- using helcim_transaction_id
ALTER TABLE orders DROP COLUMN IF EXISTS tracking_number; -- use order_items.tracking_number instead

-- profiles table cleanup (consolidating with other tables)
ALTER TABLE profiles DROP COLUMN IF EXISTS shipping_preferences; -- use seller_settings table
ALTER TABLE profiles DROP COLUMN IF EXISTS default_shipping_method; -- use seller_settings table
ALTER TABLE profiles DROP COLUMN IF EXISTS business_name; -- use seller_settings table
ALTER TABLE profiles DROP COLUMN IF EXISTS website; -- use seller_settings table
ALTER TABLE profiles DROP COLUMN IF EXISTS payout_settings; -- use payout_settings table
ALTER TABLE profiles DROP COLUMN IF EXISTS notification_preferences; -- merge with email_preferences
ALTER TABLE profiles DROP COLUMN IF EXISTS business_info; -- use seller_settings table

-- seller_applications cleanup
ALTER TABLE seller_applications DROP COLUMN IF EXISTS approved_by; -- use reviewed_by
ALTER TABLE seller_applications DROP COLUMN IF EXISTS rejected_by; -- use reviewed_by
ALTER TABLE seller_applications DROP COLUMN IF EXISTS info_requested_by; -- use reviewed_by
ALTER TABLE seller_applications DROP COLUMN IF EXISTS references; -- never used
ALTER TABLE seller_applications DROP COLUMN IF EXISTS required_documents; -- using seller_documents table

-- cards table cleanup
ALTER TABLE cards DROP COLUMN IF EXISTS price_updated_at; -- duplicate of market_price_updated_at

-- Consider removing if not planning to implement (comment out if keeping):
-- ALTER TABLE cards DROP COLUMN IF EXISTS treatment;
-- ALTER TABLE cards DROP COLUMN IF EXISTS border_color;
-- ALTER TABLE cards DROP COLUMN IF EXISTS frame;
-- ALTER TABLE cards DROP COLUMN IF EXISTS security_stamp;
-- ALTER TABLE cards DROP COLUMN IF EXISTS frame_effects;
-- ALTER TABLE cards DROP COLUMN IF EXISTS promo_types;
-- ALTER TABLE cards DROP COLUMN IF EXISTS multiverse_ids;
-- ALTER TABLE cards DROP COLUMN IF EXISTS mtgo_id;
-- ALTER TABLE cards DROP COLUMN IF EXISTS arena_id;
-- ALTER TABLE cards DROP COLUMN IF EXISTS tcgplayer_id;
-- ALTER TABLE cards DROP COLUMN IF EXISTS cardmarket_id;
-- ALTER TABLE cards DROP COLUMN IF EXISTS lang;
-- ALTER TABLE cards DROP COLUMN IF EXISTS digital;
-- ALTER TABLE cards DROP COLUMN IF EXISTS oversized;
-- ALTER TABLE cards DROP COLUMN IF EXISTS promo;
-- ALTER TABLE cards DROP COLUMN IF EXISTS reprint;
-- ALTER TABLE cards DROP COLUMN IF EXISTS variation;
-- ALTER TABLE cards DROP COLUMN IF EXISTS scryfall_updated_at;
-- ALTER TABLE cards DROP COLUMN IF EXISTS updated_at;

-- =====================================================
-- PART 2: ADD MISSING ESSENTIAL COLUMNS
-- =====================================================

-- order_items: Add snapshot data to preserve order history
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES profiles(id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS card_name text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS card_image text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS condition text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS foil boolean DEFAULT false;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS language text DEFAULT 'English';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'pending';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS payout_amount numeric(10,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS payout_id uuid REFERENCES seller_payouts(id);

-- Populate seller_id from listings
UPDATE order_items oi
SET seller_id = l.seller_id
FROM listings l
WHERE oi.listing_id = l.id
AND oi.seller_id IS NULL;

-- orders: Add customer experience features
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery_date date;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_notes text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_gift boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_message text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) DEFAULT 0;

-- profiles: Core features
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verified_email boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_orders integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_spent numeric(12,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seller_since timestamp with time zone;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS response_rate numeric(5,2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avg_response_time_hours numeric(8,2);

-- cards: Engagement and discovery features
ALTER TABLE cards ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS average_rating numeric(3,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS rating_count integer DEFAULT 0;

-- listings: Enhanced features
ALTER TABLE listings ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS last_price_update timestamp with time zone;

-- wishlists: Better functionality
ALTER TABLE wishlists ADD COLUMN IF NOT EXISTS priority integer DEFAULT 0;
ALTER TABLE wishlists ADD COLUMN IF NOT EXISTS quantity_wanted integer DEFAULT 1;
ALTER TABLE wishlists ADD COLUMN IF NOT EXISTS foil_only boolean DEFAULT false;

-- Fix wishlists.updated_at type (date -> timestamp)
ALTER TABLE wishlists ALTER COLUMN updated_at TYPE timestamp with time zone 
USING updated_at::timestamp with time zone;
ALTER TABLE wishlists ALTER COLUMN updated_at SET DEFAULT now();

-- =====================================================
-- PART 3: ADD PERFORMANCE INDEXES
-- =====================================================

-- Cards table indexes
CREATE INDEX IF NOT EXISTS idx_cards_colors ON cards USING GIN (colors) 
WHERE colors IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cards_color_identity ON cards USING GIN (color_identity)
WHERE color_identity IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cards_featured ON cards (featured, created_at DESC) 
WHERE featured = true;

CREATE INDEX IF NOT EXISTS idx_cards_view_count ON cards (view_count DESC);

CREATE INDEX IF NOT EXISTS idx_cards_keywords_gin ON cards USING GIN (keywords)
WHERE keywords IS NOT NULL;

-- Orders table indexes
CREATE INDEX IF NOT EXISTS idx_orders_payment_status_date 
ON orders(payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status_dates 
ON orders (status, shipped_at DESC, delivered_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_is_gift 
ON orders (is_gift) WHERE is_gift = true;

CREATE INDEX IF NOT EXISTS idx_orders_discount_code 
ON orders (discount_code) WHERE discount_code IS NOT NULL;

-- Order items table indexes
CREATE INDEX IF NOT EXISTS idx_order_items_seller 
ON order_items (seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_payout_status 
ON order_items (payout_status) WHERE payout_status != 'completed';

CREATE INDEX IF NOT EXISTS idx_order_items_order_listing 
ON order_items(order_id, listing_id);

-- Listings table indexes
CREATE INDEX IF NOT EXISTS idx_listings_seller_active_price 
ON listings(seller_id, status, price) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_listings_location 
ON listings (location) WHERE location IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_sales_count 
ON listings (sales_count DESC) WHERE sales_count > 0;

-- Profiles table indexes
CREATE INDEX IF NOT EXISTS idx_profiles_verified_email 
ON profiles (verified_email) WHERE verified_email = true;

CREATE INDEX IF NOT EXISTS idx_profiles_seller_since 
ON profiles (seller_since) WHERE seller_since IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_avatar 
ON profiles (avatar_url) WHERE avatar_url IS NOT NULL;

-- Wishlists table indexes
CREATE INDEX IF NOT EXISTS idx_wishlists_priority 
ON wishlists (user_id, priority DESC);

-- Helcim transaction logs index
CREATE INDEX IF NOT EXISTS idx_helcim_logs_user_date
ON helcim_transaction_logs(user_id, created_at DESC);

-- Price history index for recent data
CREATE INDEX IF NOT EXISTS idx_price_history_card_recent
ON price_history(card_id, date DESC)
WHERE date >= CURRENT_DATE - INTERVAL '90 days';

-- =====================================================
-- PART 4: UPDATE CONSTRAINTS AND CHECKS
-- =====================================================

-- Add check constraint for payout_status
ALTER TABLE order_items 
ADD CONSTRAINT order_items_payout_status_check 
CHECK (payout_status IN ('pending', 'processing', 'completed', 'failed'));

-- Add check constraint for discount_amount
ALTER TABLE orders 
ADD CONSTRAINT orders_discount_valid 
CHECK (discount_amount >= 0 AND discount_amount <= subtotal);

-- =====================================================
-- PART 5: CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to update order_items snapshot data (call this when creating orders)
CREATE OR REPLACE FUNCTION populate_order_item_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  -- Populate snapshot data from listing and card
  SELECT 
    l.seller_id,
    c.name,
    c.image_url,
    l.condition,
    l.foil,
    l.language
  INTO 
    NEW.seller_id,
    NEW.card_name,
    NEW.card_image,
    NEW.condition,
    NEW.foil,
    NEW.language
  FROM listings l
  JOIN cards c ON l.card_id = c.id
  WHERE l.id = NEW.listing_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-populate order item snapshots
DROP TRIGGER IF EXISTS trigger_populate_order_item_snapshot ON order_items;
CREATE TRIGGER trigger_populate_order_item_snapshot
  BEFORE INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION populate_order_item_snapshot();

-- Function to update profile seller_since when approved
CREATE OR REPLACE FUNCTION set_seller_since()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'seller' AND OLD.role != 'seller' THEN
    NEW.seller_since = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for seller_since
DROP TRIGGER IF EXISTS trigger_set_seller_since ON profiles;
CREATE TRIGGER trigger_set_seller_since
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_seller_since();

-- Function to track listing price changes
CREATE OR REPLACE FUNCTION track_listing_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    NEW.last_price_update = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for price tracking
DROP TRIGGER IF EXISTS trigger_track_listing_price_change ON listings;
CREATE TRIGGER trigger_track_listing_price_change
  BEFORE UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION track_listing_price_change();

-- =====================================================
-- PART 6: DATA MIGRATION (if needed)
-- =====================================================

-- Update existing order_items with snapshot data
UPDATE order_items oi
SET 
  card_name = c.name,
  card_image = c.image_url,
  condition = l.condition,
  foil = l.foil,
  language = l.language
FROM listings l
JOIN cards c ON l.card_id = c.id
WHERE oi.listing_id = l.id
AND oi.card_name IS NULL;

-- Set seller_since for existing sellers
UPDATE profiles
SET seller_since = created_at
WHERE role = 'seller'
AND seller_since IS NULL;

-- Initialize listing price update timestamp
UPDATE listings
SET last_price_update = updated_at
WHERE last_price_update IS NULL;

-- =====================================================
-- PART 7: ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN order_items.seller_id IS 'Denormalized seller ID for easier queries';
COMMENT ON COLUMN order_items.card_name IS 'Snapshot of card name at time of order';
COMMENT ON COLUMN order_items.card_image IS 'Snapshot of card image at time of order';
COMMENT ON COLUMN order_items.payout_status IS 'Status of seller payout for this item';
COMMENT ON COLUMN order_items.payout_amount IS 'Amount paid to seller (after fees)';

COMMENT ON COLUMN orders.estimated_delivery_date IS 'Estimated delivery date shown to customer';
COMMENT ON COLUMN orders.buyer_notes IS 'Special instructions from buyer';
COMMENT ON COLUMN orders.is_gift IS 'Whether this order is a gift';
COMMENT ON COLUMN orders.gift_message IS 'Gift message to include';
COMMENT ON COLUMN orders.discount_code IS 'Coupon/discount code applied';
COMMENT ON COLUMN orders.discount_amount IS 'Discount amount in same currency';

COMMENT ON COLUMN profiles.avatar_url IS 'URL to user profile picture';
COMMENT ON COLUMN profiles.verified_email IS 'Whether email has been verified';
COMMENT ON COLUMN profiles.verified_at IS 'When email was verified';
COMMENT ON COLUMN profiles.total_orders IS 'Total number of orders placed (buyers)';
COMMENT ON COLUMN profiles.total_spent IS 'Total amount spent (buyers)';
COMMENT ON COLUMN profiles.seller_since IS 'When user became a seller';
COMMENT ON COLUMN profiles.response_rate IS 'Percentage of messages responded to';
COMMENT ON COLUMN profiles.avg_response_time_hours IS 'Average response time in hours';

COMMENT ON COLUMN cards.featured IS 'Whether card is featured on homepage';
COMMENT ON COLUMN cards.view_count IS 'Number of times card page viewed';
COMMENT ON COLUMN cards.average_rating IS 'Average user rating';
COMMENT ON COLUMN cards.rating_count IS 'Number of ratings';

COMMENT ON COLUMN listings.description IS 'Seller notes about this specific listing';
COMMENT ON COLUMN listings.location IS 'Physical location of item for shipping estimates';
COMMENT ON COLUMN listings.last_price_update IS 'When seller last changed the price';

COMMENT ON COLUMN wishlists.priority IS 'User-defined priority/ordering';
COMMENT ON COLUMN wishlists.quantity_wanted IS 'How many copies wanted';
COMMENT ON COLUMN wishlists.foil_only IS 'Only interested in foil version';

-- =====================================================
-- PART 8: GRANT PERMISSIONS
-- =====================================================

-- Ensure RLS is enabled on all tables
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Grant appropriate permissions (adjust as needed)
GRANT SELECT, INSERT, UPDATE ON order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON orders TO authenticated;
GRANT SELECT, UPDATE ON profiles TO authenticated;
GRANT SELECT ON cards TO authenticated, anon;
GRANT SELECT ON listings TO authenticated, anon;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Run these after migration to verify:

-- Check for NULL seller_ids in order_items
-- SELECT COUNT(*) FROM order_items WHERE seller_id IS NULL;

-- Check column removals
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'listings' AND column_name IN ('views_count', 'favorited_count');

-- Check new indexes
-- SELECT indexname FROM pg_indexes WHERE tablename = 'cards' AND indexname LIKE 'idx_cards_%';

COMMIT;

-- =====================================================
-- ROLLBACK SCRIPT (In case of issues)
-- =====================================================

/*
BEGIN;

-- Restore removed columns (if needed - only if you have data to restore)
-- ALTER TABLE listings ADD COLUMN views_count integer DEFAULT 0;
-- ALTER TABLE orders ADD COLUMN payment_intent_id character varying(255);
-- etc...

-- Remove added columns
ALTER TABLE order_items DROP COLUMN IF EXISTS seller_id;
ALTER TABLE order_items DROP COLUMN IF EXISTS card_name;
ALTER TABLE order_items DROP COLUMN IF EXISTS card_image;
ALTER TABLE order_items DROP COLUMN IF EXISTS condition;
ALTER TABLE order_items DROP COLUMN IF EXISTS foil;
ALTER TABLE order_items DROP COLUMN IF EXISTS language;
ALTER TABLE order_items DROP COLUMN IF EXISTS payout_status;
ALTER TABLE order_items DROP COLUMN IF EXISTS payout_amount;

ALTER TABLE orders DROP COLUMN IF EXISTS estimated_delivery_date;
ALTER TABLE orders DROP COLUMN IF EXISTS buyer_notes;
ALTER TABLE orders DROP COLUMN IF EXISTS is_gift;
ALTER TABLE orders DROP COLUMN IF EXISTS gift_message;
ALTER TABLE orders DROP COLUMN IF EXISTS discount_code;
ALTER TABLE orders DROP COLUMN IF EXISTS discount_amount;

ALTER TABLE profiles DROP COLUMN IF EXISTS avatar_url;
ALTER TABLE profiles DROP COLUMN IF EXISTS verified_email;
ALTER TABLE profiles DROP COLUMN IF EXISTS verified_at;
ALTER TABLE profiles DROP COLUMN IF EXISTS total_orders;
ALTER TABLE profiles DROP COLUMN IF EXISTS total_spent;
ALTER TABLE profiles DROP COLUMN IF EXISTS seller_since;
ALTER TABLE profiles DROP COLUMN IF EXISTS response_rate;
ALTER TABLE profiles DROP COLUMN IF EXISTS avg_response_time_hours;

ALTER TABLE cards DROP COLUMN IF EXISTS featured;
ALTER TABLE cards DROP COLUMN IF EXISTS view_count;
ALTER TABLE cards DROP COLUMN IF EXISTS average_rating;
ALTER TABLE cards DROP COLUMN IF EXISTS rating_count;

ALTER TABLE listings DROP COLUMN IF EXISTS description;
ALTER TABLE listings DROP COLUMN IF EXISTS location;
ALTER TABLE listings DROP COLUMN IF EXISTS last_price_update;

ALTER TABLE wishlists DROP COLUMN IF EXISTS priority;
ALTER TABLE wishlists DROP COLUMN IF EXISTS quantity_wanted;
ALTER TABLE wishlists DROP COLUMN IF EXISTS foil_only;

-- Drop added indexes
DROP INDEX IF EXISTS idx_cards_colors;
DROP INDEX IF EXISTS idx_cards_color_identity;
DROP INDEX IF EXISTS idx_cards_featured;
-- etc...

-- Drop added functions and triggers
DROP TRIGGER IF EXISTS trigger_populate_order_item_snapshot ON order_items;
DROP FUNCTION IF EXISTS populate_order_item_snapshot();
DROP TRIGGER IF EXISTS trigger_set_seller_since ON profiles;
DROP FUNCTION IF EXISTS set_seller_since();
DROP TRIGGER IF EXISTS trigger_track_listing_price_change ON listings;
DROP FUNCTION IF EXISTS track_listing_price_change();

COMMIT;
*/
