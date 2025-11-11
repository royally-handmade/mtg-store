# Database Cleanup & Feature Completion Action Plan
## MTG Marketplace Platform

**Priority Level System:**
- 🔴 **P0 - Critical**: Immediate action required (1-3 days)
- 🟠 **P1 - High**: Complete within 1 week
- 🟡 **P2 - Medium**: Complete within 1 month
- 🟢 **P3 - Low**: Complete within quarter

---

## Phase 1: Database Cleanup 🔴 P0

**Estimated Time:** 2-3 days  
**Impact:** Technical debt reduction, performance improvement

### 1.1 Remove Obsolete Tables

```sql
-- Execute this migration
DROP TABLE IF EXISTS platform_settings CASCADE;
DROP TABLE IF EXISTS auth_logs CASCADE;
DROP TABLE IF EXISTS deleted_accounts_log CASCADE;

-- Update any references (if any)
-- Check for foreign keys and update code references
```

**Files to Check:**
- `backend/routes/admin.js` - Check for platform_settings usage
- All route files - Check for auth_logs usage

---

### 1.2 Remove Obsolete Functions

```sql
-- Drop old functions
DROP FUNCTION IF EXISTS calculate_market_price(integer);
DROP FUNCTION IF EXISTS update_market_price(uuid);
DROP FUNCTION IF EXISTS update_market_prices();
DROP FUNCTION IF EXISTS sync_card_with_scryfall(integer);
DROP FUNCTION IF EXISTS decrease_listing_quantity(uuid, integer);
DROP FUNCTION IF EXISTS cleanup_deleted_user_data(uuid);

-- Keep only decrement_listing_quantity or reduce_listing_quantity
-- Choose one name and standardize
```

**Action Items:**
- [ ] Search codebase for function calls
- [ ] Update to use correct function names
- [ ] Test market price calculations still work
- [ ] Verify listing quantity updates work

---

### 1.3 Index Optimization

```sql
-- Add missing composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_orders_payment_status_date 
  ON orders(payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_seller_active_price 
  ON listings(seller_id, status, price) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_order_items_order_listing 
  ON order_items(order_id, listing_id);

CREATE INDEX IF NOT EXISTS idx_helcim_logs_user_date
  ON helcim_transaction_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_card_recent
  ON price_history(card_id, date DESC)
  WHERE date >= CURRENT_DATE - INTERVAL '90 days';
```

**Expected Impact:**
- Faster order queries for users/admins
- Improved seller dashboard performance
- Better payment reconciliation speed

---

## Phase 2: Critical Features 🔴 P0

**Estimated Time:** 1 week  
**Impact:** User trust, customer service capability

### 2.1 Complete Refund Request System

**Priority:** 🔴 Critical - Essential for customer service

**Database:** ✅ Ready  
**Backend Tasks:**
- [ ] Create `POST /api/refunds/request` endpoint
- [ ] Create `GET /api/refunds` (user and admin)
- [ ] Create `PATCH /api/refunds/:id/process` (admin)
- [ ] Integrate Helcim refund API
- [ ] Add email notifications

**Frontend Tasks:**
- [ ] Create RefundRequestModal component
- [ ] Add "Request Refund" button to order details
- [ ] Create admin refund management page
- [ ] Add refund status to order history

**Files to Create:**
- `backend/routes/refunds.js`
- `frontend/src/components/RefundRequestModal.vue`
- `frontend/src/views/admin/RefundManagement.vue`

---

### 2.2 Implement Order Item Photos

**Priority:** 🔴 Critical - Seller trust and dispute resolution

**Database:** ✅ Ready  
**Backend Tasks:**
- [ ] Create file upload endpoint with size limits
- [ ] Implement image storage (Supabase Storage)
- [ ] Create `POST /api/orders/:id/items/:itemId/photos`
- [ ] Add photo URL to order item responses

**Frontend Tasks:**
- [ ] Add photo upload to seller order fulfillment
- [ ] Display photos in order details (buyer & seller)
- [ ] Image lightbox/gallery component

**Files to Create:**
- `backend/services/imageUploadService.js`
- `backend/routes/orderPhotos.js`
- `frontend/src/components/seller/ItemPhotoUpload.vue`

**Storage Setup:**
```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-item-photos', 'order-item-photos', false);

-- Set up RLS policies
CREATE POLICY "Users can view photos for their orders"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'order-item-photos' AND 
         auth.uid() IN (
           SELECT DISTINCT unnest(ARRAY[o.buyer_id, l.seller_id])
           FROM orders o
           JOIN order_items oi ON o.id = oi.order_id
           JOIN listings l ON oi.listing_id = l.id
         ));
```

---

### 2.3 Complete Notification Center

**Priority:** 🟠 High - User experience

