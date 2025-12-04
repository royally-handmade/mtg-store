# Mailgun Email Templates Setup Guide

This document provides instructions for creating email templates in your Mailgun dashboard for the MTG Marketplace application.

## Overview

The application uses Mailgun's templating system with Handlebars syntax. All templates support the following global variables:

- `{{current_year}}` - Current year (automatically injected)
- `{{frontend_url}}` - Frontend URL from environment variables

## Template List by User Role

### 🛒 **BUYER TEMPLATES**

#### 1. Order Confirmation (`order-confirmation`)
**Purpose:** Sent when a buyer completes an order

**Variables:**
- `{{order_id}}` - Order ID (shortened)
- `{{order_date}}` - Order creation date
- `{{order_status}}` - Current order status
- `{{items}}` - Array of order items (each with: card_name, set_name, condition, quantity, price)
- `{{subtotal}}` - Order subtotal
- `{{shipping_cost}}` - Shipping cost
- `{{tax_amount}}` - Tax amount
- `{{total_amount}}` - Total amount
- `{{buyer_name}}` - Buyer's display name

**Template HTML Skeleton:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
  <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1f2937 0%, #374151 100%); color: white; padding: 30px 20px; text-align: center;">
      <h1 style="margin: 0;">🃏 MTG Marketplace</h1>
      <p style="margin: 8px 0 0 0; color: #d1d5db;">Your Premier Magic: The Gathering Trading Platform</p>
    </div>

    <!-- Content -->
    <div style="padding: 40px 30px;">
      <h2 style="color: #1f2937; margin: 0 0 20px 0;">🛒 Order Confirmation</h2>

      <div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 16px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Thank you for your order!</strong> We've received your purchase and are processing it now.</p>
      </div>

      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0;"><strong>Order Details:</strong></p>
        <ul style="margin: 0; padding-left: 20px;">
          <li><strong>Order ID:</strong> #{{order_id}}</li>
          <li><strong>Order Date:</strong> {{order_date}}</li>
          <li><strong>Status:</strong> {{order_status}}</li>
        </ul>
      </div>

      <!-- Order Total -->
      <div style="background: #f3f4f6; padding: 20px; border-radius: 6px; margin: 20px 0;">
        <table style="width: 100%;">
          <tr>
            <td style="padding: 5px 0;"><strong>Subtotal:</strong></td>
            <td style="padding: 5px 0; text-align: right;">\${{subtotal}} CAD</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>Shipping:</strong></td>
            <td style="padding: 5px 0; text-align: right;">\${{shipping_cost}} CAD</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>Tax:</strong></td>
            <td style="padding: 5px 0; text-align: right;">\${{tax_amount}} CAD</td>
          </tr>
          <tr style="border-top: 2px solid #d1d5db;">
            <td style="padding: 10px 0; font-size: 18px;"><strong>Total:</strong></td>
            <td style="padding: 10px 0; text-align: right; font-size: 18px; font-weight: bold; color: #059669;">\${{total_amount}} CAD</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="{{frontend_url}}/orders/{{order_id}}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Order Details</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f3f4f6; padding: 30px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 8px 0; color: #6b7280; font-size: 14px;">© {{current_year}} MTG Marketplace. All rights reserved.</p>
      <p style="margin: 8px 0; font-size: 14px;">
        <a href="{{frontend_url}}/privacy" style="color: #3b82f6; text-decoration: none;">Privacy Policy</a> |
        <a href="{{frontend_url}}/terms" style="color: #3b82f6; text-decoration: none;">Terms of Service</a>
      </p>
    </div>
  </div>
