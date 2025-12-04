// backend/services/sellerPayoutService.js - Automated seller payout system

import { supabase } from '../server.js'
import helcimService from './helcimService.js'
import { sendSellerPayoutNotification, sendAdminSystemAlert } from './emailServiceMailgun.js'
import cron from 'node-cron'

class SellerPayoutService {
  constructor() {
    // Initialize automated payout schedule
    this.initializePayoutSchedule()
  }

  // ===== PAYOUT CALCULATION =====

  /**
   * Calculate seller earnings for completed orders
   */
  async calculateSellerEarnings(sellerId, startDate = null, endDate = null) {
    try {
      let query = supabase
        .from('orders')
        .select(`
          id,
          subtotal,
          total_amount,
          shipping_cost,
          tax_amount,
          created_at,
          delivered_at,
          order_items!inner(
            listing_id,
            quantity,
            price,
            listings!inner(seller_id)
          )
        `)
        .eq('status', 'delivered')
        .eq('payout_processed', false)
        .eq('order_items.listings.seller_id', sellerId)

      if (startDate) {
        query = query.gte('delivered_at', startDate)
      }
      if (endDate) {
        query = query.lte('delivered_at', endDate)
      }

      const { data: orders, error } = await query

      if (error) throw error

      let totalEarnings = 0
      let totalOrders = 0
      let totalItems = 0
      const orderDetails = []

      // Get platform commission rate
      const { data: settings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'platform_fees')
        .single()

      const commissionRate = settings?.value?.commission_rate || 0.025

      for (const order of orders) {
        let orderSubtotal = 0
        let orderItems = 0

        for (const item of order.order_items) {
          const itemTotal = item.price * item.quantity
          orderSubtotal += itemTotal
          orderItems += item.quantity
        }

        // Calculate seller's portion (subtract platform commission)
        const platformFee = orderSubtotal * commissionRate
        const sellerEarnings = orderSubtotal - platformFee

        totalEarnings += sellerEarnings
        totalOrders += 1
        totalItems += orderItems

        orderDetails.push({
          orderId: order.id,
          orderDate: order.created_at,
          deliveredDate: order.delivered_at,
          subtotal: orderSubtotal,
          platformFee: platformFee,
          sellerEarnings: sellerEarnings,
          itemCount: orderItems
        })
      }

      return {
        sellerId,
        totalEarnings: parseFloat(totalEarnings.toFixed(2)),
        totalOrders,
        totalItems,
        platformCommission: parseFloat((totalEarnings * commissionRate / (1 - commissionRate)).toFixed(2)),
        orderDetails,
        periodStart: startDate,
        periodEnd: endDate
      }
    } catch (error) {
      console.error('Error calculating seller earnings:', error)
      throw error
    }
  }

  /**
   * Get sellers eligible for payout
   */
  async getEligibleSellers() {
    try {
      // Get minimum payout threshold
      const { data: settings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'platform_fees')
        .single()

      const minThreshold = settings?.value?.payout_threshold || 25.00

      // Find sellers with pending earnings above threshold
      const { data: sellers } = await supabase
        .from('profiles')
        .select(`
          id,
          display_name,
          email,
          seller_settings!inner(
            payout_method,
            payout_threshold,
            auto_payout,
            bank_details,
            paypal_email
          )
        `)
        .eq('role', 'seller')
        .eq('approved', true)
        .eq('suspended', false)

      const eligibleSellers = []

      for (const seller of sellers) {
        const earnings = await this.calculateSellerEarnings(seller.id)
        const threshold = seller.seller_settings.payout_threshold || minThreshold

        if (earnings.totalEarnings >= threshold) {
          eligibleSellers.push({
            ...seller,
            pendingEarnings: earnings.totalEarnings,
            orderCount: earnings.totalOrders,
            canAutoProcess: seller.seller_settings.auto_payout && 
                           seller.seller_settings.payout_method && 
                           (seller.seller_settings.bank_details || seller.seller_settings.paypal_email)
          })
        }
      }

      return eligibleSellers
    } catch (error) {
      console.error('Error getting eligible sellers:', error)
      throw error
    }
  }