**Database:** ✅ Ready (notifications table exists)  
**Backend Tasks:**
- [ ] Already creates notifications via triggers ✅
- [ ] Add `PATCH /api/notifications/:id/read` endpoint
- [ ] Add `POST /api/notifications/read-all` endpoint
- [ ] Add real-time subscription endpoint

**Frontend Tasks:**
- [ ] Create NotificationCenter component
- [ ] Add bell icon with unread count to header
- [ ] Implement real-time updates (Supabase subscriptions)
- [ ] Add notification preferences page

**Files to Create:**
- `frontend/src/components/NotificationCenter.vue`
- `frontend/src/components/NotificationPreferences.vue`
- `frontend/src/stores/notifications.js`

---

## Phase 3: Payment & Security Features 🟠 P1

**Estimated Time:** 1-2 weeks  
**Impact:** Security, conversion rate, fraud prevention

### 3.1 Implement Saved Payment Methods

**Priority:** 🟠 High - Improves conversion rate

**Database:** ✅ Ready (customer_payment_methods)  
**Backend Tasks:**
- [ ] Integrate Helcim Customer Vault API
- [ ] Create `POST /api/payment-methods` (save card)
- [ ] Create `GET /api/payment-methods` (list cards)
- [ ] Create `DELETE /api/payment-methods/:id`
- [ ] Create `PATCH /api/payment-methods/:id/default`

**Frontend Tasks:**
- [ ] Add "Save payment method" checkbox at checkout
- [ ] Create PaymentMethods settings page
- [ ] Add card selection during checkout
- [ ] Display saved cards securely (last 4 digits only)

**Files to Create:**
- `backend/services/customerVaultService.js`
- `backend/routes/paymentMethods.js`
- `frontend/src/views/account/PaymentMethods.vue`

---

### 3.2 Implement Basic Fraud Detection

**Priority:** 🟠 High - Payment security

**Database:** ✅ Ready (fraud_alerts)  
**Backend Tasks:**
- [ ] Create fraud detection rules:
  - Multiple failed payment attempts
  - High-value orders from new accounts
  - Unusual shipping addresses
  - Velocity checks (orders per hour)
- [ ] Create `POST /api/fraud/check` (internal)
- [ ] Add fraud check to checkout flow
- [ ] Create admin alert system

**Rules to Implement:**
```javascript
// backend/services/fraudDetectionService.js
const FRAUD_RULES = {
  FAILED_PAYMENTS: { threshold: 3, timeWindow: '1 hour' },
  NEW_ACCOUNT_HIGH_VALUE: { amount: 500, accountAge: '7 days' },
  VELOCITY_CHECK: { maxOrders: 5, timeWindow: '1 hour' },
  ADDRESS_MISMATCH: { checkBillingVsShipping: true }
}
```

**Files to Create:**
- `backend/services/fraudDetectionService.js`
- `backend/routes/fraud.js` (admin only)
- `frontend/src/views/admin/FraudAlerts.vue`

---

### 3.3 Price Alert Email System

**Priority:** 🟠 High - User engagement

**Database:** ✅ Ready (price_alert_notifications)  
**Trigger:** ✅ Already creates notifications

**Backend Tasks:**
- [ ] Create email service integration
- [ ] Create email templates for price alerts
- [ ] Create scheduled job to send pending alerts
- [ ] Add `PATCH /api/wishlist/:id/alert` to toggle alerts
- [ ] Mark alerts as sent

**Email Template:**
```
Subject: Price Alert: [Card Name] is now $[Price]

The card "[Card Name]" from [Set] has dropped to $[Price]!
Your target price was $[Target].

[View Listings Button]
```

**Files to Create:**
- `backend/services/emailService.js`
- `backend/jobs/priceAlertEmailJob.js`
- `backend/templates/priceAlert.html`

**Cron Setup:**
```javascript
// Run every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  await priceAlertEmailJob.sendPendingAlerts();
});
```

---

## Phase 4: Seller Features 🟡 P2

**Estimated Time:** 2-3 weeks  
**Impact:** Seller satisfaction, marketplace quality

### 4.1 Complete Seller Application Workflow

**Priority:** 🟡 Medium - Business operations

**Database:** ✅ Ready  
**Current State:** Partial implementation

**Backend Tasks:**
- [ ] Complete `PATCH /api/seller-applications/:id/review` endpoint
- [ ] Add status transitions:
  - `pending` → `info_requested`
  - `info_requested` → `approved` / `rejected`
- [ ] Add email notifications for status changes
- [ ] Create document verification workflow

**Frontend Tasks:**
- [ ] Create admin application review page
- [ ] Add bulk actions (approve multiple)
- [ ] Add messaging system for info requests
- [ ] Create seller onboarding checklist

**Files to Update:**
- `backend/routes/admin.js` (add review endpoints)
- `frontend/src/views/admin/SellerApplications.vue` (complete)

---

