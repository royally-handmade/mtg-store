// backend/services/helcimService.js
// Proper HelcimPay.js integration using official Helcim API endpoints

import fetch from 'node-fetch'
import crypto from 'crypto'
import { supabase } from '../server.js'

class HelcimService {
  constructor() {
    this.apiToken = process.env.HELCIM_API_TOKEN
    this.baseURL = process.env.HELCIM_ENVIRONMENT === 'production'
      ? 'https://api.helcim.com/v2'
      : 'https://api.helcim.com/v2'
    this.webhookSecret = process.env.HELCIM_WEBHOOK_SECRET

    if (!this.apiToken) {
      console.error('HELCIM_API_TOKEN is required for HelcimPay.js integration')
    }
  }

  // ===== HELCIMPAY.JS INITIALIZATION =====

  /**
   * Initialize HelcimPay.js checkout session
   * https://devdocs.helcim.com/docs/initialize-helcimpayjs
   */
  async initializeCheckoutSession(sessionData) {
    try {
      const {
        paymentType = 'purchase',
        amount,
        currency = 'CAD',
        orderNumber,
        description,
        customer,
        billingAddress,
        shippingAddress,
        taxAmount
      } = sessionData

      const payload = {
        paymentType: paymentType,
        amount: amount,
        currency: currency.toUpperCase(),

        // Order information
        ...(orderNumber && { orderNumber }),
        ...(description && { description }),

        // Customer information
        ...(customer && {
          customerRequest: {
            //customerCode: customer.customerCode + '1',
            contactName: customer.name,
            email: customer.email,
            billingAddress: {
              name: billingAddress.name,
              street1: billingAddress.street1,
              street2: billingAddress.street2 || '',
              city: billingAddress.city,
              province: billingAddress.province,
              country: 'CAN', //billingAddress.country,
              postalCode: billingAddress.postalCode,
              phone: billingAddress.phone || '',
              email: billingAddress.email || customer?.email
            },
            shippingAddress: {
              name: shippingAddress.name,
              street1: shippingAddress.street1,
              street2: shippingAddress.street2 || '',
              city: shippingAddress.city,
              province: shippingAddress.province,
              country: 'CAN', //shippingAddress.country,
              postalCode: shippingAddress.postalCode,
              phone: shippingAddress.phone || ''
            }
          }
        }),

        // Payment configuration
        allowPartial: 0,
        taxAmount: taxAmount,

        // UI customization
        customStyling: {
          brandColor: '059669',
          cornerRadius: 'pill'
        }

        // Test mode
        // test: process.env.HELCIM_ENVIRONMENT !== 'production'
      }

      const response = await fetch(`${this.baseURL}/helcim-pay/initialize`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
          'api-token': this.apiToken
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('Helcim initialization failed:', response.status, errorData)

        let errorMessage = 'Failed to initialize payment session'
        try {
          const errorJson = JSON.parse(errorData)
          errorMessage = errorJson.message || errorMessage
        } catch (e) {
          // Use default message if JSON parsing fails
        }

        throw new Error(errorMessage)
      }

      const data = await response.json()

      // Log successful initialization
      await this.logTransaction('initialization', {
        checkoutToken: data.checkoutToken,
        amount: amount,
        currency: currency,
        paymentType: paymentType
      }, 'success')

      return {
        success: true,
        checkoutToken: data.checkoutToken,
        secretToken: data.secretToken,
        expiresIn: 3600 // 60 minutes in seconds
      }

    } catch (error) {
      console.error('HelcimPay initialization error:', error)

      // Log failed initialization
      await this.logTransaction('initialization', {
        error: error.message,
        amount: sessionData.amount,
        currency: sessionData.currency
      }, 'error')

      throw error
    }
  }

  // ===== PAYMENT VALIDATION =====

  /**
   * Validate HelcimPay.js transaction response
   * https://devdocs.helcim.com/docs/validate-helcimpayjs
   */
  validateTransactionResponse(transactionData, secretToken, helcimHash) {
    try {
      // Clean and stringify the transaction data consistently
      const cleanedJsonData = JSON.stringify(transactionData.data)

      // Create hash with secret token
      const yourHash = crypto
        .createHash('sha256')
        .update(cleanedJsonData + secretToken)
        .digest('hex')

      // Compare hashes
      const isValid = yourHash === transactionData.hash

      if (!isValid) {
        console.error('Hash validation failed:', {
          expected: helcimHash,
          calculated: yourHash,
          data: cleanedJsonData,
          hash: transactionData.hash
        })
      }

      return {
        isValid,
        calculatedHash: yourHash,
        providedHash: helcimHash
      }
    } catch (error) {
      console.error('Hash validation error:', error)
      return {
        isValid: false,
        error: error.message
      }
    }
  }

  /**
   * Process and validate complete transaction
   */
  async processTransactionResponse(checkoutToken, transactionResponse, secretToken) {
    try {
      const { data: transactionData, hash: helcimHash } = transactionResponse


            // Extract transaction details
      const transaction = {
        transactionId: transactionData.data.transactionId,
        status: transactionData.data.status,
        type: transactionData.data.type,
        amount: parseFloat(transactionData.data.amount),
        currency: transactionData.data.currency,
        approvalCode: transactionData.data.approvalCode,
        cardToken: transactionData.data.cardToken,
        cardLast4: transactionData.data.cardNumber ? transactionData.data.cardNumber.slice(-4) : null,
        cardType: this.detectCardType(transactionData.data.cardNumber),
        cardHolderName: transactionData.data.cardHolderName,
        customerCode: transactionData.data.customerCode,
        invoiceNumber: transactionData.data.invoiceNumber,
        dateCreated: transactionData.data.dateCreated,
        avsResponse: transactionData.data.avsResponse,
        cvvResponse: transactionData.data.cvvResponse,
        cardBatchId: transactionData.data.cardBatchId,

        // ACH specific fields (if applicable)
        bankToken: transactionData.data.bankToken,
        bankAccountNumber: transactionData.data.bankAccountNumber ?
          transactionData.data.bankAccountNumber.slice(-4) : null
      }

      // Validate the transaction hash
      const validation = this.validateTransactionResponse(transactionData, secretToken, helcimHash)

      if (!validation.isValid) {
        throw new Error('Transaction validation failed - hash mismatch')
      }

      // Log successful transaction
      await this.logTransaction('payment', transaction, 'success')

      return {
        success: true,
        transaction,
        validation
      }

    } catch (error) {
      console.error('Transaction processing error:', error)

      // Log failed transaction
      await this.logTransaction('payment', {
        checkoutToken,
        error: error.message
      }, 'error')

      throw error
    }
  }

