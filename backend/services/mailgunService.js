// services/mailgunService.js - Mailgun API integration with template support
import formData from 'form-data'
import Mailgun from 'mailgun.js'
import dotenv from 'dotenv'

dotenv.config()

// ===== MAILGUN CLIENT CONFIGURATION =====

const mailgun = new Mailgun(formData)

const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY || '',
  url: process.env.MAILGUN_REGION === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net'
})

const domain = process.env.MAILGUN_DOMAIN || ''
const fromEmail = process.env.MAILGUN_FROM_EMAIL || 'MTG Marketplace <noreply@mtgmarketplace.com>'

// ===== TEMPLATE NAME CONSTANTS =====

export const TEMPLATES = {
  // Authentication & Security
  PASSWORD_RESET: 'password-reset',
  PASSWORD_RESET_CONFIRMATION: 'password-reset-confirmation',
  ACCOUNT_SECURITY_ALERT: 'account-security-alert',
  WELCOME: 'welcome',

  // Orders (Buyers)
  ORDER_CONFIRMATION: 'order-confirmation',
  ORDER_SHIPPED: 'order-shipped',
  ORDER_STATUS_UPDATE: 'order-status-update',

  // Wishlist & Alerts (Buyers)
  PRICE_ALERT: 'price-alert',

  // Seller Notifications
  SELLER_NEW_ORDER: 'seller-new-order',
  SELLER_APPLICATION_APPROVED: 'seller-application-approved',
  SELLER_APPLICATION_REJECTED: 'seller-application-rejected',
  SELLER_PAYOUT_PROCESSED: 'seller-payout-processed',
  SELLER_INFO_REQUESTED: 'seller-info-requested',

  // Admin Notifications
  ADMIN_NEW_SELLER_APPLICATION: 'admin-new-seller-application',
  ADMIN_SYSTEM_ALERT: 'admin-system-alert',

  // Account Management
  EMAIL_PREFERENCES_UPDATE: 'email-preferences-update',
  ACCOUNT_DELETION: 'account-deletion-confirmation'
}

// ===== USER ROLE DEFINITIONS =====

export const USER_ROLES = {
  ADMIN: 'admin',
  SELLER: 'seller',
  BUYER: 'buyer'
}

// Define which templates are for which roles
const TEMPLATE_ROLES = {
  // Buyer templates
  [TEMPLATES.ORDER_CONFIRMATION]: [USER_ROLES.BUYER],
  [TEMPLATES.ORDER_SHIPPED]: [USER_ROLES.BUYER],
  [TEMPLATES.ORDER_STATUS_UPDATE]: [USER_ROLES.BUYER],
  [TEMPLATES.PRICE_ALERT]: [USER_ROLES.BUYER],

  // Seller templates
  [TEMPLATES.SELLER_NEW_ORDER]: [USER_ROLES.SELLER],
  [TEMPLATES.SELLER_APPLICATION_APPROVED]: [USER_ROLES.SELLER],
  [TEMPLATES.SELLER_APPLICATION_REJECTED]: [USER_ROLES.SELLER],
  [TEMPLATES.SELLER_PAYOUT_PROCESSED]: [USER_ROLES.SELLER],
  [TEMPLATES.SELLER_INFO_REQUESTED]: [USER_ROLES.SELLER],

  // Admin templates
  [TEMPLATES.ADMIN_NEW_SELLER_APPLICATION]: [USER_ROLES.ADMIN],
  [TEMPLATES.ADMIN_SYSTEM_ALERT]: [USER_ROLES.ADMIN],

  // All users
  [TEMPLATES.PASSWORD_RESET]: [USER_ROLES.ADMIN, USER_ROLES.SELLER, USER_ROLES.BUYER],
  [TEMPLATES.PASSWORD_RESET_CONFIRMATION]: [USER_ROLES.ADMIN, USER_ROLES.SELLER, USER_ROLES.BUYER],
  [TEMPLATES.ACCOUNT_SECURITY_ALERT]: [USER_ROLES.ADMIN, USER_ROLES.SELLER, USER_ROLES.BUYER],
  [TEMPLATES.WELCOME]: [USER_ROLES.ADMIN, USER_ROLES.SELLER, USER_ROLES.BUYER],
  [TEMPLATES.EMAIL_PREFERENCES_UPDATE]: [USER_ROLES.ADMIN, USER_ROLES.SELLER, USER_ROLES.BUYER],
  [TEMPLATES.ACCOUNT_DELETION]: [USER_ROLES.ADMIN, USER_ROLES.SELLER, USER_ROLES.BUYER]
}