### 4.2 Implement Seller Settings

**Priority:** 🟡 Medium - Seller experience

**Database:** ✅ Ready (seller_settings)  
**Current State:** No implementation

**Backend Tasks:**
- [ ] Create `GET /api/seller/settings` endpoint
- [ ] Create `PATCH /api/seller/settings` endpoint
- [ ] Add validation for tax ID, bank details
- [ ] Integrate with payout service

**Frontend Tasks:**
- [ ] Create SellerSettings page with tabs:
  - Business Information
  - Tax Information
  - Payout Preferences
  - Shipping Defaults
- [ ] Form validation
- [ ] Save confirmation

**Files to Create:**
- `backend/routes/sellerSettings.js`
- `frontend/src/views/seller/Settings.vue`

---

### 4.3 Implement Review System

**Priority:** 🟡 Medium - Trust building

**Database:** ✅ Ready (seller_reviews)  
**Trigger:** ✅ Rating calculation works

**Backend Tasks:**
- [ ] Create `POST /api/reviews` endpoint
- [ ] Create `GET /api/sellers/:id/reviews` endpoint
- [ ] Add review eligibility check (delivered orders only)
- [ ] Prevent duplicate reviews
- [ ] Send notification to seller

**Frontend Tasks:**
- [ ] Create ReviewModal component
- [ ] Add "Leave Review" to completed orders
- [ ] Display reviews on seller profile
- [ ] Add rating summary (stars, count)

**Files to Create:**
- `backend/routes/reviews.js`
- `frontend/src/components/ReviewModal.vue`
- `frontend/src/components/SellerReviews.vue`

---

## Phase 5: Analytics & Reporting 🟡 P2

**Estimated Time:** 2-3 weeks  
**Impact:** Business intelligence, seller tools

### 5.1 Admin Analytics Dashboard

**Priority:** 🟡 Medium - Business operations

**Database:** ✅ Ready (payment_analytics)  
**Trigger:** ✅ Data aggregation works

**Backend Tasks:**
- [ ] Create `GET /api/admin/analytics` endpoint
- [ ] Add date range filtering
- [ ] Add export functionality (CSV)

**Frontend Tasks:**
- [ ] Create AdminAnalytics page with charts:
  - Daily revenue
  - Transaction success rate
  - Refund rate
  - Top sellers
  - Top cards
- [ ] Use Chart.js or similar
- [ ] Add date range picker

**Files to Create:**
- `backend/routes/analytics.js`
- `frontend/src/views/admin/Analytics.vue`

---

### 5.2 Seller Analytics Dashboard

**Priority:** 🟡 Medium - Seller value

**Database:** ✅ Ready (listing_analytics, listing_views)  
**Current State:** Data collected, no UI

**Backend Tasks:**
- [ ] Create `GET /api/seller/analytics` endpoint
- [ ] Aggregate views, favorites, sales by time period
- [ ] Add listing performance metrics

**Frontend Tasks:**
- [ ] Add analytics tab to seller dashboard
- [ ] Charts for:
  - Views over time
  - Sales by card
  - Revenue trends
  - Conversion rate
- [ ] Best/worst performing listings

**Files to Create:**
- `frontend/src/views/seller/Analytics.vue`

---

## Phase 6: Advanced Features 🟢 P3

**Estimated Time:** 1-2 months  
**Impact:** Enhanced user experience

### 6.1 Shared Wishlists

**Priority:** 🟢 Low - Nice to have

**Database:** ✅ Ready  
**Backend Tasks:**
- [ ] Create `POST /api/wishlists/share` endpoint
- [ ] Generate shareable link with UUID
- [ ] Create `GET /api/wishlists/shared/:id` (public)
- [ ] Track view count
- [ ] Set expiration (configurable)

**Frontend Tasks:**
- [ ] Add "Share" button to wishlist
- [ ] Create public wishlist view page
- [ ] Add privacy settings (public/private)
- [ ] Copy link button

---

### 6.2 Automated Payout Scheduling

**Priority:** 🟢 Low - Automation

**Database:** ✅ Ready (payout_schedules)  
**Backend Tasks:**
- [ ] Create schedule management endpoints
- [ ] Implement cron job execution
- [ ] Add schedule CRUD operations
- [ ] Connect to payout service

**Frontend Tasks:**
- [ ] Create payout schedule admin page
- [ ] Add/edit/delete schedules
- [ ] View next run times

---

### 6.3 Advanced Market Analytics

**Priority:** 🟢 Low - Power users

**Database:** ✅ Ready (views exist)  
**Backend Tasks:**
- [ ] Create market trends endpoint
- [ ] Add price prediction logic
- [ ] Historical comparison

**Frontend Tasks:**
- [ ] Create market analytics page
- [ ] Price trend charts
- [ ] Hot cards/sets
- [ ] Market movers

