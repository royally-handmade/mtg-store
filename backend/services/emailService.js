// services/emailService.js
import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

dotenv.config()

// ===== EMAIL TRANSPORTER CONFIGURATION =====

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false // Allow self-signed certificates
  }
})

// ===== VERIFY EMAIL CONFIGURATION =====

const verifyEmailConfig = async () => {
  try {
    await transporter.verify()
    console.log('✅ Email service is ready to send messages')
    return true
  } catch (error) {
    console.error('❌ Email service configuration error:', error.message)
    return false
  }
}

// Verify on startup
verifyEmailConfig()

// ===== BASE EMAIL SENDING FUNCTION =====

export const sendEmail = async (to, subject, html, options = {}) => {
  try {
    if (!to || !subject || !html) {
      throw new Error('Email requires to, subject, and html content')
    }

    const mailOptions = {
      from: {
        name: 'MTG Marketplace',
        address: process.env.FROM_EMAIL || process.env.SMTP_USER
      },
      to,
      subject,
      html,
      // Optional attachments, reply-to, etc.
      ...options
    }

    console.log(`📧 Sending email to: ${to} | Subject: ${subject}`)
    
    const info = await transporter.sendMail(mailOptions)
    
    console.log(`✅ Email sent successfully: ${info.messageId}`)
    return {
      success: true,
      messageId: info.messageId,
      response: info.response
    }
  } catch (error) {
    console.error('❌ Email sending failed:', error.message)
    throw new Error(`Failed to send email: ${error.message}`)
  }
}

// ===== EMAIL TEMPLATE HELPERS =====