</body>
</html>
```

---

#### 2. Order Shipped (`order-shipped`)
**Purpose:** Sent when seller ships the order

**Variables:**
- `{{order_id}}` - Order ID
- `{{tracking_number}}` - Shipment tracking number
- `{{tracking_url}}` - Full tracking URL (optional)
- `{{shipped_date}}` - Date shipped
- `{{estimated_delivery}}` - Estimated delivery timeframe
- `{{buyer_name}}` - Buyer's display name

---

#### 3. Order Status Update (`order-status-update`)
**Purpose:** Sent when order status changes

**Variables:**
- `{{order_id}}` - Order ID
- `{{old_status}}` - Previous status
- `{{new_status}}` - New status
- `{{status_message}}` - Descriptive message about the status
- `{{updated_date}}` - Date of update
- `{{buyer_name}}` - Buyer's display name

---

#### 4. Price Alert (`price-alert`)
**Purpose:** Sent when a wishlist card price drops below target

**Variables:**
- `{{card_name}}` - Card name
- `{{card_image_url}}` - Card image URL
- `{{set_name}}` - Set name
- `{{old_price}}` - Previous price
- `{{new_price}}` - Current price
- `{{savings}}` - Amount saved
- `{{savings_percent}}` - Percentage saved
- `{{card_id}}` - Card ID for linking
- `{{buyer_name}}` - Buyer's display name

---

### 🏪 **SELLER TEMPLATES**

#### 5. New Order Notification (`seller-new-order`)
**Purpose:** Sent to seller when they receive a new order

**Variables:**
- `{{order_id}}` - Order ID
- `{{order_date}}` - Order date
- `{{buyer_name}}` - Buyer's name (anonymized if needed)
- `{{items}}` - Array of items purchased
- `{{order_total}}` - Total order amount
- `{{seller_earnings}}` - Seller's earnings after fees
- `{{seller_name}}` - Seller's display name

---

#### 6. Seller Application Approved (`seller-application-approved`)
**Purpose:** Sent when admin approves seller application

**Variables:**
- `{{seller_name}}` - Applicant's display name
- `{{seller_tier}}` - Assigned seller tier (standard, premium, etc.)
- `{{approval_date}}` - Date of approval
- `{{dashboard_url}}` - Link to seller dashboard
- `{{admin_notes}}` - Optional notes from admin

---

#### 7. Seller Application Rejected (`seller-application-rejected`)
**Purpose:** Sent when admin rejects seller application

**Variables:**
- `{{seller_name}}` - Applicant's display name
- `{{rejection_reason}}` - Reason for rejection
- `{{admin_notes}}` - Optional notes from admin
- `{{reapply_date}}` - Date when they can reapply (optional)

---

#### 8. Seller Payout Processed (`seller-payout-processed`)
**Purpose:** Sent when payout is processed to seller

**Variables:**
- `{{seller_name}}` - Seller's display name
- `{{payout_amount}}` - Amount paid out
- `{{payout_date}}` - Date of payout
- `{{payout_method}}` - Payment method used
- `{{period_start}}` - Start of payout period
- `{{period_end}}` - End of payout period
- `{{total_orders}}` - Number of orders in period
- `{{platform_fees}}` - Total platform fees deducted

---

#### 9. Additional Information Requested (`seller-info-requested`)
**Purpose:** Sent when admin requests more info from seller applicant

**Variables:**
- `{{seller_name}}` - Applicant's display name
- `{{admin_message}}` - Message from admin
- `{{required_documents}}` - List of required documents (array)
- `{{application_url}}` - Link to update application

---

### 👨‍💼 **ADMIN TEMPLATES**

#### 10. New Seller Application (`admin-new-seller-application`)
**Purpose:** Sent to admins when new seller applies

**Variables:**
- `{{applicant_name}}` - Applicant's display name
- `{{applicant_email}}` - Applicant's email
- `{{application_date}}` - Date of application
- `{{business_name}}` - Business name
- `{{business_type}}` - Type of business
- `{{application_id}}` - Application ID
- `{{review_url}}` - Link to review application in admin panel

---

#### 11. System Alert (`admin-system-alert`)
**Purpose:** Sent to admins for system issues

**Variables:**
- `{{alert_type}}` - Type of alert
- `{{alert_message}}` - Alert message
- `{{alert_severity}}` - Severity level (low, medium, high, critical)
- `{{alert_date}}` - Date/time of alert
- `{{action_required}}` - Description of required action
- `{{admin_panel_url}}` - Link to admin panel

---

### 👤 **ALL USERS TEMPLATES**

#### 12. Password Reset (`password-reset`)
**Purpose:** Sent when user requests password reset

**Variables:**
- `{{user_name}}` - User's display name
- `{{reset_url}}` - Password reset URL (with token)
- `{{expiry_time}}` - Link expiry time

---

#### 13. Password Reset Confirmation (`password-reset-confirmation`)
**Purpose:** Sent after password is successfully reset

**Variables:**
- `{{user_name}}` - User's display name
- `{{user_email}}` - User's email
- `{{reset_date}}` - Date/time of reset
- `{{ip_address}}` - IP address of reset request

---

#### 14. Account Security Alert (`account-security-alert`)
**Purpose:** Sent for security events

**Variables:**
- `{{user_name}}` - User's display name
- `{{security_action}}` - Type of security action
- `{{event_date}}` - Date/time of event
- `{{ip_address}}` - IP address
- `{{location}}` - Approximate location
- `{{user_agent}}` - Device/browser info

---

#### 15. Welcome Email (`welcome`)
**Purpose:** Sent when new user registers

**Variables:**
- `{{user_name}}` - User's display name
- `{{user_role}}` - User's role (buyer, seller)
- `{{registration_date}}` - Date of registration
- `{{dashboard_url}}` - Link to user dashboard

---

#### 16. Email Preferences Update (`email-preferences-update`)
**Purpose:** Sent when user updates email preferences

**Variables:**
- `{{user_name}}` - User's display name
- `{{order_updates}}` - true/false
- `{{price_alerts}}` - true/false
- `{{marketing}}` - true/false
- `{{security_alerts}}` - true/false

---

#### 17. Account Deletion Confirmation (`account-deletion-confirmation`)
**Purpose:** Sent when user account is deleted

**Variables:**
- `{{user_name}}` - User's display name
- `{{deletion_date}}` - Date/time of deletion
- `{{user_email}}` - Email address (last communication)

---

## How to Create Templates in Mailgun

1. **Login to Mailgun Dashboard**
   - Go to https://app.mailgun.com
   - Navigate to Sending > Templates

2. **Create New Template**
   - Click "Create Template"
   - Enter the template name (e.g., `order-confirmation`)
   - Set description
   - Choose engine: **Handlebars**

3. **Add Template Content**
   - Paste the HTML content
   - Use Handlebars syntax for variables: `{{variable_name}}`
   - Add a plain text version (optional but recommended)

4. **Test Template**
   - Use the "Test" button in Mailgun
   - Provide sample variable values
   - Send test email

5. **Publish Template**
   - Save and publish the template
   - Note: Template names must match the constants in `mailgunService.js`

## Template Styling Best Practices

- Use inline CSS (email clients don't support external stylesheets)
- Keep width under 600px for best compatibility
- Use table-based layouts for complex designs
- Test across multiple email clients (Gmail, Outlook, Apple Mail)
- Include both HTML and plain text versions
- Use web-safe fonts (Arial, Helvetica, Times New Roman, Georgia)
- Ensure good contrast for accessibility
- Include alt text for images

## Common CSS for Templates

```css
/* Container */
.container { max-width: 600px; margin: 0 auto; background: white; }

