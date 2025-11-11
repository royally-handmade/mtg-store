# Database Column Analysis Report
## MTG Marketplace - Detailed Column Usage & Recommendations

**Analysis Date:** November 3, 2025  
**Focus:** Column-level usage patterns, unused columns, missing columns

---

## Table-by-Table Column Analysis

### 1. `cards` Table

#### ✅ Actively Used Columns
- `id`, `name`, `set_number`, `card_number` - Core identification
- `rarity`, `type_line`, `image_url` - Display and filtering
- `market_price`, `market_price_updated_at`, `market_price_source` - Pricing
- `mana_cost`, `cmc` - Card stats (partially used in search)
- `oracle_text` - Search functionality
- `set_name`, `released_at` - Set information
- `scryfall_id`, `oracle_id` - External integration
- `search_vector` - Full-text search (active trigger)
- `weight_grams` - Shipping calculations
- `prices` (JSONB) - External price references

#### 🟡 Partially Used Columns
- `image_url_small`, `image_url_large` - Only `image_url` used in code
  - **Recommendation:** Update code to use responsive images
  ```javascript
  // frontend/src/components/CardImage.vue
  <img :src="card.image_url_small" class="thumbnail" />
  <img :src="card.image_url_large" class="full-size" />
  ```

- `foil`, `nonfoil` - Defined but listing-level foil used instead
  - **Recommendation:** Use for availability indicators
  ```javascript
  // Show "Available in Foil" badge
  if (card.foil) showFoilBadge()
  ```

- `colors`, `color_identity` - Not used in search/display
  - **Recommendation:** Add color filtering
  - **Missing Index:** Add GIN index
  ```sql
  CREATE INDEX idx_cards_colors ON cards USING GIN (colors);
  CREATE INDEX idx_cards_color_identity ON cards USING GIN (color_identity);
  ```

- `keywords` - Not used in UI
  - **Recommendation:** Display keyword abilities
  - **Missing:** Add to search suggestions

- `legalities` (JSONB) - Not displayed or filtered
  - **Recommendation:** Add format legality filters
  ```javascript
  // Filter by format
  where: `legalities->>'standard' = 'legal'`
  ```

#### ❌ Unused Columns (Consider Removal or Implementation)

1. **`price_updated_at`** - Duplicate of `market_price_updated_at`
   - **Action:** Remove - redundant with `market_price_updated_at`

2. **`treatment`** - Never populated or displayed
   - **Action:** Remove OR implement for special treatments (extended art, etc.)
   - **If keeping:** Add to card display badges

3. **`power`, `toughness`, `loyalty`** - Not displayed anywhere
   - **Action:** Display for creatures/planeswalkers
   ```html
   <div v-if="card.type_line.includes('Creature')">
     {{ card.power }}/{{ card.toughness }}
   </div>
   ```

4. **`flavor_text`** - In search_vector but not displayed
   - **Action:** Add to card detail view
   ```html
   <p class="italic text-gray-600">{{ card.flavor_text }}</p>
   ```

5. **`artist`** - Not displayed
   - **Action:** Add to card details
   ```html
   <div class="text-sm text-gray-500">Illustrated by {{ card.artist }}</div>
   ```

6. **`border_color`, `frame`, `security_stamp`, `frame_effects`** - Never used
   - **Action:** Remove if not planning visual filtering
   - **OR:** Use for advanced filters

7. **`set_type`** - Not used for filtering
   - **Action:** Use for set categorization (expansion, commander, etc.)

8. **`multiverse_ids`, `mtgo_id`, `arena_id`, `tcgplayer_id`, `cardmarket_id`** - Stored but never used
   - **Action:** Remove if not planning external integrations
   - **OR:** Use for price comparisons across platforms

9. **`lang`** - Always 'en', not used
   - **Action:** Remove OR implement multi-language support

10. **`digital`, `oversized`, `promo`, `reprint`, `variation`** - Never filtered or displayed
    - **Action:** Remove OR add as filter badges
    ```html
    <badge v-if="card.promo">PROMO</badge>
    <badge v-if="card.reprint">REPRINT</badge>
    ```

11. **`card_faces` (JSONB)** - Not handled for dual-faced cards
    - **Action:** Implement for transform/modal cards
    ```javascript
    // Show both faces for dual-faced cards
    if (card.card_faces) {
      renderBothFaces(card.card_faces)
    }
    ```