const getBaseEmailTemplate = (content, title = 'MTG Marketplace') => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>${title}</title>
      <style>
        /* Reset styles */
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
        
        /* Base styles */
        body {
          margin: 0 !important;
          padding: 0 !important;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333333;
          background-color: #f4f4f4;
        }
        
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .header {
          background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
          color: #ffffff;
          padding: 30px 20px;
          text-align: center;
        }
        
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }
        
        .header .tagline {
          margin: 8px 0 0 0;
          font-size: 14px;
          color: #d1d5db;
          font-weight: 400;
        }
        
        .content {
          padding: 40px 30px;
          background-color: #ffffff;
        }
        
        .content h2 {
          color: #1f2937;
          font-size: 24px;
          margin: 0 0 20px 0;
          font-weight: 600;
        }
        
        .content p {
          margin: 0 0 16px 0;
          color: #4b5563;
          font-size: 16px;
          line-height: 1.6;
        }
        
        .content ul, .content ol {
          margin: 16px 0;
          padding-left: 20px;
          color: #4b5563;
        }
        
        .content li {
          margin: 8px 0;
        }
        
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: #ffffff !important;
          padding: 14px 28px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .button:hover {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          transform: translateY(-1px);
        }
        
        .alert {
          padding: 16px;
          border-radius: 6px;
          margin: 20px 0;
          border-left: 4px solid;
        }
        
        .alert-success {
          background-color: #d1fae5;
          border-color: #10b981;
          color: #065f46;
        }
        
        .alert-warning {
          background-color: #fef3cd;
          border-color: #f59e0b;
          color: #92400e;
        }
        
        .alert-danger {
          background-color: #fee2e2;
          border-color: #ef4444;
          color: #991b1b;
        }
        
        .alert-info {
          background-color: #dbeafe;
          border-color: #3b82f6;
          color: #1e40af;
        }
        
        .details-box {
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 20px;
          margin: 20px 0;
        }
        
        .footer {
          background-color: #f3f4f6;
          padding: 30px 20px;
          text-align: center;
          border-top: 1px solid #e5e7eb;
        }
        
        .footer p {
          margin: 8px 0;
          color: #6b7280;
          font-size: 14px;
        }
        
        .footer a {
          color: #3b82f6;
          text-decoration: none;
        }
        
        .footer a:hover {
          text-decoration: underline;
        }
        
        .social-links {
          margin: 20px 0;
        }
        
        .social-links a {
          display: inline-block;
          margin: 0 8px;
          color: #6b7280;
          text-decoration: none;
        }
        
        /* Responsive design */
        @media only screen and (max-width: 600px) {
          .container {
            margin: 0 !important;
            border-radius: 0 !important;
          }
          
          .content {
            padding: 30px 20px !important;
          }
          
          .header {
            padding: 25px 20px !important;
          }
          
          .header h1 {
            font-size: 24px !important;
          }
          
          .button {
            display: block !important;
            text-align: center !important;
            margin: 20px 0 !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🃏 MTG Marketplace</h1>
          <p class="tagline">Your Premier Magic: The Gathering Trading Platform</p>
        </div>
        
        <div class="content">
          ${content}
        </div>
        
        <div class="footer">
          <div class="social-links">
            <a href="#" title="Follow us on Twitter">Twitter</a>
            <a href="#" title="Like us on Facebook">Facebook</a>
            <a href="#" title="Connect on LinkedIn">LinkedIn</a>
          </div>
          
          <p>© ${new Date().getFullYear()} MTG Marketplace. All rights reserved.</p>
          <p>
            <a href="${process.env.FRONTEND_URL}/privacy">Privacy Policy</a> | 
            <a href="${process.env.FRONTEND_URL}/terms">Terms of Service</a> | 
            <a href="${process.env.FRONTEND_URL}/support">Support</a>
          </p>
          <p>
            MTG Marketplace, 123 Trading Card Lane, Vancouver, BC, Canada
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

// ===== PASSWORD RESET EMAIL =====

export const sendPasswordResetEmail = async (email, displayName) => {
  const content = `
    <h2>🔐 Password Reset Request</h2>
    
    <p>Hi <strong>${displayName || 'there'}</strong>,</p>
    
    <p>We received a request to reset your password for your MTG Marketplace account. If you didn't make this request, you can safely ignore this email.</p>
    
    <div class="alert alert-info">
      <strong>🛡️ Security Notice:</strong><br>
      This reset link will expire in <strong>1 hour</strong> for your security. If you need a new reset link, please request another one from our website.
    </div>
    
    <p>Click the button below to reset your password:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.FRONTEND_URL}/reset-password" class="button">
        🔑 Reset My Password
      </a>
    </div>
    
    <p>If you're having trouble clicking the button, you can copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #3b82f6; font-family: monospace; background: #f3f4f6; padding: 10px; border-radius: 4px;">
      ${process.env.FRONTEND_URL}/reset-password
    </p>
    
    <div class="details-box">
      <p><strong>For your security, we recommend:</strong></p>
      <ul>
        <li>Using a strong, unique password that you don't use elsewhere</li>
        <li>Including a mix of uppercase, lowercase, numbers, and symbols</li>
        <li>Avoiding common words or personal information</li>
        <li>Not sharing your account credentials with anyone</li>
      </ul>
    </div>
    
    <p>If you continue to have trouble accessing your account, please don't hesitate to contact our support team at <a href="mailto:support@mtgmarketplace.com">support@mtgmarketplace.com</a>.</p>
    
    <p>Best regards,<br>
    <strong>The MTG Marketplace Team</strong></p>
  `
  
  return await sendEmail(
    email, 
    '🔐 Password Reset Request - MTG Marketplace', 
    getBaseEmailTemplate(content, 'Password Reset - MTG Marketplace')
  )
}

// ===== PASSWORD RESET CONFIRMATION EMAIL =====

export const sendPasswordResetConfirmation = async (email, displayName) => {
  const timestamp = new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  })
  
  const content = `
    <div class="alert alert-success">
      <h2 style="margin: 0; color: #065f46;">✅ Password Successfully Updated</h2>
    </div>
    
    <p>Hi <strong>${displayName || 'there'}</strong>,</p>
    
    <p>Your password has been successfully updated for your MTG Marketplace account.</p>
    
    <div class="details-box">
      <p><strong>Update Details:</strong></p>
      <ul>
        <li><strong>Account:</strong> ${email}</li>
        <li><strong>Date & Time:</strong> ${timestamp}</li>
        <li><strong>Action:</strong> Password Reset</li>
      </ul>
    </div>
    
    <p>If you made this change, no further action is required. You can now sign in with your new password.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.FRONTEND_URL}/auth" class="button">
        🚀 Sign In to Your Account
      </a>
    </div>
    
    <div class="alert alert-warning">
      <p><strong>⚠️ Didn't make this change?</strong></p>
      <p>If you didn't update your password, please <strong>contact our support team immediately</strong> as your account may have been compromised.</p>
      <p>
        <a href="mailto:security@mtgmarketplace.com" style="color: #dc2626; font-weight: 600;">
          📧 security@mtgmarketplace.com
        </a>
      </p>
    </div>
    
    <div class="details-box">
      <p><strong>Security Best Practices:</strong></p>
      <ul>
        <li>Use a unique password that you don't use elsewhere</li>
        <li>Consider enabling two-factor authentication when available</li>
        <li>Regularly review your account activity</li>
        <li>Keep your email account secure</li>
        <li>Log out from shared or public devices</li>
      </ul>
    </div>
    
    <p>Thank you for keeping your account secure!</p>
    
    <p>Best regards,<br>
    <strong>The MTG Marketplace Security Team</strong></p>
  `
  
  return await sendEmail(
    email, 
    '✅ Password Updated Successfully - MTG Marketplace', 
    getBaseEmailTemplate(content, 'Password Updated - MTG Marketplace')
  )
}

// ===== ORDER CONFIRMATION EMAIL =====

