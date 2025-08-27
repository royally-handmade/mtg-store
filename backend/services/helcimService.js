// backend/services/helcimService.js - Helcim payment integration

import axios from 'axios'
import crypto from 'crypto'
import { supabase } from '../server.js'

class HelcimService {
  constructor() {
    this.apiKey = 'aDSfgo7mhVp41HFgN69YS4mvpsR@!7Gonxl1ehQ0jGMxZKlyC9DmUjn8cXQDejZ%'//process.env.HELCIM_API_KEY
    this.merchantId = process.env.HELCIM_MERCHANT_ID
    this.baseURL = process.env.HELCIM_ENVIRONMENT === 'production'
      ? 'https://api.helcim.com/v2'
      : 'https://api.helcim.com/v2/test'
    this.webhookSecret = process.env.HELCIM_WEBHOOK_SECRET

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'API-TOKEN': `${this.apiKey}`,
        'Content-Type': 'application/json',
        'idempotency-key': crypto.randomUUID()
      }
    })
  }

  // ===== PAYMENT PROCESSING =====

  /**
   * Create a payment intent for checkout
   */
  async createPaymentIntent(orderData) {
    try {
      const {
        ip_address,
        amount,
        currency = 'CAD',
        orderId,
        buyerId,
        description,
        billingAddress,
        card_number,
        card_expiry,
        card_cvv
      } = orderData

      const payload = {
        ipAddress: ip_address,
        type: 'purchase',
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toUpperCase(),
        description: description || `MTG Marketplace Order #${orderId}`,

        //cardData
        cardData: {
          cardNumber: card_number,
          cardExpiry: card_expiry,
          cardCVV: card_cvv
        },

        // Customer information
        //TODO: send customer id if we have it. save customer id upon successful payment
        customer: {
          contactName: billingAddress?.name,
          businessName: billingAddress?.company,
          email: billingAddress?.email,
          phone: billingAddress?.phone
        },

        // Billing address
        billingAddress: {
          name: billingAddress?.name,
          street1: billingAddress?.street1,
          street2: billingAddress?.street2,
          city: billingAddress?.city,
          province: billingAddress?.province,
          country: billingAddress?.country,
          postalCode: billingAddress?.postalCode,
          phone: billingAddress?.phone,
          email: billingAddress?.email
        },

        // Security and processing options
        test: process.env.HELCIM_ENVIRONMENT !== 'production',

        // Webhook and redirect URLs
        webhook: {
          url: `${process.env.API_BASE_URL}/api/payment/helcim-webhook`
        }
      }

      console.log(payload)
      const response = await this.client.post('/payment/preauth', payload)

      // Store payment intent in database
      await this.storePaymentIntent(response.data, orderId)

      return {
        success: true,
        paymentIntentId: response.data.transactionId,
        clientSecret: response.data.checkoutToken,
        checkoutUrl: response.data.checkoutUrl,
        amount: amount,
        currency: currency
      }
    } catch (error) {
      console.error('Helcim payment intent creation failed:', error.response?.data || error.message)
      throw new Error(`Payment processing failed: ${error.response?.data?.message || error.message}`)
    }
  }

  /**
   * Capture a pre-authorized payment
   */
  async capturePayment(transactionId, amount = null) {
    try {
      const payload = {
        transactionId: transactionId
      }

      if (amount) {
        payload.amount = Math.round(amount * 100) // Convert to cents
      }

      const response = await this.client.post('/payment/capture', payload)

      return {
        success: true,
        transactionId: response.data.transactionId,
        amount: response.data.amount / 100, // Convert back to dollars
        status: response.data.status
      }
    } catch (error) {
      console.error('Helcim payment capture failed:', error.response?.data || error.message)
      throw new Error(`Payment capture failed: ${error.response?.data?.message || error.message}`)
    }
  }

  /**
   * Process a refund
   */
  async processRefund(transactionId, amount, reason = '') {
    try {
      const payload = {
        transactionId: transactionId,
        amount: Math.round(amount * 100), // Convert to cents
        ipAddress: '127.0.0.1' // Required by Helcim
      }

      const response = await this.client.post('/payment/refund', payload)

      // Log the refund
      await this.logTransaction('refund', response.data, { reason })

      return {
        success: true,
        refundId: response.data.transactionId,
        amount: response.data.amount / 100,
        status: response.data.status
      }
    } catch (error) {
      console.error('Helcim refund failed:', error.response?.data || error.message)
      throw new Error(`Refund failed: ${error.response?.data?.message || error.message}`)
    }
  }

  // ===== SELLER PAYOUTS =====

  /**
   * Process payout to seller's bank account
   */
  async processPayout(payoutData) {
    try {
      const {
        sellerId,
        amount,
        bankDetails,
        reference,
        description
      } = payoutData

      // Helcim uses ACH for payouts in North America
      const payload = {
        type: 'ach-debit', // or 'ach-credit' depending on your setup
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'CAD',
        description: description || `Seller payout - ${reference}`,

        // Bank account details
        achDetails: {
          accountType: bankDetails.accountType || 'checking', // 'checking' or 'savings'
          accountNumber: bankDetails.accountNumber,
          routingNumber: bankDetails.routingNumber,
          bankName: bankDetails.bankName
        },

        // Account holder details
        customer: {
          customerCode: sellerId,
          contactName: bankDetails.accountHolder,
          email: bankDetails.email,
          phone: bankDetails.phone
        },

        // Additional metadata
        invoice: reference,
        test: process.env.HELCIM_ENVIRONMENT !== 'production'
      }

      const response = await this.client.post('/payment/ach', payload)

      return {
        success: true,
        payoutId: response.data.transactionId,
        amount: response.data.amount / 100,
        status: response.data.status,
        processingTime: response.data.processingTime || '1-3 business days'
      }
    } catch (error) {
      console.error('Helcim payout failed:', error.response?.data || error.message)
      throw new Error(`Payout failed: ${error.response?.data?.message || error.message}`)
    }
  }

  /**
   * Check payout status
   */
  async getPayoutStatus(transactionId) {
    try {
      const response = await this.client.get(`/payment/${transactionId}`)

      return {
        success: true,
        status: response.data.status,
        amount: response.data.amount / 100,
        processingDate: response.data.processingDate,
        settledDate: response.data.settledDate
      }
    } catch (error) {
      console.error('Helcim status check failed:', error.response?.data || error.message)
      throw new Error(`Status check failed: ${error.response?.data?.message || error.message}`)
    }
  }

  // ===== WEBHOOK PROCESSING =====

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.webhookSecret) {
      console.warn('Helcim webhook secret not configured')
      return false
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex')

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  }

  /**
   * Process webhook events
   */
  async processWebhook(event) {
    try {
      const { type, data } = event

      switch (type) {
        case 'payment.success':
          await this.handlePaymentSuccess(data)
          break
        case 'payment.failed':
          await this.handlePaymentFailed(data)
          break
        case 'payout.completed':
          await this.handlePayoutCompleted(data)
          break
        case 'payout.failed':
          await this.handlePayoutFailed(data)
          break
        case 'refund.completed':
          await this.handleRefundCompleted(data)
          break
        default:
          console.log(`Unhandled webhook event type: ${type}`)
      }

      return { success: true }
    } catch (error) {
      console.error('Webhook processing failed:', error)
      throw error
    }
  }

  // ===== WEBHOOK HANDLERS =====

  async handlePaymentSuccess(data) {
    const { transactionId, amount, invoice: orderId } = data

    try {
      // Update order status
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'processing',
          payment_status: 'completed',
          helcim_transaction_id: transactionId,
          paid_at: new Date(),
          updated_at: new Date()
        })
        .eq('id', orderId)

      if (orderError) throw orderError

      // Update listing quantities
      await this.updateListingQuantities(orderId)

      // Log successful payment
      await this.logTransaction('payment', data)

      console.log(`Payment successful for order ${orderId}: ${amount / 100}`)
    } catch (error) {
      console.error('Error handling payment success:', error)
      throw error
    }
  }

  async handlePaymentFailed(data) {
    const { transactionId, invoice: orderId, failureReason } = data

    try {
      // Update order status
      await supabase
        .from('orders')
        .update({
          status: 'payment_failed',
          payment_status: 'failed',
          helcim_transaction_id: transactionId,
          payment_failure_reason: failureReason,
          updated_at: new Date()
        })
        .eq('id', orderId)

      // Log failed payment
      await this.logTransaction('payment_failed', data)

      console.log(`Payment failed for order ${orderId}: ${failureReason}`)
    } catch (error) {
      console.error('Error handling payment failure:', error)
      throw error
    }
  }

  async handlePayoutCompleted(data) {
    const { transactionId, amount } = data

    try {
      // Update payout status
      await supabase
        .from('seller_payouts')
        .update({
          status: 'completed',
          completed_at: new Date(),
          external_reference: transactionId,
          updated_at: new Date()
        })
        .eq('external_payout_id', transactionId)

      // Log successful payout
      await this.logTransaction('payout_completed', data)

      console.log(`Payout completed: ${transactionId} - ${amount / 100}`)
    } catch (error) {
      console.error('Error handling payout completion:', error)
      throw error
    }
  }

  async handlePayoutFailed(data) {
    const { transactionId, failureReason } = data

    try {
      // Update payout status
      await supabase
        .from('seller_payouts')
        .update({
          status: 'failed',
          failed_at: new Date(),
          failure_reason: failureReason,
          updated_at: new Date()
        })
        .eq('external_payout_id', transactionId)

      // Log failed payout
      await this.logTransaction('payout_failed', data)

      console.log(`Payout failed: ${transactionId} - ${failureReason}`)
    } catch (error) {
      console.error('Error handling payout failure:', error)
      throw error
    }
  }

  async handleRefundCompleted(data) {
    const { transactionId, amount, originalTransactionId } = data

    try {
      // Find and update the related order
      const { data: order } = await supabase
        .from('orders')
        .select('id')
        .eq('helcim_transaction_id', originalTransactionId)
        .single()

      if (order) {
        await supabase
          .from('orders')
          .update({
            refund_status: 'completed',
            refund_amount: amount / 100,
            refunded_at: new Date(),
            updated_at: new Date()
          })
          .eq('id', order.id)
      }

      // Log refund
      await this.logTransaction('refund_completed', data)

      console.log(`Refund completed: ${transactionId} - ${amount / 100}`)
    } catch (error) {
      console.error('Error handling refund completion:', error)
      throw error
    }
  }

  // ===== UTILITY METHODS =====

  async storePaymentIntent(paymentData, orderId) {
    try {
      await supabase
        .from('payment_intents')
        .insert({
          order_id: orderId,
          helcim_transaction_id: paymentData.transactionId,
          checkout_token: paymentData.checkoutToken,
          amount: paymentData.amount / 100,
          currency: paymentData.currency,
          status: 'pending',
          created_at: new Date()
        })
    } catch (error) {
      console.error('Error storing payment intent:', error)
      throw error
    }
  }

  async updateListingQuantities(orderId) {
    try {
      // Get order items
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('listing_id, quantity')
        .eq('order_id', orderId)

      // Update each listing quantity
      for (const item of orderItems) {
        await supabase
          .from('listings')
          .update({
            quantity: supabase.rpc('decrement_quantity', {
              current_quantity: 'quantity',
              decrement_by: item.quantity
            }),
            updated_at: new Date()
          })
          .eq('id', item.listing_id)
      }
    } catch (error) {
      console.error('Error updating listing quantities:', error)
      throw error
    }
  }

  async logTransaction(type, data, metadata = {}) {
    try {
      await supabase
        .from('payment_logs')
        .insert({
          transaction_type: type,
          helcim_transaction_id: data.transactionId,
          amount: data.amount ? data.amount / 100 : null,
          status: data.status,
          raw_data: data,
          metadata: metadata,
          created_at: new Date()
        })
    } catch (error) {
      console.error('Error logging transaction:', error)
    }
  }

  // ===== CARD TOKENIZATION =====

  /**
   * Create a customer token for recurring payments
   */
  async createCustomerToken(customerData) {
    try {
      const payload = {
        customerCode: customerData.customerId,
        contactName: customerData.name,
        businessName: customerData.businessName,
        email: customerData.email,
        phone: customerData.phone,

        // Billing address
        billingAddress: {
          street1: customerData.billingAddress.street1,
          street2: customerData.billingAddress.street2,
          city: customerData.billingAddress.city,
          province: customerData.billingAddress.province,
          country: customerData.billingAddress.country,
          postalCode: customerData.billingAddress.postalCode
        }
      }

      const response = await this.client.post('/customer-vault', payload)

      return {
        success: true,
        customerId: response.data.customerId,
        customerCode: response.data.customerCode
      }
    } catch (error) {
      console.error('Helcim customer token creation failed:', error.response?.data || error.message)
      throw new Error(`Customer token creation failed: ${error.response?.data?.message || error.message}`)
    }
  }

  /**
   * Process payment with card details
   */
  async processPayment(paymentData) {
    try {
      const {
        paymentIntentId,
        cardNumber,
        expiryMonth,
        expiryYear,
        cvc,
        cardholderName,
        amount
      } = paymentData

      const payload = {
        paymentIntentId: paymentIntentId,
        cardData: {
          cardNumber: cardNumber,
          cardExpiry: `${expiryMonth.toString().padStart(2, '0')}${expiryYear.toString().slice(-2)}`,
          cardCVV: cvc,
          cardHolderName: cardholderName
        },
        amount: Math.round(amount * 100), // Convert to cents
        confirmPayment: true
      }

      const response = await this.client.post('/payment/process', payload)

      if (response.data.status === 'APPROVED') {
        // Log successful transaction
        await this.logTransaction('payment', response.data, 'success')

        return {
          success: true,
          transactionId: response.data.transactionId,
          amount: response.data.amount / 100,
          status: response.data.status,
          message: response.data.message
        }
      } else {
        // Log failed transaction
        await this.logTransaction('payment', response.data, 'failed')

        return {
          success: false,
          error: response.data.message || 'Payment declined',
          status: response.data.status
        }
      }
    } catch (error) {
      console.error('Helcim payment processing failed:', error.response?.data || error.message)

      // Log error
      await this.logTransaction('payment', error.response?.data || { error: error.message }, 'error')

      throw new Error(`Payment processing failed: ${error.response?.data?.message || error.message}`)
    }
  }

  /**
   * Process payment with stored customer token
   */
  async processTokenPayment(tokenData) {
    try {
      const {
        customerId,
        amount,
        currency = 'CAD',
        orderId,
        description
      } = tokenData

      const payload = {
        type: 'purchase',
        amount: Math.round(amount * 100),
        currency: currency.toUpperCase(),
        customerId: customerId,
        description: description || `Order #${orderId}`,
        invoice: orderId.toString(),
        test: process.env.HELCIM_ENVIRONMENT !== 'production'
      }

      const response = await this.client.post('/payment/process', payload)

      return {
        success: true,
        transactionId: response.data.transactionId,
        amount: response.data.amount / 100,
        status: response.data.status
      }
    } catch (error) {
      console.error('Helcim token payment failed:', error.response?.data || error.message)
      throw new Error(`Token payment failed: ${error.response?.data?.message || error.message}`)
    }
  }
}

export default new HelcimService()