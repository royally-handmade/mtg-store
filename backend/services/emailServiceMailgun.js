// services/emailServiceMailgun.js - Mailgun-based email service with role-based notifications
import mailgunService, { TEMPLATES, USER_ROLES } from './mailgunService.js'
import dotenv from 'dotenv'

dotenv.config()

// ===== BUYER NOTIFICATION FUNCTIONS =====

/**
 * Send order confirmation email to buyer
 */
export const sendOrderConfirmation = async (order, userEmail, orderItems = []) => {
  const formattedItems = orderItems.map(item => ({
    card_name: item.card_name,
    set_name: item.set_name,
    condition: item.condition.toUpperCase(),
    quantity: item.quantity,
    price: (item.price * item.quantity).toFixed(2)
  }))

  return await mailgunService.sendTemplatedEmail(
    userEmail,
    TEMPLATES.ORDER_CONFIRMATION,
    {
      order_id: order.id.slice(0, 8).toUpperCase(),
      order_date: new Date(order.created_at).toLocaleDateString(),
      order_status: order.status.charAt(0).toUpperCase() + order.status.slice(1),
      items: formattedItems,
      subtotal: order.subtotal,
      shipping_cost: order.shipping_cost,
      tax_amount: order.tax_amount,
      total_amount: order.total_amount,
      buyer_name: order.buyer_name || 'Valued Customer'
    },
    {
      subject: `🛒 Order Confirmation #${order.id.slice(0, 8).toUpperCase()} - MTG Marketplace`,
      tags: ['order-confirmation', 'buyer']
    },
    USER_ROLES.BUYER
  )
}

/**
 * Send shipping notification to buyer
 */
export const sendShippingNotification = async (order, userEmail, trackingUrl = null) => {
  return await mailgunService.sendTemplatedEmail(
    userEmail,
    TEMPLATES.ORDER_SHIPPED,
    {
      order_id: order.id.slice(0, 8).toUpperCase(),
      tracking_number: order.tracking_number || 'N/A',
      tracking_url: trackingUrl || '#',
      shipped_date: new Date().toLocaleDateString(),
      estimated_delivery: '3-7 business days',
      buyer_name: order.buyer_name || 'Valued Customer'
    },
    {
      subject: `📦 Order #${order.id.slice(0, 8).toUpperCase()} Has Shipped - MTG Marketplace`,
      tags: ['order-shipped', 'buyer']
    },
    USER_ROLES.BUYER
  )
}

/**
 * Send order status update to buyer
 */
export const sendOrderStatusUpdate = async (order, userEmail, oldStatus, newStatus) => {
  const statusMessages = {
    pending: 'We\'ve received your order and it\'s being prepared.',
    processing: 'Your order is being processed and prepared for shipment.',
    shipped: 'Your order has been shipped and is on its way to you!',
    delivered: 'Your order has been delivered successfully.',
    cancelled: 'Your order has been cancelled.'
  }

  return await mailgunService.sendTemplatedEmail(
    userEmail,
    TEMPLATES.ORDER_STATUS_UPDATE,
    {
      order_id: order.id.slice(0, 8).toUpperCase(),
      old_status: oldStatus.charAt(0).toUpperCase() + oldStatus.slice(1),
      new_status: newStatus.charAt(0).toUpperCase() + newStatus.slice(1),
      status_message: statusMessages[newStatus] || 'Your order status has been updated.',
      updated_date: new Date().toLocaleString(),
      buyer_name: order.buyer_name || 'Valued Customer'
    },
    {
      subject: `📋 Order #${order.id.slice(0, 8).toUpperCase()} - ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
      tags: ['order-status', 'buyer']
    },
    USER_ROLES.BUYER
  )
}

/**
 * Send price alert to buyer when wishlist card drops in price
 */
export const sendPriceAlert = async (userEmail, card, newPrice, maxPrice, userName = 'Valued Customer') => {
  const savings = (maxPrice - newPrice).toFixed(2)
  const savingsPercent = ((savings / maxPrice) * 100).toFixed(1)

  return await mailgunService.sendTemplatedEmail(
    userEmail,
    TEMPLATES.PRICE_ALERT,
    {
      card_name: card.name,
      card_image_url: card.image_url || '',
      set_name: card.set_name || 'Unknown Set',
      old_price: maxPrice.toFixed(2),
      new_price: newPrice.toFixed(2),
      savings: savings,
      savings_percent: savingsPercent,
      card_id: card.id,
      buyer_name: userName
    },
    {
      subject: `💰 Price Alert: ${card.name} - Now $${newPrice.toFixed(2)} CAD!`,
      tags: ['price-alert', 'buyer']
    },
    USER_ROLES.BUYER
  )
}

// ===== SELLER NOTIFICATION FUNCTIONS =====

/**
 * Notify seller of new order
 */
export const sendSellerNewOrderNotification = async (sellerEmail, order, sellerName = 'Seller') => {
  const sellerEarnings = (order.subtotal * 0.975).toFixed(2) // After 2.5% platform fee

  return await mailgunService.sendTemplatedEmail(
    sellerEmail,
    TEMPLATES.SELLER_NEW_ORDER,
    {
      order_id: order.id.slice(0, 8).toUpperCase(),
      order_date: new Date(order.created_at).toLocaleDateString(),
      buyer_name: 'Customer', // Anonymized
      order_total: order.subtotal,
      seller_earnings: sellerEarnings,
      seller_name: sellerName
    },
    {
      subject: `🛒 New Order #${order.id.slice(0, 8).toUpperCase()} - MTG Marketplace`,
      tags: ['new-order', 'seller']
    },
    USER_ROLES.SELLER
  )
}