  // ===== PAYOUT PROCESSING =====

  /**
   * Process individual seller payout
   */
  async processSinglePayout(sellerId, amount = null, payoutMethod = null) {
    try {
      // Get seller information and settings
      const { data: seller } = await supabase
        .from('profiles')
        .select(`
          *,
          seller_settings(*)
        `)
        .eq('id', sellerId)
        .single()

      if (!seller) {
        throw new Error('Seller not found')
      }

      // Calculate earnings if amount not specified
      let earnings
      if (!amount) {
        earnings = await this.calculateSellerEarnings(sellerId)
        amount = earnings.totalEarnings
      } else {
        earnings = await this.calculateSellerEarnings(sellerId)
      }

      // Check minimum threshold
      const { data: settings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'platform_fees')
        .single()

      const minThreshold = settings?.value?.payout_threshold || 25.00

      if (amount < minThreshold) {
        throw new Error(`Payout amount $${amount} is below minimum threshold $${minThreshold}`)
      }

      // Determine payout method
      const method = payoutMethod || seller.seller_settings.payout_method
      if (!method) {
        throw new Error('No payout method configured for seller')
      }

      // Create payout record
      const { data: payout, error: payoutError } = await supabase
        .from('seller_payouts')
        .insert({
          seller_id: sellerId,
          amount: amount,
          fee_amount: 0, // Helcim fees will be deducted by them
          net_amount: amount,
          payout_method: method,
          status: 'pending',
          order_ids: earnings.orderDetails.map(o => o.orderId),
          period_start: earnings.periodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          period_end: earnings.periodEnd || new Date(),
          initiated_at: new Date()
        })
        .select()
        .single()

      if (payoutError) throw payoutError

      // Process payout based on method
      let payoutResult
      switch (method) {
        case 'bank_transfer':
          payoutResult = await this.processBankPayout(seller, payout, amount)
          break
        case 'paypal':
          payoutResult = await this.processPayPalPayout(seller, payout, amount)
          break
        default:
          throw new Error(`Unsupported payout method: ${method}`)
      }

      // Update payout record with external reference
      await supabase
        .from('seller_payouts')
        .update({
          external_payout_id: payoutResult.payoutId,
          external_reference: payoutResult.reference,
          status: 'processing',
          updated_at: new Date()
        })
        .eq('id', payout.id)

      // Mark orders as payout processed
      await supabase
        .from('orders')
        .update({
          payout_processed: true,
          payout_id: payout.id,
          updated_at: new Date()
        })
        .in('id', earnings.orderDetails.map(o => o.orderId))

      // Send notification email
      await this.sendPayoutNotification(seller, payout, payoutResult)

      return {
        success: true,
        payoutId: payout.id,
        externalPayoutId: payoutResult.payoutId,
        amount: amount,
        method: method,
        estimatedArrival: payoutResult.processingTime
      }
    } catch (error) {
      console.error('Error processing payout:', error)
      throw error
    }
  }

  /**
   * Process bank transfer payout via Helcim
   */
  async processBankPayout(seller, payout, amount) {
    try {
      const bankDetails = seller.seller_settings.bank_details

      if (!bankDetails || !bankDetails.accountNumber || !bankDetails.routingNumber) {
        throw new Error('Bank details not configured')
      }

      const payoutData = {
        sellerId: seller.id,
        amount: amount,
        bankDetails: {
          accountNumber: bankDetails.accountNumber,
          routingNumber: bankDetails.routingNumber,
          bankName: bankDetails.bankName,
          accountHolder: bankDetails.accountHolder || seller.display_name,
          accountType: bankDetails.accountType || 'checking',
          email: seller.email,
          phone: bankDetails.phone
        },
        reference: `PAYOUT-${payout.id}`,
        description: `MTG Marketplace seller payout for ${seller.display_name}`
      }

      const result = await helcimService.processPayout(payoutData)
      
      return {
        payoutId: result.payoutId,
        reference: `PAYOUT-${payout.id}`,
        processingTime: result.processingTime
      }
    } catch (error) {
      console.error('Bank payout failed:', error)
      throw error
    }
  }