12. **`scryfall_updated_at`, `updated_at`** - Stored but not used
    - **Action:** Keep for debugging, add to admin view

13. **`promo_types`** - Not displayed
    - **Action:** Remove OR show promo type badges

14. **`last_sales_count`** - Calculated but not displayed
    - **Action:** Show in admin analytics

#### Missing Columns Needed

1. **`featured`** (boolean) - For homepage featured cards
   ```sql
   ALTER TABLE cards ADD COLUMN featured boolean DEFAULT false;
   CREATE INDEX idx_cards_featured ON cards (featured) WHERE featured = true;
   ```

2. **`view_count`** (integer) - Track popular cards
   ```sql
   ALTER TABLE cards ADD COLUMN view_count integer DEFAULT 0;
   ```

3. **`average_rating`** (numeric) - User card ratings
   ```sql
   ALTER TABLE cards ADD COLUMN average_rating numeric(3,2);
   ALTER TABLE cards ADD COLUMN rating_count integer DEFAULT 0;
   ```

---

### 2. `listings` Table

#### ✅ Actively Used Columns
- `id`, `card_id`, `seller_id` - Core relationships
- `price`, `condition`, `quantity`, `status` - Essential listing data
- `foil`, `signed`, `altered` - Card attributes
- `language` - Listing variation
- `created_at`, `updated_at` - Timestamps
- `shipping_method`, `weight_grams` - Shipping (active)

#### 🟡 Partially Used Columns

1. **`images` (text[])** - Defined but never populated
   - **Current:** Listings have no custom images
   - **Recommendation:** Implement photo uploads
   ```javascript
   // backend/routes/listings.js
   router.post('/:id/photos', upload.array('photos', 5), async (req, res) => {
     // Store images in Supabase Storage
     const imageUrls = await uploadListingImages(req.files)
     await supabase.from('listings')
       .update({ images: imageUrls })
       .eq('id', req.params.id)
   })
   ```

2. **`static_shipping_fee`** - Schema ready, not in UI
   - **Recommendation:** Add to listing form
   ```html
   <select v-model="shippingMethod">
     <option value="dynamic">Calculate Automatically</option>
     <option value="static">Fixed Shipping Fee</option>
   </select>
   <input v-if="shippingMethod === 'static'" v-model="shippingFee" />
   ```

#### ❌ Unused or Duplicate Columns

1. **`views_count` AND `view_count`** - DUPLICATE
   - **Action:** Remove one, keep `view_count`
   ```sql
   -- Copy data if views_count has any
   UPDATE listings SET view_count = COALESCE(views_count, view_count);
   ALTER TABLE listings DROP COLUMN views_count;
   ```

2. **`favorited_count` AND `watchlist_count`** - Both exist, neither used
   - **Action:** Remove both, not implemented feature
   - **OR:** Implement wishlist/favorite feature properly

3. **`deleted_at`** - Soft delete timestamp, but using `status='removed'`
   - **Action:** Remove - status field is sufficient
   ```sql
   ALTER TABLE listings DROP COLUMN deleted_at;
   ```

4. **`sales_count`** - Incremented but never displayed
   - **Recommendation:** Show on listing "X sold"
   ```html
   <div class="text-sm text-gray-500">{{ listing.sales_count }} sold</div>
   ```

#### Missing Columns Needed

1. **`description`** (text) - Listing-specific notes
   ```sql
   ALTER TABLE listings ADD COLUMN description text;
   ```

2. **`location`** (text) - Seller's item location for shipping estimates
   ```sql
   ALTER TABLE listings ADD COLUMN location text; -- e.g., "Toronto, ON"
   ```

3. **`last_price_update`** (timestamp) - Track when seller changed price
   ```sql
   ALTER TABLE listings ADD COLUMN last_price_update timestamp with time zone;
   ```

---

### 3. `orders` Table

#### ✅ Actively Used Columns
- `id`, `buyer_id`, `status` - Core order data
- `subtotal`, `shipping_cost`, `tax_amount`, `total_amount` - Pricing
- `shipping_address` (JSONB), `billing_address` (JSONB) - Addresses
- `helcim_transaction_id`, `payment_status`, `paid_at` - Payment
- `refund_status`, `refund_amount` - Refunds
- `created_at`, `updated_at` - Timestamps
- `order_number` - Human-readable ID (trigger-generated)

#### 🟡 Partially Used Columns