export const sendOrderConfirmation = async (order, userEmail, orderItems = []) => {
  const itemsHtml = orderItems.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
        <img src="${item.card_image || '/placeholder-card.jpg'}" alt="${item.card_name}" 
             style="width: 40px; height: 56px; object-fit: cover; border-radius: 4px;">
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
        <strong>${item.card_name}</strong><br>
        <small style="color: #6b7280;">${item.set_name} • ${item.condition.toUpperCase()}</small>
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        ${item.quantity}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">
        $${(item.price * item.quantity).toFixed(2)} CAD
      </td>
    </tr>
  `).join('')
  
  const content = `
    <h2>🛒 Order Confirmation</h2>
    
    <div class="alert alert-success">
      <p style="margin: 0;"><strong>Thank you for your order!</strong> We've received your purchase and are processing it now.</p>
    </div>
    
    <div class="details-box">
      <p><strong>Order Details:</strong></p>
      <ul>
        <li><strong>Order ID:</strong> #${order.id.slice(0, 8).toUpperCase()}</li>
        <li><strong>Order Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</li>
        <li><strong>Status:</strong> ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</li>
      </ul>
    </div>
    
    ${orderItems.length > 0 ? `
    <h3>📦 Items Ordered:</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 12px 10px; text-align: left; border-bottom: 2px solid #e5e7eb;">Card</th>
          <th style="padding: 12px 10px; text-align: left; border-bottom: 2px solid #e5e7eb;">Details</th>
          <th style="padding: 12px 10px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
          <th style="padding: 12px 10px; text-align: right; border-bottom: 2px solid #e5e7eb;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    ` : ''}
    
    <div style="background: #f3f4f6; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <table style="width: 100%;">
        <tr>
          <td style="padding: 5px 0;"><strong>Subtotal:</strong></td>
          <td style="padding: 5px 0; text-align: right;">$${order.subtotal} CAD</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;"><strong>Shipping:</strong></td>
          <td style="padding: 5px 0; text-align: right;">$${order.shipping_cost} CAD</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;"><strong>Tax:</strong></td>
          <td style="padding: 5px 0; text-align: right;">$${order.tax_amount} CAD</td>
        </tr>
        <tr style="border-top: 2px solid #d1d5db;">
          <td style="padding: 10px 0; font-size: 18px;"><strong>Total:</strong></td>
          <td style="padding: 10px 0; text-align: right; font-size: 18px; font-weight: bold; color: #059669;">
            $${order.total_amount} CAD
          </td>
        </tr>
      </table>
    </div>
    
    <div class="alert alert-info">
      <p><strong>📧 What's Next?</strong></p>
      <ul style="margin: 10px 0;">
        <li>We'll send you tracking information once your order ships</li>
        <li>You can track your order status in your account dashboard</li>
        <li>Estimated delivery: 3-7 business days</li>
      </ul>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.FRONTEND_URL}/orders/${order.id}" class="button">
        📋 View Order Details
      </a>
    </div>
    
    <p>If you have any questions about your order, please don't hesitate to contact us at <a href="mailto:orders@mtgmarketplace.com">orders@mtgmarketplace.com</a>.</p>
    
    <p>Thank you for choosing MTG Marketplace!</p>
    
    <p>Best regards,<br>
    <strong>The MTG Marketplace Team</strong></p>
  `
  
  return await sendEmail(
    userEmail, 
    `🛒 Order Confirmation #${order.id.slice(0, 8).toUpperCase()} - MTG Marketplace`, 
    getBaseEmailTemplate(content, 'Order Confirmation')
  )
}

// ===== SHIPPING NOTIFICATION EMAIL =====

export const sendShippingNotification = async (order, userEmail, trackingUrl = null) => {
  const content = `
    <h2>📦 Your Order Has Shipped!</h2>
    
    <div class="alert alert-success">
      <p style="margin: 0;"><strong>Great news!</strong> Your MTG cards are on their way to you.</p>
    </div>
    
    <div class="details-box">
      <p><strong>Shipping Details:</strong></p>
      <ul>
        <li><strong>Order ID:</strong> #${order.id.slice(0, 8).toUpperCase()}</li>
        <li><strong>Tracking Number:</strong> <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px;">${order.tracking_number}</code></li>
        <li><strong>Shipped Date:</strong> ${new Date().toLocaleDateString()}</li>
        <li><strong>Estimated Delivery:</strong> 3-7 business days</li>
      </ul>
    </div>
    
    ${trackingUrl ? `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${trackingUrl}" class="button">
        🚚 Track Your Package
      </a>
    </div>
    ` : ''}
    
    <div class="alert alert-info">
      <p><strong>📋 Delivery Information:</strong></p>
      <ul style="margin: 10px 0;">
        <li>Please ensure someone is available to receive the package</li>
        <li>Cards are packaged securely to prevent damage</li>
        <li>If you're not home, the carrier may leave a delivery notice</li>
        <li>Contact us immediately if there are any issues with your delivery</li>
      </ul>
    </div>
    
    <p>You can track your package using the tracking number above, or by visiting your order details page:</p>
    
    <div style="text-align: center; margin: 20px 0;">
      <a href="${process.env.FRONTEND_URL}/orders/${order.id}" class="button" style="background: #6b7280;">
        📋 View Order Details
      </a>
    </div>
    
    <p>We hope you enjoy your new cards! Don't forget to leave a review for the seller once you receive your order.</p>
    
    <p>Happy gaming!</p>
    
    <p>Best regards,<br>
    <strong>The MTG Marketplace Team</strong></p>
  `
  
  return await sendEmail(
    userEmail, 
    `📦 Order #${order.id.slice(0, 8).toUpperCase()} Has Shipped - MTG Marketplace`, 
    getBaseEmailTemplate(content, 'Order Shipped')
  )
}