  /**
   * Process PayPal payout (placeholder for future implementation)
   */
  async processPayPalPayout(seller, payout, amount) {
    try {
      // This would integrate with PayPal's Payouts API
      // For now, we'll create a manual payout record
      
      const payoutId = `PP-${Date.now()}-${seller.id.substring(0, 8)}`
      
      // In a real implementation, you would:
      // 1. Use PayPal's Payouts API
      // 2. Handle PayPal's webhook notifications
      // 3. Update payout status based on PayPal responses
      
      return {
        payoutId: payoutId,
        reference: `PAYPAL-${payout.id}`,
        processingTime: '1-2 business days'
      }
    } catch (error) {
      console.error('PayPal payout failed:', error)
      throw error
    }
  }

  // ===== AUTOMATED PROCESSING =====

  /**
   * Process all eligible automatic payouts
   */
  async processAutomaticPayouts() {
    try {
      console.log('Starting automatic payout processing...')
      
      const eligibleSellers = await this.getEligibleSellers()
      const autoPayoutSellers = eligibleSellers.filter(s => s.canAutoProcess)
      
      console.log(`Found ${autoPayoutSellers.length} sellers eligible for automatic payout`)
      
      const results = []
      
      for (const seller of autoPayoutSellers) {
        try {
          const result = await this.processSinglePayout(seller.id)
          results.push({
            sellerId: seller.id,
            sellerName: seller.display_name,
            success: true,
            amount: result.amount,
            payoutId: result.payoutId
          })
          
          console.log(`✅ Processed payout for ${seller.display_name}: ${result.amount}`)
        } catch (error) {
          results.push({
            sellerId: seller.id,
            sellerName: seller.display_name,
            success: false,
            error: error.message
          })
          
          console.error(`❌ Failed payout for ${seller.display_name}:`, error.message)
        }
      }
      
      // Send admin summary
      if (results.length > 0) {
        await this.sendAdminPayoutSummary(results)
      }
      
      return results
    } catch (error) {
      console.error('Error in automatic payout processing:', error)
      throw error
    }
  }

  /**
   * Initialize automated payout schedule
   */
  initializePayoutSchedule() {
    // Run automatic payouts every Monday at 9 AM
    cron.schedule('0 9 * * 1', async () => {
      try {
        console.log('🔄 Running scheduled automatic payouts...')
        await this.processAutomaticPayouts()
      } catch (error) {
        console.error('Scheduled payout processing failed:', error)
      }
    }, {
      timezone: "America/Toronto" // Adjust timezone as needed
    })

    // Check for failed payouts daily at 10 AM
    cron.schedule('0 10 * * *', async () => {
      try {
        await this.checkFailedPayouts()
      } catch (error) {
        console.error('Failed payout check failed:', error)
      }
    }, {
      timezone: "America/Toronto"
    })

    console.log('📅 Automated payout schedule initialized')
  }

  // ===== PAYOUT MANAGEMENT =====