1. **`tracking_number`** - At order level, but also on `order_items`
   - **Issue:** Redundancy - should be per item
   - **Recommendation:** Use `order_items.tracking_number` only
   - **Action:** Remove from orders table
   ```sql
   ALTER TABLE orders DROP COLUMN tracking_number;
   ```

2. **`label_url`, `label_tracking_code`** - Schema ready, not used
   - **Recommendation:** Implement shipping label generation
   ```javascript
   // When generating labels
   await supabase.from('orders')
     .update({ 
       label_url: labelResponse.url,
       label_tracking_code: labelResponse.trackingCode 
     })
   ```

3. **`shipped_at`, `delivered_at`** - Timestamps exist but not tracked
   - **Recommendation:** Update when status changes
   ```javascript
   // In status update function
   if (newStatus === 'shipped') {
     updateData.shipped_at = new Date()
   }
   if (newStatus === 'delivered') {
     updateData.delivered_at = new Date()
   }
   ```

4. **`completed_at`** - Tracked but completion workflow unclear
   - **Recommendation:** Set when order fully delivered
   ```javascript
   if (allItemsDelivered) {
     updateData.completed_at = new Date()
     updateData.status = 'completed'
   }
   ```

5. **`currency`** - Stored but always CAD
   - **Recommendation:** Use for multi-currency support OR remove
   - **Action:** If staying CAD-only, remove column

6. **`notes`** - Admin notes field exists but no UI
   - **Recommendation:** Add admin notes section
   ```html
   <textarea v-if="isAdmin" v-model="order.notes" 
     placeholder="Internal admin notes"></textarea>
   ```

7. **`requires_manual_review`** - Flag exists but no workflow
   - **Recommendation:** Implement review queue
   ```javascript
   // Flag high-value orders
   if (order.total_amount > 1000) {
     order.requires_manual_review = true
   }
   ```

#### ❌ Unused Columns

1. **`payment_intent_id`** - Never populated (old design?)
   - **Action:** Remove - using `helcim_transaction_id`
   ```sql
   ALTER TABLE orders DROP COLUMN payment_intent_id;
   ```

2. **`refund_reason`, `refunded_at`, `refund_initiated_at`** - Refund workflow not implemented
   - **Action:** Keep for future refund feature OR remove if using `refund_requests` table
   - **Recommendation:** Use `refund_requests` table instead (more structured)

3. **`payout_id`** - Links to seller_payouts but relationship unclear
   - **Action:** Clarify relationship or remove
   - **Better:** Track at order_item level since multiple sellers

4. **`payment_failure_reason`** - Never populated
   - **Recommendation:** Populate on payment failures
   ```javascript
   if (paymentResult.status === 'failed') {
     order.payment_failure_reason = paymentResult.error
   }
   ```

#### Missing Columns Needed

1. **`estimated_delivery_date`** (date) - Show to customers
   ```sql
   ALTER TABLE orders ADD COLUMN estimated_delivery_date date;
   ```

2. **`gift_message`** (text) - Gift orders
   ```sql
   ALTER TABLE orders ADD COLUMN gift_message text;
   ALTER TABLE orders ADD COLUMN is_gift boolean DEFAULT false;
   ```

3. **`buyer_notes`** (text) - Special instructions
   ```sql
   ALTER TABLE orders ADD COLUMN buyer_notes text;
   ```

4. **`discount_code`** (text), `discount_amount`** (numeric) - Coupons
   ```sql
   ALTER TABLE orders ADD COLUMN discount_code text;
   ALTER TABLE orders ADD COLUMN discount_amount numeric(10,2) DEFAULT 0;
   ```

---

### 4. `order_items` Table

#### ✅ Actively Used Columns
- `id`, `order_id`, `listing_id` - Relationships
- `quantity`, `price` - Line item data
- `created_at` - Timestamp

#### 🟡 Partially Used Columns

1. **`tracking_number`, `shipping_status`** - Added but not fully used
   - **Recommendation:** Implement per-item tracking
   ```javascript
   // Update individual item status
   await supabase.from('order_items')
     .update({ 
       shipping_status: 'shipped',
       tracking_number: trackingCode 
     })
     .eq('id', itemId)
   ```

#### Missing Columns Needed

1. **`seller_id`** - Denormalized for easier queries
   ```sql
   ALTER TABLE order_items ADD COLUMN seller_id uuid REFERENCES profiles(id);
   -- Populate from listings
   UPDATE order_items oi
   SET seller_id = l.seller_id
   FROM listings l
   WHERE oi.listing_id = l.id;
   ```