// ===== PRICE ALERT EMAIL =====

export const sendPriceAlert = async (userEmail, card, newPrice, maxPrice) => {
  const savings = (maxPrice - newPrice).toFixed(2)
  const savingsPercent = ((savings / maxPrice) * 100).toFixed(1)
  
  const content = `
    <h2>💰 Price Alert - Your Card Got Cheaper!</h2>
    
    <div class="alert alert-success">
      <p style="margin: 0;"><strong>Excellent news!</strong> A card on your wishlist has dropped below your target price.</p>
    </div>
    
    <div style="display: flex; align-items: center; background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <div style="flex-shrink: 0; margin-right: 20px;">
        <img src="${card.image_url || '/placeholder-card.jpg'}" alt="${card.name}" 
             style="width: 80px; height: 112px; object-fit: cover; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      </div>
      <div style="flex-grow: 1;">
        <h3 style="margin: 0 0 8px 0; color: #1f2937;">${card.name}</h3>
        <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 14px;">
          ${card.set_name || 'Unknown Set'} • ${card.rarity || 'Unknown Rarity'}
        </p>
        <div style="margin-top: 12px;">
          <span style="background: #ef4444; color: white; padding: 4px 8px; border-radius: 4px; font-size: 14px; text-decoration: line-through;">
            $${maxPrice} CAD
          </span>
          <span style="background: #10b981; color: white; padding: 4px 8px; border-radius: 4px; font-size: 16px; font-weight: bold; margin-left: 8px;">
            $${newPrice} CAD
          </span>
          <span style="color: #059669; font-weight: bold; margin-left: 8px;">
            Save $${savings} (${savingsPercent}%)
          </span>
        </div>
      </div>
    </div>
    
    <div class="details-box">
      <p><strong>Price Comparison:</strong></p>
      <ul>
        <li><strong>Your Max Price:</strong> $${maxPrice} CAD</li>
        <li><strong>Current Price:</strong> $${newPrice} CAD</li>
        <li><strong>You Save:</strong> $${savings} CAD (${savingsPercent}%)</li>
      </ul>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.FRONTEND_URL}/card/${card.id}" class="button">
        🃏 View Card & Buy Now
      </a>
    </div>
    
    <div class="alert alert-warning">
      <p><strong>⏰ Don't Wait!</strong></p>
      <p>Card prices can change quickly. This price might not last long, so consider purchasing soon if you're interested.</p>
    </div>
    
    <p>This alert was triggered because the card's current market price ($${newPrice} CAD) is now below your maximum price preference of $${maxPrice} CAD.</p>
    
    <p>You can manage your price alerts and wishlist preferences in your account dashboard.</p>
    
    <div style="text-align: center; margin: 20px 0;">
      <a href="${process.env.FRONTEND_URL}/wishlist" class="button" style="background: #6b7280;">
        ❤️ Manage Wishlist
      </a>
    </div>
    
    <p>Happy collecting!</p>
    
    <p>Best regards,<br>
    <strong>The MTG Marketplace Team</strong></p>
  `
  
  return await sendEmail(
    userEmail, 
    `💰 Price Alert: ${card.name} - Now $${newPrice} CAD!`, 
    getBaseEmailTemplate(content, 'Price Alert')
  )
}

// ===== SECURITY ALERT EMAIL =====