/* Header */
.header { background: linear-gradient(135deg, #1f2937 0%, #374151 100%); color: white; padding: 30px 20px; }

/* Button */
.button {
  display: inline-block;
  background: #3b82f6;
  color: white;
  padding: 14px 28px;
  text-decoration: none;
  border-radius: 6px;
}

/* Alert Boxes */
.alert-success { background: #d1fae5; border-left: 4px solid #10b981; padding: 16px; }
.alert-warning { background: #fef3cd; border-left: 4px solid #f59e0b; padding: 16px; }
.alert-danger { background: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; }
.alert-info { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 16px; }

/* Footer */
.footer { background: #f3f4f6; padding: 30px 20px; text-align: center; }
```

## Testing Templates

After creating templates, use the test function:

```javascript
import mailgunService from './services/mailgunService.js'

// Test sending with template
await mailgunService.sendTemplatedEmail(
  'test@example.com',
  mailgunService.TEMPLATES.ORDER_CONFIRMATION,
  {
    order_id: 'ABC123',
    buyer_name: 'John Doe',
    order_date: '2025-11-12',
    subtotal: '49.99',
    // ... other variables
  },
  { testMode: true }
)
```

## Template Variables Reference

All templates automatically receive:
- `{{frontend_url}}` - Base URL of the frontend application
- `{{current_year}}` - Current year for copyright notices

## Support

For issues with Mailgun templates:
1. Check template syntax in Mailgun dashboard
2. Verify variable names match exactly
3. Check Mailgun logs for delivery errors
4. Review spam score if emails not arriving
5. Ensure DNS records (SPF, DKIM, DMARC) are properly configured