  // ===== REFUND PROCESSING =====

  /**
   * Process refund through Helcim API
   */
  async processRefund(transactionId, refundAmount, reason = '') {
    try {
      const payload = {
        paymentType: 'refund',
        originalTransactionId: transactionId,
        amount: Math.round(refundAmount * 100) // Convert to cents
      }

      const response = await fetch(`${this.baseURL}/payment/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-token': this.apiToken
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`Refund failed: ${errorData}`)
      }

      const refundData = await response.json()

      // Log successful refund
      await this.logTransaction('refund', {
        originalTransactionId: transactionId,
        refundTransactionId: refundData.transactionId,
        amount: refundAmount,
        reason
      }, 'success')

      return {
        success: true,
        refundId: refundData.transactionId,
        amount: refundData.amount / 100, // Convert back from cents
        status: refundData.status
      }

    } catch (error) {
      console.error('Refund processing error:', error)

      // Log failed refund
      await this.logTransaction('refund', {
        originalTransactionId: transactionId,
        amount: refundAmount,
        error: error.message
      }, 'error')

      throw error
    }
  }

  // ===== WEBHOOK PROCESSING =====

  /**
   * Verify webhook signature from Helcim
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.webhookSecret) {
      console.warn('HELCIM_WEBHOOK_SECRET not configured - webhook verification disabled')
      return true // Allow webhooks to pass in development
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex')

      // Helcim sends signature as sha256=<hash>
      const providedHash = signature.replace('sha256=', '')

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(providedHash)
      )
    } catch (error) {
      console.error('Webhook signature verification error:', error)
      return false
    }
  }

  /**
   * Process webhook event from Helcim
   */
  async processWebhook(event) {
    try {
      const { eventType, data } = event

      switch (eventType) {
        case 'PAYMENT_SUCCESS':
          await this.handlePaymentSuccessWebhook(data)
          break
        case 'PAYMENT_FAILED':
          await this.handlePaymentFailedWebhook(data)
          break
        case 'REFUND_PROCESSED':
          await this.handleRefundWebhook(data)
          break
        case 'CHARGEBACK_RECEIVED':
          await this.handleChargebackWebhook(data)
          break
        default:
          console.log(`Unhandled webhook event type: ${eventType}`)
      }

      return { success: true }
    } catch (error) {
      console.error('Webhook processing error:', error)
      throw error
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Detect card type from card number
   */
  detectCardType(cardNumber) {
    if (!cardNumber) return 'unknown'

    const cleanNumber = cardNumber.replace(/\s/g, '')

    if (/^4/.test(cleanNumber)) return 'Visa'
    if (/^5[1-5]/.test(cleanNumber)) return 'Mastercard'
    if (/^3[47]/.test(cleanNumber)) return 'American Express'
    if (/^6(?:011|5)/.test(cleanNumber)) return 'Discover'

    return 'unknown'
  }

  /**
   * Log transaction for audit trail
   */
  async logTransaction(type, data, status) {
    try {
      await supabase
        .from('helcim_transaction_logs')
        .insert([{
          transaction_type: type,
          status: status,
          transaction_data: data,
          created_at: new Date()
        }])
    } catch (error) {
      console.error('Transaction logging error:', error)
      // Don't throw - logging failure shouldn't break payment flow
    }
  }

  // ===== WEBHOOK EVENT HANDLERS =====

  async handlePaymentSuccessWebhook(data) {
    console.log('Payment success webhook:', data.transactionId)

    // Update order status if needed
    if (data.orderNumber) {
      await supabase
        .from('orders')
        .update({
          payment_status: 'completed',
          updated_at: new Date()
        })
        .eq('helcim_transaction_id', data.transactionId)
    }
  }

  async handlePaymentFailedWebhook(data) {
    console.log('Payment failed webhook:', data.transactionId)

    // Update checkout session status
    if (data.checkoutToken) {
      await supabase
        .from('checkout_sessions')
        .update({
          status: 'failed',
          error_message: data.errorMessage,
          updated_at: new Date()
        })
        .eq('checkout_token', data.checkoutToken)
    }
  }

  async handleRefundWebhook(data) {
    console.log('Refund webhook:', data.refundTransactionId)

    // Update order status
    await supabase
      .from('orders')
      .update({
        status: 'refunded',
        updated_at: new Date()
      })
      .eq('helcim_transaction_id', data.originalTransactionId)
  }

  async handleChargebackWebhook(data) {
    console.log('Chargeback webhook:', data.transactionId)

    // Update order status and flag for admin attention
    await supabase
      .from('orders')
      .update({
        status: 'disputed',
        requires_manual_review: true,
        notes: `Chargeback received: ${data.reason || 'No reason provided'}`,
        updated_at: new Date()
      })
      .eq('helcim_transaction_id', data.transactionId)
  }
}

export default new HelcimService()