export const sendAccountSecurityAlert = async (email, displayName, action, details = {}) => {
  const timestamp = new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  })
  
  const content = `
    <h2>🔐 Security Alert</h2>
    
    <div class="alert alert-danger">
      <p style="margin: 0;"><strong>Account Security Activity Detected</strong></p>
      <p style="margin: 8px 0 0 0;">We detected security-related activity on your MTG Marketplace account.</p>
    </div>
    
    <p>Hi <strong>${displayName || 'there'}</strong>,</p>
    
    <p>We detected the following security-related activity on your account:</p>
    
    <div class="details-box">
      <p><strong>Security Event Details:</strong></p>
      <ul>
        <li><strong>Action:</strong> ${action}</li>
        <li><strong>Date & Time:</strong> ${timestamp}</li>
        ${details.ip ? `<li><strong>IP Address:</strong> ${details.ip}</li>` : ''}
        ${details.location ? `<li><strong>Location:</strong> ${details.location}</li>` : ''}
        ${details.userAgent ? `<li><strong>Device/Browser:</strong> ${details.userAgent}</li>` : ''}
      </ul>
    </div>
    
    <div class="alert alert-info">
      <p><strong>✅ Was this you?</strong></p>
      <p>If you recognize this activity, no further action is needed. Your account remains secure.</p>
    </div>
    
    <div class="alert alert-warning">
      <p><strong>⚠️ Don't recognize this activity?</strong></p>
      <p>If this wasn't you, please take immediate action:</p>
      <ol style="margin: 10px 0;">
        <li><strong>Change your password immediately</strong></li>
        <li><strong>Review your recent account activity</strong></li>
        <li><strong>Contact our support team</strong></li>
        <li><strong>Check for any unauthorized orders or changes</strong></li>
      </ol>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.FRONTEND_URL}/auth" class="button" style="background: #dc2626;">
        🔐 Secure My Account
      </a>
    </div>
    
    <div class="details-box">
      <p><strong>🛡️ Security Recommendations:</strong></p>
      <ul>
        <li>Use a strong, unique password for your MTG Marketplace account</li>
        <li>Never share your login credentials with anyone</li>
        <li>Always log out when using shared or public computers</li>
        <li>Keep your email account secure with two-factor authentication</li>
        <li>Be cautious of phishing emails asking for your login information</li>
      </ul>
    </div>
    
    <p>Your account security is our top priority. If you have any concerns or questions, please contact our security team immediately:</p>
    
    <p style="text-align: center; margin: 20px 0;">
      <a href="mailto:security@mtgmarketplace.com" style="color: #dc2626; font-weight: bold; font-size: 16px;">
        📧 security@mtgmarketplace.com
      </a>
    </p>
    
    <p>Stay safe and secure!</p>
    
    <p>Best regards,<br>
    <strong>The MTG Marketplace Security Team</strong></p>
  `
  
  return await sendEmail(
    email, 
    `🔐 Security Alert - MTG Marketplace Account Activity`, 
    getBaseEmailTemplate(content, 'Security Alert')
  )
}

// ===== SELLER APPROVAL EMAIL =====

export const sendSellerApprovalEmail = async (email, displayName, approved = true) => {
  const content = approved ? `
    <h2>🎉 Seller Application Approved!</h2>
    
    <div class="alert alert-success">
      <p style="margin: 0;"><strong>Congratulations!</strong> Your seller application has been approved.</p>
    </div>
    
    <p>Hi <strong>${displayName}</strong>,</p>
    
    <p>Great news! Your application to become a seller on MTG Marketplace has been <strong>approved</strong>. You can now start listing your Magic: The Gathering cards for sale.</p>
    
    <div class="details-box">
      <p><strong>✅ What you can do now:</strong></p>
      <ul>
        <li>Create listings for your MTG cards</li>
        <li>Set your own prices and conditions</li>
        <li>Manage your inventory through the seller dashboard</li>
        <li>Upload bulk listings via CSV</li>
        <li>Configure your payout settings</li>
        <li>Track your sales and earnings</li>
      </ul>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.FRONTEND_URL}/seller" class="button">
        🚀 Go to Seller Dashboard
      </a>
    </div>
    
    <div class="alert alert-info">
      <p><strong>📋 Getting Started Tips:</strong></p>
      <ul style="margin: 10px 0;">
        <li>Complete your seller profile with accurate information</li>
        <li>Set up your payout method in the dashboard</li>
        <li>Take clear, well-lit photos of your cards</li>
        <li>Be honest about card conditions</li>
        <li>Respond promptly to buyer inquiries</li>
        <li>Ship orders quickly and securely</li>
      </ul>
    </div>
    
    <p><strong>💰 Fees & Payouts:</strong></p>
    <ul>
      <li>Platform fee: 2.5% per transaction</li>
      <li>Minimum payout: $25 CAD</li>
      <li>Payouts processed weekly on Fridays</li>
    </ul>
    
    <p>If you have any questions about selling on our platform, please check out our <a href="${process.env.FRONTEND_URL}/seller-guide">Seller Guide</a> or contact our support team.</p>
    
    <p>Welcome to the MTG Marketplace seller community!</p>
  ` : `
    <h2>❌ Seller Application Status</h2>
    
    <div class="alert alert-danger">
      <p style="margin: 0;"><strong>Application Not Approved</strong> - We're unable to approve your seller application at this time.</p>
    </div>
    
    <p>Hi <strong>${displayName}</strong>,</p>
    
    <p>Thank you for your interest in becoming a seller on MTG Marketplace. After reviewing your application, we're unable to approve it at this time.</p>
    
    <div class="details-box">
      <p><strong>Common reasons for non-approval:</strong></p>
      <ul>
        <li>Incomplete or inaccurate information provided</li>
        <li>Insufficient trading history or reputation</li>
        <li>Concerns about account security or verification</li>
        <li>Previous policy violations on our platform</li>
      </ul>
    </div>
    
    <div class="alert alert-info">
      <p><strong>💡 What's Next?</strong></p>
      <p>You can reapply for seller status in 30 days. In the meantime, we encourage you to:</p>
      <ul style="margin: 10px 0;">
        <li>Build your reputation as a buyer</li>
        <li>Complete your profile information</li>
        <li>Familiarize yourself with our platform policies</li>
      </ul>
    </div>
    
    <p>If you have questions about this decision, please contact our support team.</p>
  `
  
  const subject = approved ? 
    '🎉 Seller Application Approved - MTG Marketplace' : 
    '❌ Seller Application Status - MTG Marketplace'
  
  return await sendEmail(email, subject, getBaseEmailTemplate(content, 'Seller Application'))
}

