// backend/routes/payment.js - Enhanced payment routes with Helcim integration

import express from 'express'
import { supabase } from '../server.js'
import helcimService from '../services/helcimService.js'
import sellerPayoutService from '../services/sellerPayoutService.js'
import { authenticateUser } from '../middleware/auth.js'
import { body, validationResult } from 'express-validator'

const router = express.Router()

// ===== PAYMENT PROCESSING =====

// Create payment intent
router.post('/create-intent', authenticateUser, [
  body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount required'),
  body('currency').optional().isIn(['CAD', 'USD']).withMessage('Currency must be CAD or USD'),
  body('items').isArray({ min: 1 }).withMessage('Items required for intent creation')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() })
    }

    const { 
      amount, 
      currency = 'CAD', 
      billing_address, 
      items,
      subtotal,
      shipping_cost,
      tax_amount,
      card_number,
      card_expiry,
      card_cvv
    } = req.body

    // Generate a temporary order ID for the payment intent
    const tempOrderId = `temp_${Date.now()}_${req.user.id}`

    // Create description from items
    const itemNames = items.slice(0, 3).map(item => `Item ${item.listing_id}`)
    const description = `MTG Cards: ${itemNames.join(', ')}${items.length > 3 ? ` +${items.length - 3} more` : ''}`

    // Create payment intent with Helcim
    const paymentIntent = await helcimService.createPaymentIntent({
      ip_address: req.ip,
      amount: amount,
      currency: currency,
      orderId: tempOrderId,
      buyerId: req.user.id,
      description: description,
      billingAddress: billing_address,
      card_number: card_number,
      card_expiry: card_expiry,
      card_cvv: card_cvv
    })

    res.json({
      success: true,
      payment_intent: paymentIntent,
      summary: {
        subtotal,
        shipping_cost,
        tax_amount,
        total_amount: amount,
        currency
      }
    })
  } catch (error) {
    console.error('Payment intent creation failed:', error)
    res.status(500).json({ error: error.message })
  }
})

// Confirm payment
router.post('/confirm', [
  body('payment_intent_id').notEmpty().withMessage('Payment intent ID required'),
  body('order_id').isUUID().withMessage('Valid order ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() })
    }

    const { payment_intent_id, order_id } = req.body

    // Verify order exists and is pending
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .eq('payment_intent_id', payment_intent_id)
      .single()

    if (!order) {
      return res.status(404).json({ error: 'Order not found or payment intent mismatch' })
    }

    // Capture the payment with Helcim
    const captureResult = await helcimService.capturePayment(payment_intent_id, order.total_amount)

    if (captureResult.success) {
      // Update order status
      await supabase
        .from('orders')
        .update({
          status: 'processing',
          payment_status: 'completed',
          helcim_transaction_id: captureResult.transactionId,
          paid_at: new Date(),
          updated_at: new Date()
        })
        .eq('id', order_id)

      // Update listing quantities
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('listing_id, quantity')
        .eq('order_id', order_id)

      for (const item of orderItems) {
        await supabase.rpc('decrement_listing_quantity', {
          listing_id: item.listing_id,
          quantity_to_subtract: item.quantity
        })
      }

      res.json({
        success: true,
        transaction_id: captureResult.transactionId,
        message: 'Payment confirmed successfully'
      })
    } else {
      res.status(400).json({ error: 'Payment confirmation failed' })
    }
  } catch (error) {
    console.error('Payment confirmation failed:', error)
    res.status(500).json({ error: error.message })
  }
})

// Process refund
router.post('/refund', authenticateUser, [
  body('order_id').isUUID().withMessage('Valid order ID required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Valid refund amount required'),
  body('reason').optional().isString().withMessage('Reason must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() })
    }

    const { order_id, amount, reason = 'Customer request' } = req.body

    // Check if user is admin or the buyer
    const { data: order } = await supabase
      .from('orders')
      .select(`
        *,
        profiles!buyer_id(role)
      `)
      .eq('id', order_id)
      .single()

    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    // Verify user has permission to refund
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single()

    const canRefund = userProfile.role === 'admin' || 
                     (order.buyer_id === req.user.id && order.status === 'delivered')

    if (!canRefund) {
      return res.status(403).json({ error: 'Not authorized to process refund' })
    }

    if (!order.helcim_transaction_id) {
      return res.status(400).json({ error: 'No payment transaction found for this order' })
    }

    // Process refund with Helcim
    const refundResult = await helcimService.processRefund(
      order.helcim_transaction_id,
      amount,
      reason
    )

    if (refundResult.success) {
      // Update order with refund information
      await supabase
        .from('orders')
        .update({
          refund_status: 'processing',
          refund_amount: amount,
          refund_reason: reason,
          refund_initiated_at: new Date(),
          updated_at: new Date()
        })
        .eq('id', order_id)

      res.json({
        success: true,
        refund_id: refundResult.refundId,
        amount: refundResult.amount,
        message: 'Refund processed successfully'
      })
    } else {
      res.status(400).json({ error: 'Refund processing failed' })
    }
  } catch (error) {
    console.error('Refund processing failed:', error)
    res.status(500).json({ error: error.message })
  }
})