  /**
   * Get payout history for seller
   */
  async getSellerPayoutHistory(sellerId, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit

      const { data: payouts, count, error } = await supabase
        .from('seller_payouts')
        .select('*', { count: 'exact' })
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error

      return {
        payouts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      }
    } catch (error) {
      console.error('Error getting payout history:', error)
      throw error
    }
  }

  /**
   * Get detailed payout information
   */
  async getPayoutDetails(payoutId) {
    try {
      const { data: payout, error } = await supabase
        .from('seller_payouts')
        .select(`
          *,
          profiles(display_name, email),
          orders(id, created_at, subtotal, order_items(quantity, price, listings(cards(name))))
        `)
        .eq('id', payoutId)
        .single()

      if (error) throw error

      // If external payout ID exists, get status from Helcim
      let externalStatus = null
      if (payout.external_payout_id) {
        try {
          externalStatus = await helcimService.getPayoutStatus(payout.external_payout_id)
        } catch (error) {
          console.warn('Could not fetch external payout status:', error.message)
        }
      }

      return {
        ...payout,
        externalStatus
      }
    } catch (error) {
      console.error('Error getting payout details:', error)
      throw error
    }
  }

  /**
   * Cancel pending payout
   */
  async cancelPayout(payoutId, reason = '') {
    try {
      const { data: payout } = await supabase
        .from('seller_payouts')
        .select('*')
        .eq('id', payoutId)
        .single()

      if (!payout) {
        throw new Error('Payout not found')
      }

      if (payout.status !== 'pending') {
        throw new Error('Can only cancel pending payouts')
      }

      // Update payout status
      await supabase
        .from('seller_payouts')
        .update({
          status: 'cancelled',
          failure_reason: reason,
          updated_at: new Date()
        })
        .eq('id', payoutId)

      // Unmark orders as processed
      if (payout.order_ids && payout.order_ids.length > 0) {
        await supabase
          .from('orders')
          .update({
            payout_processed: false,
            payout_id: null,
            updated_at: new Date()
          })
          .in('id', payout.order_ids)
      }

      return { success: true, message: 'Payout cancelled successfully' }
    } catch (error) {
      console.error('Error cancelling payout:', error)
      throw error
    }
  }

  /**
   * Retry failed payout
   */
  async retryPayout(payoutId) {
    try {
      const { data: payout } = await supabase
        .from('seller_payouts')
        .select(`
          *,
          profiles(*)
        `)
        .eq('id', payoutId)
        .single()

      if (!payout) {
        throw new Error('Payout not found')
      }

      if (payout.status !== 'failed') {
        throw new Error('Can only retry failed payouts')
      }

      // Reset payout status
      await supabase
        .from('seller_payouts')
        .update({
          status: 'pending',
          failed_at: null,
          failure_reason: null,
          retry_count: (payout.retry_count || 0) + 1,
          updated_at: new Date()
        })
        .eq('id', payoutId)

      // Attempt to process again
      const result = await this.processSinglePayout(payout.seller_id, payout.amount)

      return result
    } catch (error) {
      console.error('Error retrying payout:', error)
      throw error
    }
  }

  /**
   * Check for failed payouts and alert admins
   */
  async checkFailedPayouts() {
    try {
      const { data: failedPayouts } = await supabase
        .from('seller_payouts')
        .select(`
          *,
          profiles(display_name, email)
        `)
        .eq('status', 'failed')
        .gte('failed_at', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours

      if (failedPayouts && failedPayouts.length > 0) {
        await this.sendFailedPayoutAlert(failedPayouts)
      }

      return failedPayouts
    } catch (error) {
      console.error('Error checking failed payouts:', error)
      throw error
    }
  }

  // ===== NOTIFICATIONS =====

  /**
   * Send payout notification to seller
   */
  async sendPayoutNotification(seller, payout, payoutResult) {
    try {
      const earnings = await this.calculateSellerEarnings(seller.id, payout.period_start, payout.period_end)

      await sendSellerPayoutNotification(
        seller.email,
        {
          amount: payout.amount,
          date: payout.processed_at || new Date(),
          method: payout.payout_method || 'Bank Transfer',
          periodStart: payout.period_start,
          periodEnd: payout.period_end,
          orderCount: earnings.totalOrders,
          platformFees: earnings.platformCommission
        },
        seller.display_name
      )
    } catch (error) {
      console.error('Error sending payout notification:', error)
    }
  }

  /**
   * Send admin summary of automatic payouts
   */
  async sendAdminPayoutSummary(results) {
    try {
      const successful = results.filter(r => r.success)
      const failed = results.filter(r => !r.success)
      const totalAmount = successful.reduce((sum, r) => sum + r.amount, 0)

      const emailHtml = `
        <h2>Automatic Payout Summary</h2>
        <p>Automated payout processing completed.</p>
        
        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>Summary</h3>
          <p><strong>Successful Payouts:</strong> ${successful.length}</p>
          <p><strong>Failed Payouts:</strong> ${failed.length}</p>
          <p><strong>Total Amount Processed:</strong> ${totalAmount.toFixed(2)} CAD</p>
        </div>
        
        ${successful.length > 0 ? `
          <h3>Successful Payouts</h3>
          <ul>
            ${successful.map(r => `
              <li>${r.sellerName}: ${r.amount} (${r.payoutId})</li>
            `).join('')}
          </ul>
        ` : ''}
        
        ${failed.length > 0 ? `
          <h3>Failed Payouts</h3>
          <ul>
            ${failed.map(r => `
              <li>${r.sellerName}: ${r.error}</li>
            `).join('')}
          </ul>
        ` : ''}
      `

      // Get admin emails
      const { data: admins } = await supabase
        .from('profiles')
        .select('email')
        .eq('role', 'admin')

      const adminEmails = admins.map(a => a.email)

      await sendAdminSystemAlert(
        adminEmails,
        {
          type: 'Automatic Payout Summary',
          message: `Automated payout processing completed. Successful: ${successful.length}, Failed: ${failed.length}, Total: $${totalAmount.toFixed(2)} CAD`,
          severity: failed.length > 0 ? 'medium' : 'low',
          actionRequired: failed.length > 0 ? 'Review failed payouts in admin panel' : 'No action required'
        }
      )
    } catch (error) {
      console.error('Error sending admin payout summary:', error)
    }
  }

  /**
   * Send failed payout alert to admins
   */
  async sendFailedPayoutAlert(failedPayouts) {
    try {
      if (!failedPayouts || failedPayouts.length === 0) return

      // Get admin emails
      const { data: admins } = await supabase
        .from('profiles')
        .select('email')
        .eq('role', 'admin')

      if (!admins || admins.length === 0) return

      const adminEmails = admins.map(a => a.email)
      const totalFailed = failedPayouts.length
      const totalAmount = failedPayouts.reduce((sum, p) => sum + parseFloat(p.amount), 0)

      await sendAdminSystemAlert(
        adminEmails,
        {
          type: 'Failed Payout Alert',
          message: `${totalFailed} payout(s) failed in the last 24 hours totaling $${totalAmount.toFixed(2)} CAD. Immediate attention required.`,
          severity: 'high',
          actionRequired: 'Review failed payouts in admin panel and contact affected sellers'
        }
      )
    } catch (error) {
      console.error('Error sending failed payout alert:', error)
    }
  }

  // ===== REPORTING =====

  /**
   * Generate payout report for date range
   */
  async generatePayoutReport(startDate, endDate) {
    try {
      const { data: payouts, error } = await supabase
        .from('seller_payouts')
        .select(`
          *,
          profiles(display_name, email)
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false })

      if (error) throw error

      const summary = {
        totalPayouts: payouts.length,
        totalAmount: payouts.reduce((sum, p) => sum + p.amount, 0),
        successfulPayouts: payouts.filter(p => p.status === 'completed').length,
        pendingPayouts: payouts.filter(p => p.status === 'pending' || p.status === 'processing').length,
        failedPayouts: payouts.filter(p => p.status === 'failed').length,
        byMethod: {}
      }

      // Group by payout method
      payouts.forEach(payout => {
        if (!summary.byMethod[payout.payout_method]) {
          summary.byMethod[payout.payout_method] = {
            count: 0,
            amount: 0
          }
        }
        summary.byMethod[payout.payout_method].count += 1
        summary.byMethod[payout.payout_method].amount += payout.amount
      })

      return {
        summary,
        payouts,
        dateRange: { startDate, endDate }
      }
    } catch (error) {
      console.error('Error generating payout report:', error)
      throw error
    }
  }
}

export default new SellerPayoutService()