// ===== WELCOME EMAIL =====

export const sendWelcomeEmail = async (email, displayName, role = 'buyer') => {
  const content = `
    <h2>🎉 Welcome to MTG Marketplace!</h2>
    
    <div class="alert alert-success">
      <p style="margin: 0;"><strong>Welcome aboard!</strong> Your account has been successfully created.</p>
    </div>
    
    <p>Hi <strong>${displayName}</strong>,</p>
    
    <p>Welcome to MTG Marketplace, the premier destination for buying and selling Magic: The Gathering cards! We're excited to have you join our community of passionate players and collectors.</p>
    
    <div class="details-box">
      <p><strong>🃏 What you can do on MTG Marketplace:</strong></p>
      <ul>
        <li><strong>Browse thousands of cards</strong> from verified sellers worldwide</li>
        <li><strong>Build decks</strong> with our intuitive deck builder tool</li>
        <li><strong>Create wishlists</strong> and get price alerts</li>
        <li><strong>Track market prices</strong> and trends</li>
        <li><strong>Connect with the community</strong> of MTG enthusiasts</li>
        ${role === 'seller' || role === 'buyer' ? '<li><strong>Start selling</strong> your cards after approval</li>' : ''}
      </ul>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.FRONTEND_URL}/cards" class="button">
        🔍 Start Browsing Cards
      </a>
    </div>
    
    <div class="alert alert-info">
      <p><strong>🚀 Quick Start Guide:</strong></p>
      <ol style="margin: 10px 0;">
        <li><strong>Complete your profile</strong> - Add your details and preferences</li>
        <li><strong>Explore the marketplace</strong> - Browse cards by set, type, or search</li>
        <li><strong>Build your first deck</strong> - Use our deck builder tool</li>
        <li><strong>Add cards to your wishlist</strong> - Get notified of price drops</li>
        ${role === 'seller' ? '<li><strong>Apply to become a seller</strong> - Start your selling journey</li>' : ''}
      </ol>
    </div>
    
    <h3>🛡️ Your Security Matters</h3>
    <p>We take your account security seriously. Here are some tips to keep your account safe:</p>
    <ul>
      <li>Use a strong, unique password</li>
      <li>Never share your login credentials</li>
      <li>Log out when using public computers</li>
      <li>Contact us immediately if you notice suspicious activity</li>
    </ul>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.FRONTEND_URL}/dashboard" class="button" style="background: #6b7280;">
        📊 Go to Dashboard
      </a>
    </div>
    
    <p>If you have any questions, our support team is here to help. You can reach us at <a href="mailto:support@mtgmarketplace.com">support@mtgmarketplace.com</a>.</p>
    
    <p>Happy trading!</p>
    
    <p>Best regards,<br>
    <strong>The MTG Marketplace Team</strong></p>
  `
  
  return await sendEmail(
    email, 
    '🎉 Welcome to MTG Marketplace - Your Journey Begins!', 
    getBaseEmailTemplate(content, 'Welcome to MTG Marketplace')
  )
}

// ===== ORDER STATUS UPDATE EMAIL =====

