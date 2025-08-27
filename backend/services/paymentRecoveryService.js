// backend/services/paymentRecoveryService.js
// Service to handle payment failures and recovery scenarios

import { supabase } from '../server.js'
import helcimService from './helcimService.js'
import emailService from './emailService.js'

class PaymentRecoveryService {
  
  /**
   * Handle the critical scenario where payment succeeded but order creation failed
   */
  async handlePaymentSuccessOrderFailure(transactionData) {
    const {
      transactionId,
      userId,
      amount,
      currency = 'CAD',
      paymentIntentId,
      error
    } = transactionData

    try {
      // Log the critical error for manual review
      await this.logCriticalError({
        type: 'payment_success_order_failure',
        transaction_id: transactionId,
        user_id: userId,
        amount: amount,
        currency: currency,
        payment_intent_id: paymentIntentId,
        error_details: error,
        status: 'needs_manual_review',
        created_at: new Date()
      })

      // Attempt automatic refund if configured
      if (process.env.AUTO_REFUND_ON_ORDER_FAILURE === 'true') {
        const refundResult = await this.attemptAutomaticRefund(transactionId, amount)
        
        if (refundResult.success) {
          // Update critical error log
          await this.updateCriticalError(transactionId, {
            status: 'auto_refunded',
            refund_id: refundResult.refundId,
            resolved_at: new Date()
          })

          // Notify user of automatic refund
          await this.notifyUserOfRefund(userId, {
            transactionId,
            amount,
            currency,
            refundId: refundResult.refundId
          })
        }
      }

      // Notify admin team immediately
      await this.notifyAdminOfCriticalError({
        transactionId,
        userId,
        amount,
        error
      })

      return {
        logged: true,
        refunded: process.env.AUTO_REFUND_ON_ORDER_FAILURE === 'true',
        adminNotified: true
      }

    } catch (recoveryError) {
      console.error('Failed to handle payment success order failure:', recoveryError)
      
      // This is extremely critical - both payment succeeded and recovery failed
      await this.escalateCriticalFailure({
        originalError: error,
        recoveryError: recoveryError,
        transactionId,
        userId,
        amount
      })

      throw recoveryError
    }
  }