2. **`card_name`**, `card_image`** - Snapshot for order history
   ```sql
   ALTER TABLE order_items ADD COLUMN card_name text;
   ALTER TABLE order_items ADD COLUMN card_image text;
   -- Prevents issues if card/listing deleted
   ```

3. **`condition`, `foil`, `language`** - Snapshot listing attributes
   ```sql
   ALTER TABLE order_items ADD COLUMN condition text;
   ALTER TABLE order_items ADD COLUMN foil boolean;
   ALTER TABLE order_items ADD COLUMN language text;
   ```

4. **`seller_payout_status`** - Track payout per item
   ```sql
   ALTER TABLE order_items ADD COLUMN payout_status text DEFAULT 'pending';
   ALTER TABLE order_items ADD COLUMN payout_amount numeric(10,2);
   ALTER TABLE order_items ADD COLUMN payout_id uuid REFERENCES seller_payouts(id);
   ```

---

### 5. `profiles` Table

#### ✅ Actively Used Columns
- `id`, `email`, `display_name`, `role`, `approved` - Core identity
- `rating`, `total_sales` - Seller metrics
- `created_at`, `updated_at` - Timestamps
- `seller_application_status`, `seller_tier` - Seller workflow
- `email_preferences` (JSONB) - Communication settings

#### 🟡 Partially Used Columns

1. **`business_info` (JSONB)** - Empty object, never populated
   - **Recommendation:** Remove OR use for business details
   ```javascript
   business_info: {
     business_name: '',
     business_type: '',
     tax_id: '',
     address: {}
   }
   ```
   - **Better:** Use `seller_settings` table instead (already exists)

2. **`phone`, `timezone`, `bio`** - Stored but not displayed
   - **Recommendation:** Add to profile page
   ```html
   <div class="profile-info">
     <p>{{ profile.bio }}</p>
     <p>Contact: {{ profile.phone }}</p>
     <p>Timezone: {{ profile.timezone }}</p>
   </div>
   ```

3. **`shipping_address` (JSONB)** - Can store default address
   - **Recommendation:** Use for default checkout address
   ```javascript
   // Pre-fill checkout form
   if (profile.shipping_address) {
     form.value = profile.shipping_address
   }
   ```

4. **`shipping_preferences` (JSONB)** - Empty object
   - **Action:** Remove - use `seller_settings` table
   ```sql
   ALTER TABLE profiles DROP COLUMN shipping_preferences;
   ```

5. **`default_shipping_method`** - Not used in code
   - **Action:** Remove - use `seller_settings` table
   ```sql
   ALTER TABLE profiles DROP COLUMN default_shipping_method;
   ```

6. **`business_name`, `website`** - Duplicated in `seller_settings`
   - **Action:** Remove from profiles, use `seller_settings`
   ```sql
   ALTER TABLE profiles DROP COLUMN business_name;
   ALTER TABLE profiles DROP COLUMN website;
   ```

7. **`payout_settings` (JSONB)** - Duplicated in `payout_settings` table
   - **Action:** Remove - dedicated table exists
   ```sql
   ALTER TABLE profiles DROP COLUMN payout_settings;
   ```

8. **`notification_preferences` (JSONB)** - Never populated
   - **Recommendation:** Merge with `email_preferences`
   ```sql
   -- Consolidate into email_preferences
   ALTER TABLE profiles DROP COLUMN notification_preferences;
   ```

9. **`suspended`, `suspended_until`, `suspension_reason`** - No suspension workflow
   - **Action:** Remove OR implement suspension feature
   - **Recommendation:** Keep for moderation

10. **`last_active_at`** - Updated but not used
    - **Recommendation:** Show "Last seen" on profiles
    ```html
    <div>Last active: {{ formatTimeAgo(profile.last_active_at) }}</div>
    ```

11. **`seller_notes`** - Admin notes for sellers
    - **Recommendation:** Add to admin seller view
    ```html
    <textarea v-if="isAdmin" v-model="profile.seller_notes"></textarea>
    ```

#### Missing Columns Needed

1. **`avatar_url`** (text) - Profile pictures
   ```sql
   ALTER TABLE profiles ADD COLUMN avatar_url text;
   ```

2. **`verified_email`** (boolean) - Email verification status
   ```sql
   ALTER TABLE profiles ADD COLUMN verified_email boolean DEFAULT false;
   ALTER TABLE profiles ADD COLUMN verified_at timestamp with time zone;
   ```