---

## Testing Checklist

After each phase, verify:

### Phase 1 (Cleanup)
- [ ] All tests pass
- [ ] No broken references to removed tables/functions
- [ ] Market price calculations work
- [ ] Listing quantity updates work

### Phase 2 (Critical Features)
- [ ] Refund flow works end-to-end
- [ ] Photos upload and display correctly
- [ ] Notifications appear in real-time
- [ ] Payment processing unaffected

### Phase 3 (Payment & Security)
- [ ] Saved cards work correctly
- [ ] Fraud detection triggers appropriately
- [ ] Price alerts send emails
- [ ] No false positives in fraud

### Phase 4 (Seller Features)
- [ ] Application workflow complete
- [ ] Settings save correctly
- [ ] Reviews calculate ratings
- [ ] All seller features work

### Phase 5 (Analytics)
- [ ] Charts display correct data
- [ ] Date filters work
- [ ] Export functionality works
- [ ] Performance is acceptable

---

## Migration Order

Execute in this order to avoid breaking changes:

1. **Week 1:** Phase 1 (Cleanup)
   - Create new migration file
   - Drop obsolete tables
   - Drop obsolete functions
   - Add new indexes
   - Deploy and monitor

2. **Week 2:** Phase 2 (Critical Features)
   - Deploy refund system
   - Deploy photo upload
   - Deploy notifications
   - Test thoroughly

3. **Week 3-4:** Phase 3 (Payment & Security)
   - Deploy saved payment methods
   - Deploy fraud detection
   - Deploy price alerts
   - Monitor for issues

4. **Week 5-7:** Phase 4 (Seller Features)
   - Deploy in order listed
   - Get seller feedback
   - Iterate

5. **Week 8-10:** Phase 5 (Analytics)
   - Deploy dashboards
   - Add export features
   - Performance tuning

6. **Month 3+:** Phase 6 (Advanced)
   - Deploy as capacity allows
   - Prioritize based on user feedback

---

## Success Metrics

Track these metrics after each phase:

### Phase 1
- Query performance improvement: Target 20-30%
- Database size reduction: Target 2-5%
- Code maintainability score: Improved

### Phase 2
- Customer service resolution time: -30%
- Order dispute rate: -25%
- User satisfaction: +15%

### Phase 3
- Conversion rate: +10-15%
- Fraud prevention: Block >80% of fraudulent transactions
- User engagement: +20% from price alerts

### Phase 4
- Seller satisfaction: +25%
- Application processing time: -50%
- Seller retention: +15%

### Phase 5
- Data-driven decisions: Track usage
- Report generation time: <3s
- Seller engagement with analytics: >60%

---

## Resource Requirements

### Development Time
- **Phase 1:** 2-3 days (1 developer)
- **Phase 2:** 5-7 days (1-2 developers)
- **Phase 3:** 10-14 days (2 developers)
- **Phase 4:** 15-20 days (2 developers)
- **Phase 5:** 10-15 days (1-2 developers)
- **Phase 6:** 20-30 days (1-2 developers)

### Testing Time
- Add 30% to each phase for QA
- User acceptance testing: 2-3 days per phase

### Total Estimated Time
- **Minimum:** 10 weeks (2.5 months)
- **Realistic:** 14 weeks (3.5 months)
- **With contingency:** 18 weeks (4.5 months)

---

## Risk Mitigation

### High-Risk Items
1. **Payment Integration Changes**
   - Test in sandbox environment first
   - Have rollback plan ready
   - Monitor transaction success rates

2. **Database Migrations**
   - Backup database before migrations
   - Test on staging environment
   - Run during low-traffic periods

3. **Fraud Detection**
   - Start with conservative rules
   - Monitor false positives closely
   - Have manual override process

### Rollback Plans
- Keep all old functions until confirmed working
- Feature flags for new features
- Database migration rollback scripts ready

---

## Communication Plan

### Stakeholders to Notify

1. **Phase 1 (Cleanup):**
   - Engineering team
   - No user-facing changes

2. **Phase 2 (Critical Features):**
   - All users (new refund process)
   - Sellers (photo requirements)
   - Support team (new workflows)

3. **Phase 3 (Payment & Security):**
   - All users (saved payment methods)
   - Email announcement (price alerts)

4. **Phase 4-6:**
   - Targeted announcements per feature
   - Seller newsletters
   - In-app notifications

---

## Conclusion

This action plan provides a structured approach to:
1. Clean up technical debt (2-3 days)
2. Complete critical features (1 week)
3. Add security features (1-2 weeks)
4. Enhance seller experience (2-3 weeks)
5. Build analytics (2-3 weeks)
6. Add advanced features (1-2 months)

**Total timeline:** 3.5-4.5 months for complete implementation

**Next Step:** Begin Phase 1 cleanup immediately to establish a clean foundation.