/**
 * Send seller application approval email
 */
export const sendSellerApprovalEmail = async (email, displayName, approved = true, sellerTier = 'standard', notes = '') => {
  if (approved) {
    return await mailgunService.sendTemplatedEmail(
      email,
      TEMPLATES.SELLER_APPLICATION_APPROVED,
      {
        seller_name: displayName,
        seller_tier: sellerTier,
        approval_date: new Date().toLocaleDateString(),
        dashboard_url: `${process.env.FRONTEND_URL}/seller`,
        admin_notes: notes
      },
      {
        subject: '🎉 Seller Application Approved - MTG Marketplace',
        tags: ['seller-approval', 'seller']
      },
      USER_ROLES.SELLER
    )
  } else {
    return await mailgunService.sendTemplatedEmail(
      email,
      TEMPLATES.SELLER_APPLICATION_REJECTED,
      {
        seller_name: displayName,
        rejection_reason: notes || 'Application does not meet current requirements',
        admin_notes: notes,
        reapply_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()
      },
      {
        subject: '❌ Seller Application Status - MTG Marketplace',
        tags: ['seller-rejection', 'seller']
      },
      USER_ROLES.SELLER
    )
  }
}

/**
 * Send payout processed notification to seller
 */
export const sendSellerPayoutNotification = async (sellerEmail, payoutData, sellerName = 'Seller') => {
  return await mailgunService.sendTemplatedEmail(
    sellerEmail,
    TEMPLATES.SELLER_PAYOUT_PROCESSED,
    {
      seller_name: sellerName,
      payout_amount: payoutData.amount.toFixed(2),
      payout_date: new Date(payoutData.date).toLocaleDateString(),
      payout_method: payoutData.method || 'Bank Transfer',
      period_start: new Date(payoutData.periodStart).toLocaleDateString(),
      period_end: new Date(payoutData.periodEnd).toLocaleDateString(),
      total_orders: payoutData.orderCount || 0,
      platform_fees: payoutData.platformFees.toFixed(2)
    },
    {
      subject: '💰 Payout Processed - MTG Marketplace',
      tags: ['payout', 'seller']
    },
    USER_ROLES.SELLER
  )
}

/**
 * Request additional info from seller applicant
 */
export const sendSellerInfoRequest = async (email, displayName, message, requiredDocuments = []) => {
  return await mailgunService.sendTemplatedEmail(
    email,
    TEMPLATES.SELLER_INFO_REQUESTED,
    {
      seller_name: displayName,
      admin_message: message,
      required_documents: requiredDocuments,
      application_url: `${process.env.FRONTEND_URL}/seller/application`
    },
    {
      subject: 'Additional Information Required - Seller Application',
      tags: ['seller-info-request', 'seller']
    },
    USER_ROLES.SELLER
  )
}

// ===== ADMIN NOTIFICATION FUNCTIONS =====

/**
 * Notify admins of new seller application
 */
export const sendAdminNewSellerApplicationNotification = async (adminEmail, application) => {
  return await mailgunService.sendTemplatedEmail(
    adminEmail,
    TEMPLATES.ADMIN_NEW_SELLER_APPLICATION,
    {
      applicant_name: application.profiles?.display_name || 'Unknown',
      applicant_email: application.profiles?.email || 'Unknown',
      application_date: new Date(application.submitted_at).toLocaleDateString(),
      business_name: application.business_name || 'N/A',
      business_type: application.business_type || 'N/A',
      application_id: application.id.slice(0, 8).toUpperCase(),
      review_url: `${process.env.FRONTEND_URL}/admin/seller-applications/${application.id}`
    },
    {
      subject: '🔔 New Seller Application - MTG Marketplace Admin',
      tags: ['seller-application', 'admin']
    },
    USER_ROLES.ADMIN
  )
}

/**
 * Send system alert to admins
 */
export const sendAdminSystemAlert = async (adminEmails, alertData) => {
  const recipients = Array.isArray(adminEmails) ? adminEmails : [adminEmails]

  return await mailgunService.sendTemplatedEmail(
    recipients,
    TEMPLATES.ADMIN_SYSTEM_ALERT,
    {
      alert_type: alertData.type || 'System Alert',
      alert_message: alertData.message,
      alert_severity: alertData.severity || 'medium',
      alert_date: new Date().toLocaleString(),
      action_required: alertData.actionRequired || 'Review and take appropriate action',
      admin_panel_url: `${process.env.FRONTEND_URL}/admin`
    },
    {
      subject: `⚠️ System Alert [${alertData.severity?.toUpperCase()}] - MTG Marketplace`,
      tags: ['system-alert', 'admin']
    },
    USER_ROLES.ADMIN
  )
}