  /**
   * Attempt automatic refund for failed order creation
   */
  async attemptAutomaticRefund(transactionId, amount) {
    try {
      const refundResult = await helcimService.refundPayment(transactionId, amount)
      
      if (refundResult.success) {
        console.log(`Automatic refund successful for transaction ${transactionId}`)
        return {
          success: true,
          refundId: refundResult.refundId
        }
      } else {
        console.error(`Automatic refund failed for transaction ${transactionId}:`, refundResult.error)
        return {
          success: false,
          error: refundResult.error
        }
      }
    } catch (error) {
      console.error(`Automatic refund error for transaction ${transactionId}:`, error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Log critical errors that need manual intervention
   */
  async logCriticalError(errorData) {
    try {
      const { error } = await supabase
        .from('critical_payment_errors')
        .insert([errorData])

      if (error) {
        console.error('Failed to log critical error to database:', error)
        // Fallback to file logging or external service
        await this.logToFallbackSystem(errorData)
      }
    } catch (error) {
      console.error('Critical error logging failed:', error)
      await this.logToFallbackSystem(errorData)
    }
  }

  /**
   * Update critical error status
   */
  async updateCriticalError(transactionId, updateData) {
    try {
      await supabase
        .from('critical_payment_errors')
        .update(updateData)
        .eq('transaction_id', transactionId)
    } catch (error) {
      console.error('Failed to update critical error:', error)
    }
  }

  /**
   * Fallback logging system for when database is unavailable
   */
  async logToFallbackSystem(errorData) {
    // Log to file system, external logging service, or email admin directly
    console.error('CRITICAL PAYMENT ERROR - MANUAL INTERVENTION REQUIRED:', JSON.stringify(errorData, null, 2))
    
    // Could also write to a file or send to external monitoring service
    // fs.appendFileSync('critical-errors.log', JSON.stringify(errorData) + '\n')
  }

  /**
   * Notify admin team of critical payment errors
   */
  async notifyAdminOfCriticalError({ transactionId, userId, amount, error }) {
    try {
      const adminEmails = process.env.ADMIN_EMAILS?.split(',') || []
      
      if (adminEmails.length === 0) {
        console.warn('No admin emails configured for critical error notifications')
        return
      }

      const emailContent = `
        CRITICAL PAYMENT ERROR - IMMEDIATE ATTENTION REQUIRED
        
        Transaction ID: ${transactionId}
        User ID: ${userId}
        Amount: ${amount} CAD
        Timestamp: ${new Date().toISOString()}
        
        Error Details:
        ${JSON.stringify(error, null, 2)}
        
        ACTION REQUIRED:
        1. Verify payment was processed successfully in Helcim dashboard
        2. Manually create order in admin panel OR process refund
        3. Contact customer to explain situation and next steps
        4. Update critical error status in database
        
        Admin Panel: ${process.env.ADMIN_PANEL_URL}/critical-errors
      `

      for (const email of adminEmails) {
        await emailService.sendCriticalAlert(email.trim(), {
          subject: `CRITICAL: Payment Success / Order Failure - ${transactionId}`,
          content: emailContent
        })
      }
    } catch (error) {
      console.error('Failed to notify admin of critical error:', error)
    }
  }

  /**
   * Notify user of automatic refund
   */
  async notifyUserOfRefund(userId, refundData) {
    try {
      // Get user email
      const { data: user } = await supabase
        .from('profiles')
        .select('email, display_name')
        .eq('id', userId)
        .single()

      if (!user?.email) return

      const emailContent = `
        Dear ${user.display_name || 'Customer'},
        
        We encountered a technical issue while processing your order, but your payment was successfully charged.
        
        To resolve this, we have automatically processed a full refund to your payment method.
        
        Transaction Details:
        - Original Transaction: ${refundData.transactionId}
        - Refund ID: ${refundData.refundId}
        - Amount Refunded: ${refundData.amount} ${refundData.currency}
        
        The refund should appear in your account within 3-5 business days.
        
        We apologize for any inconvenience. If you still wish to make this purchase, 
        please try placing your order again or contact our support team.
        
        Best regards,
        MTG Marketplace Team
      `

      await emailService.sendTransactionalEmail(user.email, {
        subject: 'Automatic Refund Processed - Order Issue',
        content: emailContent
      })
    } catch (error) {
      console.error('Failed to notify user of refund:', error)
    }
  }

  /**
   * Escalate when both payment processing and recovery fail
   */
  async escalateCriticalFailure({ originalError, recoveryError, transactionId, userId, amount }) {
    console.error('MAXIMUM ESCALATION - PAYMENT AND RECOVERY BOTH FAILED:', {
      originalError,
      recoveryError,
      transactionId,
      userId,
      amount,
      timestamp: new Date().toISOString()
    })

    // Send immediate alerts through multiple channels
    try {
      // Email all admins
      const adminEmails = process.env.ADMIN_EMAILS?.split(',') || []
      const escalationMessage = `
        MAXIMUM ESCALATION - IMMEDIATE ACTION REQUIRED
        
        BOTH PAYMENT PROCESSING AND RECOVERY HAVE FAILED
        
        Transaction: ${transactionId}
        User: ${userId}
        Amount: ${amount}
        
        Original Error: ${JSON.stringify(originalError)}
        Recovery Error: ${JSON.stringify(recoveryError)}
        
        MANUAL INTERVENTION REQUIRED IMMEDIATELY
      `

      for (const email of adminEmails) {
        await emailService.sendUrgentAlert(email.trim(), {
          subject: 'MAX ESCALATION: Payment System Failure',
          content: escalationMessage
        })
      }

      // Could also integrate with PagerDuty, Slack, SMS, etc.
      // await pagerDutyService.triggerIncident(...)
      // await slackService.sendUrgentMessage(...)

    } catch (escalationError) {
      console.error('Even escalation failed:', escalationError)
    }
  }

  /**
   * Validate payment and order consistency 
   */
  async validatePaymentOrderConsistency(transactionId) {
    try {
      // Check if transaction exists in our records
      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('helcim_transaction_id', transactionId)
        .single()

      // Check payment status with Helcim
      const paymentStatus = await helcimService.getTransactionStatus(transactionId)

      return {
        hasOrder: !!order,
        orderStatus: order?.status,
        paymentStatus: paymentStatus.status,
        consistent: !!(order && paymentStatus.status === 'completed')
      }
    } catch (error) {
      console.error('Error validating payment/order consistency:', error)
      return {
        hasOrder: false,
        orderStatus: null,
        paymentStatus: 'unknown',
        consistent: false,
        error: error.message
      }
    }
  }

  /**
   * Retry failed order creation with exponential backoff
   */
  async retryOrderCreation(orderData, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { data: order, error } = await supabase
          .from('orders')
          .insert([orderData])
          .select()
          .single()

        if (!error && order) {
          return { success: true, order }
        }

        if (attempt === maxRetries) {
          throw new Error(`Order creation failed after ${maxRetries} attempts: ${error?.message}`)
        }

        // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000))

      } catch (error) {
        if (attempt === maxRetries) {
          throw error
        }
        console.warn(`Order creation attempt ${attempt} failed:`, error.message)
      }
    }
  }

  /**
   * Get all critical errors that need manual review
   */
  async getCriticalErrors(status = 'needs_manual_review') {
    try {
      const { data, error } = await supabase
        .from('critical_payment_errors')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching critical errors:', error)
      return []
    }
  }

  /**
   * Mark critical error as resolved
   */
  async resolveCriticalError(transactionId, resolutionData) {
    try {
      await supabase
        .from('critical_payment_errors')
        .update({
          status: 'resolved',
          resolution_method: resolutionData.method,
          resolution_notes: resolutionData.notes,
          resolved_by: resolutionData.adminId,
          resolved_at: new Date()
        })
        .eq('transaction_id', transactionId)

      return { success: true }
    } catch (error) {
      console.error('Error resolving critical error:', error)
      return { success: false, error: error.message }
    }
  }
}

export default new PaymentRecoveryService()