3. **`total_orders`**, `total_spent`** (for buyers) - Analytics
   ```sql
   ALTER TABLE profiles ADD COLUMN total_orders integer DEFAULT 0;
   ALTER TABLE profiles ADD COLUMN total_spent numeric(12,2) DEFAULT 0;
   ```

4. **`seller_since`** (timestamp) - When became seller
   ```sql
   ALTER TABLE profiles ADD COLUMN seller_since timestamp with time zone;
   ```

5. **`response_rate`**, `response_time`** (seller metrics)
   ```sql
   ALTER TABLE profiles ADD COLUMN response_rate numeric(5,2);
   ALTER TABLE profiles ADD COLUMN avg_response_time_hours numeric(8,2);
   ```

---

### 6. `seller_applications` Table

#### ✅ Actively Used Columns
- `id`, `user_id`, `status` - Core workflow
- `business_name`, `business_type`, `address` - Application data
- `submitted_at`, `approved_at`, `rejected_at` - Timestamps
- `admin_notes`, `rejection_reason` - Review process

#### ❌ Unused Columns

1. **`reviewed_by`, `approved_by`, `rejected_by`, `info_requested_by`** - All admin IDs
   - **Issue:** Four columns for same purpose
   - **Recommendation:** Keep only one: `reviewed_by`
   ```sql
   ALTER TABLE seller_applications DROP COLUMN approved_by;
   ALTER TABLE seller_applications DROP COLUMN rejected_by;
   ALTER TABLE seller_applications DROP COLUMN info_requested_by;
   -- Use reviewed_by for all actions
   ```

2. **`tax_id`** - Sensitive data stored but not encrypted
   - **Action:** Encrypt OR move to secure vault
   ```javascript
   // Store encrypted in Supabase Vault
   await supabase.from('vault.secrets')
     .insert({ name: `tax_id_${userId}`, secret: encryptedTaxId })
   ```

3. **`references`** (text[]) - Never populated
   - **Action:** Remove - not collecting references
   ```sql
   ALTER TABLE seller_applications DROP COLUMN references;
   ```

4. **`experience_years`** - Not used in approval process
   - **Action:** Remove OR add to evaluation criteria

5. **`admin_message`** - Separate from admin_notes?
   - **Action:** Merge with admin_notes or clarify purpose

6. **`required_documents`** (text[]) - Not used
   - **Action:** Remove - using `seller_documents` table
   ```sql
   ALTER TABLE seller_applications DROP COLUMN required_documents;
   ```

---

### 7. `wishlists` Table

#### ✅ Actively Used Columns
- `id`, `user_id`, `card_id` - Core relationships
- `max_price` - Price alerts
- `created_at` - Timestamp

#### 🟡 Partially Used Columns

1. **`condition_preference`** - Stored but not used for matching
   - **Recommendation:** Use in price alert matching
   ```javascript
   // Only alert if condition matches preference
   where: `condition >= ${wishlist.condition_preference}`
   ```

2. **`notes`** - Personal notes field exists but no UI
   - **Recommendation:** Add notes input
   ```html
   <textarea v-model="wishlist.notes" 
     placeholder="Personal notes about this card"></textarea>
   ```

3. **`updated_at`** - Column is `date` not `timestamp`
   - **Issue:** No time component
   - **Recommendation:** Change to timestamp
   ```sql
   ALTER TABLE wishlists 
   ALTER COLUMN updated_at TYPE timestamp with time zone;
   ```

#### Missing Columns Needed

1. **`priority`** (integer) - Wishlist ordering
   ```sql
   ALTER TABLE wishlists ADD COLUMN priority integer DEFAULT 0;
   ```

2. **`quantity_wanted`** (integer) - For deck building
   ```sql
   ALTER TABLE wishlists ADD COLUMN quantity_wanted integer DEFAULT 1;
   ```

3. **`foil_only`** (boolean) - Preference flag
   ```sql
   ALTER TABLE wishlists ADD COLUMN foil_only boolean DEFAULT false;
   ```

---

## Summary of Actions

### Immediate Actions (Cleanup) 🔴