// ===== ALL USERS NOTIFICATION FUNCTIONS =====

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (email, displayName, resetToken = null) => {
  const resetUrl = resetToken
    ? `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
    : `${process.env.FRONTEND_URL}/reset-password`

  return await mailgunService.sendTemplatedEmail(
    email,
    TEMPLATES.PASSWORD_RESET,
    {
      user_name: displayName || 'there',
      reset_url: resetUrl,
      expiry_time: '1 hour'
    },
    {
      subject: '🔐 Password Reset Request - MTG Marketplace',
      tags: ['password-reset', 'security']
    }
  )
}

/**
 * Send password reset confirmation
 */
export const sendPasswordResetConfirmation = async (email, displayName, ipAddress = 'Unknown') => {
  return await mailgunService.sendTemplatedEmail(
    email,
    TEMPLATES.PASSWORD_RESET_CONFIRMATION,
    {
      user_name: displayName || 'there',
      user_email: email,
      reset_date: new Date().toLocaleString(),
      ip_address: ipAddress
    },
    {
      subject: '✅ Password Updated Successfully - MTG Marketplace',
      tags: ['password-confirmation', 'security']
    }
  )
}

/**
 * Send account security alert
 */
export const sendAccountSecurityAlert = async (email, displayName, action, details = {}) => {
  return await mailgunService.sendTemplatedEmail(
    email,
    TEMPLATES.ACCOUNT_SECURITY_ALERT,
    {
      user_name: displayName || 'there',
      security_action: action,
      event_date: new Date().toLocaleString(),
      ip_address: details.ip || 'Unknown',
      location: details.location || 'Unknown',
      user_agent: details.userAgent || 'Unknown'
    },
    {
      subject: '🔐 Security Alert - MTG Marketplace Account Activity',
      tags: ['security-alert', 'security']
    }
  )
}

/**
 * Send welcome email to new user
 */
export const sendWelcomeEmail = async (email, displayName, role = 'buyer') => {
  return await mailgunService.sendTemplatedEmail(
    email,
    TEMPLATES.WELCOME,
    {
      user_name: displayName,
      user_role: role,
      registration_date: new Date().toLocaleDateString(),
      dashboard_url: `${process.env.FRONTEND_URL}/dashboard`
    },
    {
      subject: '🎉 Welcome to MTG Marketplace - Your Journey Begins!',
      tags: ['welcome', 'onboarding']
    }
  )
}

/**
 * Send email preferences update confirmation
 */
export const sendEmailPreferencesUpdate = async (email, displayName, preferences) => {
  return await mailgunService.sendTemplatedEmail(
    email,
    TEMPLATES.EMAIL_PREFERENCES_UPDATE,
    {
      user_name: displayName,
      order_updates: preferences.orderUpdates ? 'Enabled' : 'Disabled',
      price_alerts: preferences.priceAlerts ? 'Enabled' : 'Disabled',
      marketing: preferences.marketing ? 'Enabled' : 'Disabled',
      security_alerts: preferences.security ? 'Enabled' : 'Disabled'
    },
    {
      subject: '📧 Email Preferences Updated - MTG Marketplace',
      tags: ['preferences', 'account']
    }
  )
}

/**
 * Send account deletion confirmation
 */
export const sendAccountDeletionConfirmation = async (email, displayName) => {
  return await mailgunService.sendTemplatedEmail(
    email,
    TEMPLATES.ACCOUNT_DELETION,
    {
      user_name: displayName || 'there',
      deletion_date: new Date().toLocaleString(),
      user_email: email
    },
    {
      subject: '🗑️ Account Deletion Confirmation - MTG Marketplace',
      tags: ['account-deletion', 'account']
    }
  )
}

// ===== BULK SENDING =====

/**
 * Send bulk emails to multiple recipients
 */
export const sendBulkEmails = async (recipients, templateName, options = {}) => {
  return await mailgunService.sendBulkTemplatedEmails(recipients, templateName, options)
}

// ===== VALIDATION =====

export const validateEmailAddress = (email) => {
  return mailgunService.validateEmailAddress(email)
}

// ===== TESTING =====

export const testEmailService = async () => {
  return await mailgunService.testMailgunService()
}

// ===== EXPORTS =====

export default {
  // Buyer functions
  sendOrderConfirmation,
  sendShippingNotification,
  sendOrderStatusUpdate,
  sendPriceAlert,

  // Seller functions
  sendSellerNewOrderNotification,
  sendSellerApprovalEmail,
  sendSellerPayoutNotification,
  sendSellerInfoRequest,

  // Admin functions
  sendAdminNewSellerApplicationNotification,
  sendAdminSystemAlert,

  // All users functions
  sendPasswordResetEmail,
  sendPasswordResetConfirmation,
  sendAccountSecurityAlert,
  sendWelcomeEmail,
  sendEmailPreferencesUpdate,
  sendAccountDeletionConfirmation,

  // Utility functions
  sendBulkEmails,
  validateEmailAddress,
  testEmailService,

  // Constants
  TEMPLATES,
  USER_ROLES
}