// ===== VERIFY MAILGUN CONFIGURATION =====

export const verifyMailgunConfig = async () => {
  try {
    if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
      console.error('❌ Mailgun API key or domain not configured')
      return false
    }

    // Test API connection by getting domain info
    const domainInfo = await mg.domains.get(domain)
    console.log('✅ Mailgun service is ready:', domainInfo.name)
    return true
  } catch (error) {
    console.error('❌ Mailgun configuration error:', error.message)
    return false
  }
}

// Verify on startup
verifyMailgunConfig()

// ===== SEND EMAIL WITH TEMPLATE =====

/**
 * Send email using Mailgun template
 * @param {string} to - Recipient email address
 * @param {string} templateName - Name of the Mailgun template
 * @param {Object} templateVariables - Variables to pass to the template
 * @param {Object} options - Additional email options (subject, cc, bcc, etc.)
 * @param {string} userRole - User role to validate template access
 * @returns {Promise<Object>} - Result of sending email
 */
export const sendTemplatedEmail = async (to, templateName, templateVariables = {}, options = {}, userRole = null) => {
  try {
    if (!to || !templateName) {
      throw new Error('Email recipient and template name are required')
    }

    // Validate that template is appropriate for user role
    if (userRole && TEMPLATE_ROLES[templateName]) {
      if (!TEMPLATE_ROLES[templateName].includes(userRole)) {
        console.warn(`⚠️ Template ${templateName} is not intended for role ${userRole}`)
      }
    }

    // Prepare email data
    const emailData = {
      from: options.from || fromEmail,
      to: Array.isArray(to) ? to : [to],
      template: templateName,
      'h:X-Mailgun-Variables': JSON.stringify({
        ...templateVariables,
        current_year: new Date().getFullYear(),
        frontend_url: process.env.FRONTEND_URL || 'http://localhost:5173'
      })
    }

    // Add optional fields
    if (options.subject) emailData.subject = options.subject
    if (options.cc) emailData.cc = options.cc
    if (options.bcc) emailData.bcc = options.bcc
    if (options.replyTo) emailData['h:Reply-To'] = options.replyTo
    if (options.tags) emailData['o:tag'] = Array.isArray(options.tags) ? options.tags : [options.tags]
    if (options.testMode) emailData['o:testmode'] = 'yes'

    console.log(`📧 Sending templated email to: ${to} | Template: ${templateName}`)

    const result = await mg.messages.create(domain, emailData)

    console.log(`✅ Email sent successfully: ${result.id}`)
    return {
      success: true,
      messageId: result.id,
      message: result.message
    }
  } catch (error) {
    console.error('❌ Email sending failed:', error.message)
    throw new Error(`Failed to send email: ${error.message}`)
  }
}

// ===== SEND PLAIN EMAIL (WITHOUT TEMPLATE) =====

/**
 * Send plain email without template
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Result of sending email
 */
export const sendPlainEmail = async (to, subject, html, options = {}) => {
  try {
    if (!to || !subject || !html) {
      throw new Error('Email requires to, subject, and html content')
    }

    const emailData = {
      from: options.from || fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject,
      html
    }

    if (options.text) emailData.text = options.text
    if (options.cc) emailData.cc = options.cc
    if (options.bcc) emailData.bcc = options.bcc
    if (options.replyTo) emailData['h:Reply-To'] = options.replyTo
    if (options.tags) emailData['o:tag'] = Array.isArray(options.tags) ? options.tags : [options.tags]
    if (options.testMode) emailData['o:testmode'] = 'yes'

    console.log(`📧 Sending plain email to: ${to} | Subject: ${subject}`)

    const result = await mg.messages.create(domain, emailData)

    console.log(`✅ Email sent successfully: ${result.id}`)
    return {
      success: true,
      messageId: result.id,
      message: result.message
    }
  } catch (error) {
    console.error('❌ Email sending failed:', error.message)
    throw new Error(`Failed to send email: ${error.message}`)
  }
}

// ===== BULK EMAIL SENDING =====

/**
 * Send bulk emails using templates
 * @param {Array} recipients - Array of {email, templateVariables, userRole}
 * @param {string} templateName - Template to use
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} - Results of all email sends
 */