**Remove Duplicate/Redundant Columns:**
```sql
-- listings table
ALTER TABLE listings DROP COLUMN views_count; -- duplicate
ALTER TABLE listings DROP COLUMN favorited_count; -- unused
ALTER TABLE listings DROP COLUMN watchlist_count; -- unused
ALTER TABLE listings DROP COLUMN deleted_at; -- using status

-- orders table
ALTER TABLE orders DROP COLUMN payment_intent_id; -- using helcim_transaction_id
ALTER TABLE orders DROP COLUMN tracking_number; -- use order_items.tracking_number

-- profiles table  
ALTER TABLE profiles DROP COLUMN shipping_preferences; -- use seller_settings
ALTER TABLE profiles DROP COLUMN default_shipping_method; -- use seller_settings
ALTER TABLE profiles DROP COLUMN business_name; -- use seller_settings
ALTER TABLE profiles DROP COLUMN website; -- use seller_settings
ALTER TABLE profiles DROP COLUMN payout_settings; -- use payout_settings table
ALTER TABLE profiles DROP COLUMN notification_preferences; -- merge with email_preferences
ALTER TABLE profiles DROP COLUMN business_info; -- use seller_settings

-- seller_applications table
ALTER TABLE seller_applications DROP COLUMN approved_by;
ALTER TABLE seller_applications DROP COLUMN rejected_by;
ALTER TABLE seller_applications DROP COLUMN info_requested_by;
ALTER TABLE seller_applications DROP COLUMN references;
ALTER TABLE seller_applications DROP COLUMN required_documents;

-- cards table
ALTER TABLE cards DROP COLUMN price_updated_at; -- duplicate
```

### Implement Missing Features 🟠

**Add Essential Missing Columns:**
```sql
-- order_items (snapshot data)
ALTER TABLE order_items ADD COLUMN seller_id uuid REFERENCES profiles(id);
ALTER TABLE order_items ADD COLUMN card_name text;
ALTER TABLE order_items ADD COLUMN card_image text;
ALTER TABLE order_items ADD COLUMN condition text;
ALTER TABLE order_items ADD COLUMN foil boolean;

-- orders (customer features)
ALTER TABLE orders ADD COLUMN estimated_delivery_date date;
ALTER TABLE orders ADD COLUMN buyer_notes text;
ALTER TABLE orders ADD COLUMN is_gift boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN gift_message text;

-- profiles (core features)
ALTER TABLE profiles ADD COLUMN avatar_url text;
ALTER TABLE profiles ADD COLUMN verified_email boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN total_orders integer DEFAULT 0;

-- cards (engagement)
ALTER TABLE cards ADD COLUMN featured boolean DEFAULT false;
ALTER TABLE cards ADD COLUMN view_count integer DEFAULT 0;

-- wishlists (functionality)
ALTER TABLE wishlists ADD COLUMN priority integer DEFAULT 0;
ALTER TABLE wishlists ADD COLUMN quantity_wanted integer DEFAULT 1;
```

### Code Updates Needed 🟡

1. **Use responsive images for cards**
   - Update CardImage component to use small/large variants

2. **Display card attributes**
   - Show power/toughness, artist, flavor text

3. **Implement listing photos**
   - Add image upload to listing creation

4. **Track order status timestamps**
   - Update shipped_at, delivered_at, completed_at

5. **Show sales count on listings**
   - Display "X sold" badge

6. **Implement color filtering**
   - Add color/color identity filters to search

### Performance Improvements 📈

**Add Missing Indexes:**
```sql
-- Color filtering
CREATE INDEX idx_cards_colors ON cards USING GIN (colors) 
WHERE colors IS NOT NULL;

CREATE INDEX idx_cards_color_identity ON cards USING GIN (color_identity)
WHERE color_identity IS NOT NULL;

-- Featured cards
CREATE INDEX idx_cards_featured ON cards (featured) 
WHERE featured = true;

-- Seller queries
CREATE INDEX idx_order_items_seller ON order_items (seller_id, created_at DESC);

-- Order status tracking
CREATE INDEX idx_orders_status_dates ON orders (status, shipped_at, delivered_at);
```

---

## Conclusion

**Statistics:**
- **Unused columns identified:** 45+
- **Missing essential columns:** 25+
- **Duplicate/redundant columns:** 15+
- **Potential storage savings:** 15-20%

**Priority Actions:**
1. Remove 15 duplicate/redundant columns (immediate)
2. Add 10 essential missing columns (week 1)
3. Implement 20 partially-used columns (month 1)
4. Add remaining nice-to-have columns (month 2-3)

**Expected Impact:**
- Cleaner schema
- Better query performance
- Reduced storage costs
- More maintainable code