export const sendOrderStatusUpdate = async (order, userEmail, oldStatus, newStatus) => {
  const statusMessages = {
    pending: { emoji: '⏳', message: 'We\'ve received your order and it\'s being prepared.' },
    processing: { emoji: '📦', message: 'Your order is being processed and prepared for shipment.' },
    shipped: { emoji: '🚚', message: 'Your order has been shipped and is on its way to you!' },
    delivered: { emoji: '✅', message: 'Your order has been delivered successfully.' },
    cancelled: { emoji: '❌', message: 'Your order has been cancelled.' }
  }
  
  const statusInfo = statusMessages[newStatus] || { emoji: '📋', message: 'Your order status has been updated.' }
  
  const content = `
    <h2>${statusInfo.emoji} Order Status Update</h2>
    
    <div class="alert ${newStatus === 'cancelled' ? 'alert-danger' : 'alert-info'}">
      <p style="margin: 0;"><strong>Order #${order.id.slice(0, 8).toUpperCase()}</strong> - ${statusInfo.message}</p>
    </div>
    
    <div class="details-box">
      <p><strong>Order Details:</strong></p>
      <ul>
        <li><strong>Order ID:</strong> #${order.id.slice(0, 8).toUpperCase()}</li>
        <li><strong>Previous Status:</strong> ${oldStatus.charAt(0).toUpperCase() + oldStatus.slice(1)}</li>
        <li><strong>Current Status:</strong> ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}</li>
        <li><strong>Updated:</strong> ${new Date().toLocaleString()}</li>
        ${order.tracking_number ? `<li><strong>Tracking:</strong> ${order.tracking_number}</li>` : ''}
      </ul>
    </div>
    
    ${newStatus === 'shipped' && order.tracking_number ? `
    <div style="text-align: center; margin: 30px 0;">
      <a href="#" class="button">
        🚚 Track Your Package
      </a>
    </div>
    ` : ''}
    
    ${newStatus === 'delivered' ? `
    <div class="alert alert-success">
      <p><strong>🎉 Enjoy your new cards!</strong></p>
      <p>We hope you're happy with your purchase. Consider leaving a review for the seller to help other buyers.</p>
    </div>
    ` : ''}
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.FRONTEND_URL}/orders/${order.id}" class="button" style="background: #6b7280;">
        📋 View Order Details
      </a>
    </div>
    
    <p>If you have any questions about your order, please don't hesitate to contact us.</p>
    
    <p>Best regards,<br>
    <strong>The MTG Marketplace Team</strong></p>
  `
  
  return await sendEmail(
    userEmail, 
    `${statusInfo.emoji} Order #${order.id.slice(0, 8).toUpperCase()} - ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`, 
    getBaseEmailTemplate(content, 'Order Status Update')
  )
}

// ===== BULK EMAIL FUNCTIONS =====