// ===== HELCIM WEBHOOKS =====

// Helcim webhook endpoint
router.post('/helcim-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-helcim-signature']
    const payload = req.body

    // Verify webhook signature
    if (!helcimService.verifyWebhookSignature(payload, signature)) {
      console.warn('Invalid webhook signature received')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    // Parse the event
    const event = JSON.parse(payload.toString())
    
    // Process the webhook event
    await helcimService.processWebhook(event)

    res.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

// ===== SELLER PAYOUTS =====

// Get seller earnings summary
router.get('/seller-earnings', authenticateUser, async (req, res) => {
  try {
    const { start_date, end_date } = req.query

    // Check if user is an approved seller
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, approved')
      .eq('id', req.user.id)
      .single()

    if (profile.role !== 'seller' || !profile.approved) {
      return res.status(403).json({ error: 'Seller access required' })
    }

    const earnings = await sellerPayoutService.calculateSellerEarnings(
      req.user.id,
      start_date,
      end_date
    )

    res.json(earnings)
  } catch (error) {
    console.error('Error fetching seller earnings:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get seller payout history
router.get('/seller-payouts', authenticateUser, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query

    // Check if user is an approved seller
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, approved')
      .eq('id', req.user.id)
      .single()

    if (profile.role !== 'seller' || !profile.approved) {
      return res.status(403).json({ error: 'Seller access required' })
    }

    const payouts = await sellerPayoutService.getSellerPayoutHistory(
      req.user.id,
      page,
      limit
    )

    res.json(payouts)
  } catch (error) {
    console.error('Error fetching payout history:', error)
    res.status(500).json({ error: error.message })
  }
})

// Request manual payout (for sellers who don't have auto-payout enabled)
router.post('/request-payout', authenticateUser, async (req, res) => {
  try {
    // Check if user is an approved seller
    const { data: profile } = await supabase
      .from('profiles')
      .select(`
        role, 
        approved,
        seller_settings(payout_method, payout_threshold, auto_payout)
      `)
      .eq('id', req.user.id)
      .single()

    if (profile.role !== 'seller' || !profile.approved) {
      return res.status(403).json({ error: 'Seller access required' })
    }

    if (!profile.seller_settings.payout_method) {
      return res.status(400).json({ error: 'Payout method not configured. Please update your settings.' })
    }

    if (profile.seller_settings.auto_payout) {
      return res.status(400).json({ error: 'Auto-payout is enabled. Payouts will be processed automatically.' })
    }

    // Calculate current earnings
    const earnings = await sellerPayoutService.calculateSellerEarnings(req.user.id)
    const threshold = profile.seller_settings.payout_threshold || 25.00

    if (earnings.totalEarnings < threshold) {
      return res.status(400).json({ 
        error: `Minimum payout threshold not met. Current: $${earnings.totalEarnings}, Required: $${threshold}` 
      })
    }

    // Process the payout
    const result = await sellerPayoutService.processSinglePayout(req.user.id)

    res.json({
      success: true,
      message: 'Payout request processed successfully',
      payout: result
    })
  } catch (error) {
    console.error('Error processing payout request:', error)
    res.status(500).json({ error: error.message })
  }
})

// ===== ADMIN PAYOUT MANAGEMENT =====

// Get all eligible sellers for payout (admin only)
router.get('/admin/eligible-sellers', authenticateUser, async (req, res) => {
  try {
    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single()

    if (profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const eligibleSellers = await sellerPayoutService.getEligibleSellers()
    res.json(eligibleSellers)
  } catch (error) {
    console.error('Error fetching eligible sellers:', error)
    res.status(500).json({ error: error.message })
  }
})

// Process specific seller payout (admin only)
router.post('/admin/process-payout', authenticateUser, [
  body('seller_id').isUUID().withMessage('Valid seller ID required'),
  body('amount').optional().isFloat({ min: 0.01 }).withMessage('Valid amount required')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() })
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single()

    if (profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { seller_id, amount } = req.body

    const result = await sellerPayoutService.processSinglePayout(seller_id, amount)
    res.json(result)
  } catch (error) {
    console.error('Error processing admin payout:', error)
    res.status(500).json({ error: error.message })
  }
})

// Process all automatic payouts (admin only)
router.post('/admin/process-automatic-payouts', authenticateUser, async (req, res) => {
  try {
    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single()

    if (profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const results = await sellerPayoutService.processAutomaticPayouts()
    res.json({
      success: true,
      message: 'Automatic payouts processed',
      results: results
    })
  } catch (error) {
    console.error('Error processing automatic payouts:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get payout details (admin only)
router.get('/admin/payout/:id', authenticateUser, async (req, res) => {
  try {
    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single()

    if (profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const payoutDetails = await sellerPayoutService.getPayoutDetails(req.params.id)
    res.json(payoutDetails)
  } catch (error) {
    console.error('Error fetching payout details:', error)
    res.status(500).json({ error: error.message })
  }
})

// Cancel payout (admin only)
router.post('/admin/payout/:id/cancel', authenticateUser, [
  body('reason').notEmpty().withMessage('Cancellation reason required')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() })
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single()

    if (profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { reason } = req.body
    const result = await sellerPayoutService.cancelPayout(req.params.id, reason)
    res.json(result)
  } catch (error) {
    console.error('Error cancelling payout:', error)
    res.status(500).json({ error: error.message })
  }
})

// Retry failed payout (admin only)
router.post('/admin/payout/:id/retry', authenticateUser, async (req, res) => {
  try {
    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single()

    if (profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const result = await sellerPayoutService.retryPayout(req.params.id)
    res.json(result)
  } catch (error) {
    console.error('Error retrying payout:', error)
    res.status(500).json({ error: error.message })
  }
})

// Generate payout report (admin only)
router.get('/admin/payout-report', authenticateUser, async (req, res) => {
  try {
    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single()

    if (profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { start_date, end_date } = req.query

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Start date and end date required' })
    }

    const report = await sellerPayoutService.generatePayoutReport(start_date, end_date)
    res.json(report)
  } catch (error) {
    console.error('Error generating payout report:', error)
    res.status(500).json({ error: error.message })
  }
})

// ===== PAYMENT ANALYTICS =====

// Get payment statistics (admin only)
router.get('/admin/payment-stats', authenticateUser, async (req, res) => {
  try {
    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single()

    if (profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { start_date, end_date } = req.query
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const startDate = start_date ? new Date(start_date) : thirtyDaysAgo
    const endDate = end_date ? new Date(end_date) : new Date()

    // Get payment statistics
    const [paymentsRes, refundsRes, payoutsRes] = await Promise.all([
      supabase
        .from('orders')
        .select('total_amount, payment_status, created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString()),
      supabase
        .from('orders')
        .select('refund_amount, refund_status, refunded_at')
        .not('refund_amount', 'is', null)
        .gte('refunded_at', startDate.toISOString())
        .lte('refunded_at', endDate.toISOString()),
      supabase
        .from('seller_payouts')
        .select('amount, status, created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
    ])

    const payments = paymentsRes.data || []
    const refunds = refundsRes.data || []
    const payouts = payoutsRes.data || []

    // Calculate statistics
    const totalRevenue = payments
      .filter(p => p.payment_status === 'completed')
      .reduce((sum, p) => sum + p.total_amount, 0)

    const totalRefunds = refunds
      .filter(r => r.refund_status === 'completed')
      .reduce((sum, r) => sum + r.refund_amount, 0)

    const totalPayouts = payouts
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0)

    const platformFees = totalRevenue * 0.025 // 2.5% commission

    const stats = {
      period: { start_date: startDate, end_date: endDate },
      revenue: {
        total: parseFloat(totalRevenue.toFixed(2)),
        count: payments.filter(p => p.payment_status === 'completed').length,
        average: payments.length > 0 ? parseFloat((totalRevenue / payments.length).toFixed(2)) : 0
      },
      refunds: {
        total: parseFloat(totalRefunds.toFixed(2)),
        count: refunds.filter(r => r.refund_status === 'completed').length,
        percentage: totalRevenue > 0 ? parseFloat(((totalRefunds / totalRevenue) * 100).toFixed(2)) : 0
      },
      payouts: {
        total: parseFloat(totalPayouts.toFixed(2)),
        count: payouts.filter(p => p.status === 'completed').length,
        pending: payouts.filter(p => ['pending', 'processing'].includes(p.status)).length
      },
      platform: {
        fees_earned: parseFloat(platformFees.toFixed(2)),
        net_revenue: parseFloat((totalRevenue - totalRefunds - totalPayouts).toFixed(2))
      }
    }

    res.json(stats)
  } catch (error) {
    console.error('Error fetching payment statistics:', error)
    res.status(500).json({ error: error.message })
  }
})

// ===== SELLER PAYOUT SETTINGS =====

// Update seller payout settings
router.patch('/seller-settings', authenticateUser, [
  body('payout_method').optional().isIn(['bank_transfer', 'paypal']).withMessage('Invalid payout method'),
  body('payout_threshold').optional().isFloat({ min: 25 }).withMessage('Minimum payout threshold is $25'),
  body('auto_payout').optional().isBoolean().withMessage('Auto payout must be boolean'),
  body('bank_details').optional().isObject().withMessage('Bank details must be an object'),
  body('paypal_email').optional().isEmail().withMessage('Valid PayPal email required')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() })
    }

    // Check if user is an approved seller
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, approved')
      .eq('id', req.user.id)
      .single()

    if (profile.role !== 'seller' || !profile.approved) {
      return res.status(403).json({ error: 'Seller access required' })
    }

    const {
      payout_method,
      payout_threshold,
      auto_payout,
      bank_details,
      paypal_email
    } = req.body

    const updateData = { updated_at: new Date() }

    if (payout_method !== undefined) updateData.payout_method = payout_method
    if (payout_threshold !== undefined) updateData.payout_threshold = payout_threshold
    if (auto_payout !== undefined) updateData.auto_payout = auto_payout
    if (bank_details !== undefined) updateData.bank_details = bank_details
    if (paypal_email !== undefined) updateData.paypal_email = paypal_email

    // Validate that required details are provided for the payout method
    if (payout_method === 'bank_transfer' && bank_details) {
      const required = ['accountNumber', 'routingNumber', 'bankName', 'accountHolder']
      const missing = required.filter(field => !bank_details[field])
      if (missing.length > 0) {
        return res.status(400).json({ 
          error: `Missing required bank details: ${missing.join(', ')}` 
        })
      }
    }

    if (payout_method === 'paypal' && !paypal_email) {
      return res.status(400).json({ error: 'PayPal email required for PayPal payouts' })
    }

    // Update or insert seller settings
    const { data, error } = await supabase
      .from('seller_settings')
      .upsert({
        user_id: req.user.id,
        ...updateData
      })
      .select()
      .single()

    if (error) throw error

    res.json({
      success: true,
      message: 'Payout settings updated successfully',
      settings: data
    })
  } catch (error) {
    console.error('Error updating payout settings:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get seller payout settings
router.get('/seller-settings', authenticateUser, async (req, res) => {
  try {
    // Check if user is an approved seller
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, approved')
      .eq('id', req.user.id)
      .single()

    if (profile.role !== 'seller' || !profile.approved) {
      return res.status(403).json({ error: 'Seller access required' })
    }

    const { data: settings } = await supabase
      .from('seller_settings')
      .select('*')
      .eq('user_id', req.user.id)
      .single()

    // Return settings without sensitive bank details for security
    const safeSettings = settings ? {
      ...settings,
      bank_details: settings.bank_details ? {
        bankName: settings.bank_details.bankName,
        accountHolder: settings.bank_details.accountHolder,
        accountType: settings.bank_details.accountType,
        // Mask account number
        accountNumber: settings.bank_details.accountNumber ? 
          `****${settings.bank_details.accountNumber.slice(-4)}` : null,
        // Mask routing number
        routingNumber: settings.bank_details.routingNumber ? 
          `****${settings.bank_details.routingNumber.slice(-4)}` : null
      } : null
    } : null

    res.json(safeSettings)
  } catch (error) {
    console.error('Error fetching payout settings:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router