export const sendBulkTemplatedEmails = async (recipients, templateName, options = {}) => {
  const results = []
  const batchSize = 10 // Send in batches to avoid rate limiting

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize)
    const batchPromises = batch.map(async (recipient) => {
      try {
        const result = await sendTemplatedEmail(
          recipient.email,
          templateName,
          recipient.templateVariables || {},
          options,
          recipient.userRole
        )
        return { email: recipient.email, success: true, result }
      } catch (error) {
        return { email: recipient.email, success: false, error: error.message }
      }
    })

    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)

    // Small delay between batches
    if (i + batchSize < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  return results
}

// ===== TEMPLATE MANAGEMENT =====

/**
 * Create or update a template in Mailgun
 * @param {string} templateName - Name of the template
 * @param {string} description - Template description
 * @param {string} htmlContent - HTML content with handlebars variables
 * @param {string} textContent - Plain text version (optional)
 * @returns {Promise<Object>} - Result of template creation
 */
export const createOrUpdateTemplate = async (templateName, description, htmlContent, textContent = null) => {
  try {
    const templateData = {
      name: templateName,
      description: description,
      template: htmlContent,
      engine: 'handlebars',
      comment: `Updated on ${new Date().toISOString()}`
    }

    if (textContent) {
      templateData.text = textContent
    }

    const result = await mg.domains.domainTemplates.create(domain, templateData)

    console.log(`✅ Template created/updated: ${templateName}`)
    return result
  } catch (error) {
    console.error(`❌ Failed to create/update template ${templateName}:`, error.message)
    throw error
  }
}

/**
 * Get list of all templates
 * @returns {Promise<Array>} - List of templates
 */
export const listTemplates = async () => {
  try {
    const result = await mg.domains.domainTemplates.list(domain)
    return result.items || []
  } catch (error) {
    console.error('❌ Failed to list templates:', error.message)
    throw error
  }
}

/**
 * Get a specific template
 * @param {string} templateName - Name of the template
 * @returns {Promise<Object>} - Template details
 */
export const getTemplate = async (templateName) => {
  try {
    const result = await mg.domains.domainTemplates.get(domain, templateName)
    return result
  } catch (error) {
    console.error(`❌ Failed to get template ${templateName}:`, error.message)
    throw error
  }
}

/**
 * Delete a template
 * @param {string} templateName - Name of the template to delete
 * @returns {Promise<Object>} - Result of deletion
 */
export const deleteTemplate = async (templateName) => {
  try {
    const result = await mg.domains.domainTemplates.destroy(domain, templateName)
    console.log(`✅ Template deleted: ${templateName}`)
    return result
  } catch (error) {
    console.error(`❌ Failed to delete template ${templateName}:`, error.message)
    throw error
  }
}

// ===== EMAIL VALIDATION =====

/**
 * Validate email address format
 * @param {string} email - Email to validate
 * @returns {boolean} - Whether email is valid
 */
export const validateEmailAddress = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate email via Mailgun API
 * @param {string} email - Email to validate
 * @returns {Promise<Object>} - Validation result
 */
export const validateEmailViaMailgun = async (email) => {
  try {
    const result = await mg.validate.get(email)
    return result
  } catch (error) {
    console.error('❌ Email validation failed:', error.message)
    throw error
  }
}

// ===== TEST EMAIL SERVICE =====

export const testMailgunService = async () => {
  try {
    console.log('🧪 Testing Mailgun service...')

    const testEmail = process.env.TEST_EMAIL || 'test@example.com'

    const testResult = await sendPlainEmail(
      testEmail,
      '🧪 Mailgun Service Test - MTG Marketplace',
      `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .success { background: #d1fae5; padding: 15px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="success">
            <h2>✅ Mailgun Service Test Successful</h2>
            <p>If you're reading this, the Mailgun integration is working correctly!</p>
            <p><strong>Test Time:</strong> ${new Date().toISOString()}</p>
            <p><strong>Service:</strong> Mailgun API</p>
          </div>
        </body>
        </html>
      `,
      { testMode: true }
    )

    console.log('✅ Mailgun test successful:', testResult.messageId)
    return testResult
  } catch (error) {
    console.error('❌ Mailgun test failed:', error.message)
    throw error
  }
}

// ===== EXPORT FUNCTIONS =====

export default {
  sendTemplatedEmail,
  sendPlainEmail,
  sendBulkTemplatedEmails,
  createOrUpdateTemplate,
  listTemplates,
  getTemplate,
  deleteTemplate,
  validateEmailAddress,
  validateEmailViaMailgun,
  verifyMailgunConfig,
  testMailgunService,
  TEMPLATES,
  USER_ROLES
}