export const sendBulkEmails = async (emailList, subject, htmlContent) => {
  const results = []
  const batchSize = 10 // Send in batches to avoid overwhelming SMTP server
  
  for (let i = 0; i < emailList.length; i += batchSize) {
    const batch = emailList.slice(i, i + batchSize)
    const batchPromises = batch.map(async (emailData) => {
      try {
        const result = await sendEmail(
          emailData.email, 
          subject, 
          htmlContent.replace(/{{name}}/g, emailData.name || 'Valued Customer')
        )
        return { email: emailData.email, success: true, result }
      } catch (error) {
        return { email: emailData.email, success: false, error: error.message }
      }
    })
    
    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)
    
    // Small delay between batches
    if (i + batchSize < emailList.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  return results
}

// ===== EMAIL VALIDATION =====

export const validateEmailAddress = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// ===== EMAIL PREFERENCES =====

export const sendEmailPreferencesUpdate = async (email, displayName, preferences) => {
  const content = `
    <h2>📧 Email Preferences Updated</h2>
    
    <p>Hi <strong>${displayName}</strong>,</p>
    
    <p>Your email preferences have been successfully updated.</p>
    
    <div class="details-box">
      <p><strong>Your Current Email Settings:</strong></p>
      <ul>
        <li><strong>Order Updates:</strong> ${preferences.orderUpdates ? '✅ Enabled' : '❌ Disabled'}</li>
        <li><strong>Price Alerts:</strong> ${preferences.priceAlerts ? '✅ Enabled' : '❌ Disabled'}</li>
        <li><strong>Marketing Emails:</strong> ${preferences.marketing ? '✅ Enabled' : '❌ Disabled'}</li>
        <li><strong>Security Alerts:</strong> ${preferences.security ? '✅ Enabled' : '❌ Disabled'}</li>
      </ul>
    </div>
    
    <p>You can update these preferences anytime in your account settings.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.FRONTEND_URL}/profile" class="button">
        ⚙️ Manage Preferences
      </a>
    </div>
    
    <p>Best regards,<br>
    <strong>The MTG Marketplace Team</strong></p>
  `
  
  return await sendEmail(
    email, 
    '📧 Email Preferences Updated - MTG Marketplace', 
    getBaseEmailTemplate(content, 'Email Preferences')
  )
}

export const sendAccountDeletionConfirmation = async (email, displayName) => {
  const content = `
    <h2>🗑️ Account Deletion Confirmation</h2>
    
    <div class="alert alert-info">
      <p style="margin: 0;"><strong>Account Successfully Deleted</strong></p>
      <p style="margin: 8px 0 0 0;">Your MTG Marketplace account has been permanently deleted.</p>
    </div>
    
    <p>Hi <strong>${displayName || 'there'}</strong>,</p>
    
    <p>This email confirms that your MTG Marketplace account has been permanently deleted as requested.</p>
    
    <div class="details-box">
      <p><strong>What was deleted:</strong></p>
      <ul>
        <li>Your profile and personal information</li>
        <li>Order history and purchase records</li>
        <li>Listings and seller data (if applicable)</li>
        <li>Wishlist and saved items</li>
        <li>All account preferences and settings</li>
      </ul>
    </div>
    
    <div class="alert alert-warning">
      <p><strong>⚠️ Important Information:</strong></p>
      <ul style="margin: 10px 0;">
        <li>This action cannot be undone</li>
        <li>Any pending orders or transactions have been processed according to our policies</li>
        <li>You will no longer receive any emails from MTG Marketplace</li>
        <li>Your username and email are now available for new registrations</li>
      </ul>
    </div>
    
    <p>If you deleted your account by mistake or have any concerns, please contact our support team within 7 days. After this period, we may not be able to assist with account recovery.</p>
    
    <p>Thank you for being part of the MTG Marketplace community. We're sorry to see you go!</p>
    
    <p>Best regards,<br>
    <strong>The MTG Marketplace Team</strong></p>
  `
  
  return await sendEmail(
    email, 
    '🗑️ Account Deletion Confirmation - MTG Marketplace', 
    getBaseEmailTemplate(content, 'Account Deleted')
  )
}


// ===== EXPORT FUNCTIONS =====

export default {
  sendEmail,
  sendPasswordResetEmail,
  sendPasswordResetConfirmation,
  sendOrderConfirmation,
  sendShippingNotification,
  sendPriceAlert,
  sendAccountSecurityAlert,
  sendSellerApprovalEmail,
  sendWelcomeEmail,
  sendOrderStatusUpdate,
  sendBulkEmails,
  sendEmailPreferencesUpdate,
  validateEmailAddress,
  verifyEmailConfig
}

// ===== TESTING FUNCTIONS =====

export const testEmailService = async () => {
  try {
    console.log('🧪 Testing email service...')
    
    const testEmail = process.env.TEST_EMAIL || process.env.SMTP_USER
    if (!testEmail) {
      throw new Error('No test email configured. Set TEST_EMAIL in environment variables.')
    }
    
    const testResult = await sendEmail(
      testEmail,
      '🧪 MTG Marketplace Email Test',
      getBaseEmailTemplate(`
        <h2>✅ Email Service Test</h2>
        <p>If you're reading this, the email service is working correctly!</p>
        <p><strong>Test Time:</strong> ${new Date().toISOString()}</p>
        <div class="alert alert-success">
          <p>All email functions are operational.</p>
        </div>
      `, 'Email Service Test')
    )
    
    console.log('✅ Email test successful:', testResult.messageId)
    return testResult
  } catch (error) {
    console.error('❌ Email test failed:', error.message)
    throw error
  }
}

// ===== EMAIL QUEUE SYSTEM (Optional) =====

class EmailQueue {
  constructor() {
    this.queue = []
    this.processing = false
    this.maxRetries = 3
    this.retryDelay = 5000 // 5 seconds
  }
  
  async add(emailData) {
    this.queue.push({
      ...emailData,
      id: Date.now() + Math.random(),
      attempts: 0,
      createdAt: new Date()
    })
    
    if (!this.processing) {
      this.process()
    }
  }
  
  async process() {
    if (this.processing || this.queue.length === 0) return
    
    this.processing = true
    
    while (this.queue.length > 0) {
      const emailJob = this.queue.shift()
      
      try {
        await sendEmail(emailJob.to, emailJob.subject, emailJob.html, emailJob.options)
        console.log(`✅ Email sent successfully: ${emailJob.id}`)
      } catch (error) {
        console.error(`❌ Email failed: ${emailJob.id}`, error.message)
        
        emailJob.attempts++
        if (emailJob.attempts < this.maxRetries) {
          console.log(`🔄 Retrying email: ${emailJob.id} (attempt ${emailJob.attempts}/${this.maxRetries})`)
          setTimeout(() => {
            this.queue.push(emailJob)
          }, this.retryDelay)
        } else {
          console.error(`💀 Email permanently failed: ${emailJob.id}`)
        }
      }
      
      // Small delay between emails
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    this.processing = false
  }
}

export const emailQueue = new EmailQueue()



// ===== USAGE EXAMPLES =====

/*
// Basic email
await sendEmail('user@example.com', 'Test Subject', '<h1>Hello World</h1>')

// Password reset
await sendPasswordResetEmail('user@example.com', 'John Doe')

// Order confirmation
await sendOrderConfirmation(orderData, 'user@example.com', orderItems)

// Price alert
await sendPriceAlert('user@example.com', cardData, 5.99, 10.00)

// Bulk emails
await sendBulkEmails([
  { email: 'user1@example.com', name: 'User 1' },
  { email: 'user2@example.com', name: 'User 2' }
], 'Newsletter', '<h1>Hello {{name}}!</h1>')

// Using email queue (fire and forget)
emailQueue.add({
  to: 'user@example.com',
  subject: 'Async Email',
  html: '<h1>Hello</h1>'
})

// Test email service
await testEmailService()
*/