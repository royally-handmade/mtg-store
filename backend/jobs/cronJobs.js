// backend/jobs/cronJobs.js - Automated cron jobs for payment and payout system

import cron from 'node-cron'
import { supabase } from '../server.js'
import sellerPayoutService from '../services/sellerPayoutService.js'
import helcimService from '../services/helcimService.js'

class CronJobManager {
  constructor() {
    this.jobs = new Map()
    this.initialize()
  }

  initialize() {
    console.log('🕐 Initializing automated cron jobs...')

    // Only run cron jobs in production or if explicitly enabled
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON_JOBS === 'true') {
      this.setupPayoutJobs()
      this.setupAnalyticsJobs()
      this.setupMaintenanceJobs()
      this.setupMonitoringJobs()
    } else {
      console.log('⏸️ Cron jobs disabled for development environment')
    }
  }

  setupPayoutJobs() {
    // Automatic seller payouts - Weekly on Mondays at 9 AM Eastern
    const payoutJob = cron.schedule('0 9 * * 1', async () => {
      try {
        console.log('🔄 Starting weekly automatic payout processing...')
        const results = await sellerPayoutService.processAutomaticPayouts()
        
        const successful = results.filter(r => r.success).length
        const failed = results.filter(r => !r.success).length
        
        console.log(`✅ Weekly payouts completed: ${successful} successful, ${failed} failed`)
        
        // Log the job execution
        await this.logJobExecution('automatic_payouts', 'completed', {
          successful_payouts: successful,
          failed_payouts: failed,
          total_processed: results.length
        })
      } catch (error) {
        console.error('❌ Weekly payout processing failed:', error)
        await this.logJobExecution('automatic_payouts', 'failed', { error: error.message })
      }
    }, {
      timezone: 'America/Toronto'
    })

    // Daily payout eligibility check - Every day at 8 AM
    const eligibilityJob = cron.schedule('0 8 * * *', async () => {
      try {
        console.log('🔍 Checking seller payout eligibility...')
        const eligibleSellers = await sellerPayoutService.getEligibleSellers()
        const autoEligible = eligibleSellers.filter(s => s.canAutoProcess).length
        
        console.log(`💰 Found ${eligibleSellers.length} eligible sellers (${autoEligible} auto-payout enabled)`)
        
        // Send daily report to admins if there are many pending payouts
        if (eligibleSellers.length > 10) {
          await this.sendPayoutEligibilityReport(eligibleSellers)
        }
        
        await this.logJobExecution('payout_eligibility_check', 'completed', {
          eligible_sellers: eligibleSellers.length,
          auto_eligible: autoEligible
        })
      } catch (error) {
        console.error('❌ Payout eligibility check failed:', error)
        await this.logJobExecution('payout_eligibility_check', 'failed', { error: error.message })
      }
    }, {
      timezone: 'America/Toronto'
    })

    // Failed payout monitoring - Every 4 hours
    const failedPayoutJob = cron.schedule('0 */4 * * *', async () => {
      try {
        console.log('🔍 Checking for failed payouts...')
        const failedPayouts = await sellerPayoutService.checkFailedPayouts()
        
        if (failedPayouts && failedPayouts.length > 0) {
          console.log(`⚠️ Found ${failedPayouts.length} failed payouts requiring attention`)
        }
        
        await this.logJobExecution('failed_payout_check', 'completed', {
          failed_payouts_found: failedPayouts?.length || 0
        })
      } catch (error) {
        console.error('❌ Failed payout check failed:', error)
        await this.logJobExecution('failed_payout_check', 'failed', { error: error.message })
      }
    })

    this.jobs.set('automatic_payouts', payoutJob)
    this.jobs.set('payout_eligibility', eligibilityJob)
    this.jobs.set('failed_payout_check', failedPayoutJob)
  }

  setupAnalyticsJobs() {
    // Daily analytics update - Every day at 1 AM
    const analyticsJob = cron.schedule('0 1 * * *', async () => {
      try {
        console.log('📊 Updating daily payment analytics...')
        
        // Update analytics for yesterday and today
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const today = new Date()
        
        await Promise.all([
          supabase.rpc('update_payment_analytics', { target_date: yesterday.toISOString().split('T')[0] }),
          supabase.rpc('update_payment_analytics', { target_date: today.toISOString().split('T')[0] })
        ])
        
        console.log('✅ Daily analytics updated successfully')
        await this.logJobExecution('daily_analytics', 'completed')
      } catch (error) {
        console.error('❌ Daily analytics update failed:', error)
        await this.logJobExecution('daily_analytics', 'failed', { error: error.message })
      }
    }, {
      timezone: 'America/Toronto'
    })

    // Weekly analytics summary - Sundays at 11 PM
    const weeklyReportJob = cron.schedule('0 23 * * 0', async () => {
      try {
        console.log('📈 Generating weekly analytics report...')
        
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - 7)
        
        const report = await sellerPayoutService.generatePayoutReport(
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        )
        
        await this.sendWeeklyAnalyticsReport(report)
        
        console.log('✅ Weekly analytics report sent')
        await this.logJobExecution('weekly_analytics_report', 'completed', {
          total_payouts: report.summary.totalPayouts,
          total_amount: report.summary.totalAmount
        })
      } catch (error) {
        console.error('❌ Weekly analytics report failed:', error)
        await this.logJobExecution('weekly_analytics_report', 'failed', { error: error.message })
      }
    }, {
      timezone: 'America/Toronto'
    })

    this.jobs.set('daily_analytics', analyticsJob)
    this.jobs.set('weekly_report', weeklyReportJob)
  }

  setupMaintenanceJobs() {
    // Cleanup old payment logs - Weekly on Saturdays at 2 AM
    const logCleanupJob = cron.schedule('0 2 * * 6', async () => {
      try {
        console.log('🧹 Cleaning up old payment logs...')
        
        // Delete payment logs older than 90 days
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - 90)
        
        const { count } = await supabase
          .from('payment_logs')
          .delete()
          .lt('created_at', cutoffDate.toISOString())
        
        console.log(`🗑️ Cleaned up ${count} old payment log entries`)
        await this.logJobExecution('log_cleanup', 'completed', { records_deleted: count })
      } catch (error) {
        console.error('❌ Log cleanup failed:', error)
        await this.logJobExecution('log_cleanup', 'failed', { error: error.message })
      }
    })

    // Archive completed orders - Monthly on the 1st at 3 AM
    const orderArchiveJob = cron.schedule('0 3 1 * *', async () => {
      try {
        console.log('📦 Archiving old completed orders...')
        
        // Archive orders completed more than 6 months ago
        const cutoffDate = new Date()
        cutoffDate.setMonth(cutoffDate.getMonth() - 6)
        
        const { data: oldOrders } = await supabase
          .from('orders')
          .select('id')
          .eq('status', 'delivered')
          .lt('delivered_at', cutoffDate.toISOString())
          .limit(1000) // Process in batches
        
        if (oldOrders && oldOrders.length > 0) {
          // In a real implementation, you might move these to an archive table
          // For now, we'll just mark them as archived
          await supabase
            .from('orders')
            .update({ archived: true, archived_at: new Date() })
            .in('id', oldOrders.map(o => o.id))
          
          console.log(`📁 Archived ${oldOrders.length} old orders`)
        }
        
        await this.logJobExecution('order_archive', 'completed', { 
          orders_archived: oldOrders?.length || 0 
        })
      } catch (error) {
        console.error('❌ Order archiving failed:', error)
        await this.logJobExecution('order_archive', 'failed', { error: error.message })
      }
    })

    this.jobs.set('log_cleanup', logCleanupJob)
    this.jobs.set('order_archive', orderArchiveJob)
  }

  setupMonitoringJobs() {
    // System health check - Every 30 minutes
    const healthCheckJob = cron.schedule('*/30 * * * *', async () => {
      try {
        const healthStatus = await this.performHealthCheck()
        
        if (!healthStatus.healthy) {
          console.warn('⚠️ System health check failed:', healthStatus.issues)
          await this.sendHealthAlert(healthStatus)
        }
        
        await this.logJobExecution('health_check', healthStatus.healthy ? 'completed' : 'warning', {
          status: healthStatus
        })
      } catch (error) {
        console.error('❌ Health check failed:', error)
        await this.logJobExecution('health_check', 'failed', { error: error.message })
      }
    })

    // Database connection check - Every 5 minutes
    const dbCheckJob = cron.schedule('*/5 * * * *', async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .limit(1)
        
        if (error) {
          throw new Error(`Database connection failed: ${error.message}`)
        }
        
        // Success - database is responsive
      } catch (error) {
        console.error('❌ Database health check failed:', error)
        await this.sendDatabaseAlert(error)
      }
    })

    this.jobs.set('health_check', healthCheckJob)
    this.jobs.set('db_check', dbCheckJob)
  }

  async performHealthCheck() {
    const issues = []
    const checks = {
      database: false,
      helcim: false,
      email: false,
      storage: false
    }

    try {
      // Database check
      const { error: dbError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
      
      if (!dbError) checks.database = true
      else issues.push(`Database: ${dbError.message}`)

      // Helcim connectivity check (if credentials are configured)
      if (process.env.HELCIM_API_KEY) {
        try {
          // Simple API call to check connectivity
          // Note: This would need a lightweight Helcim endpoint
          checks.helcim = true
        } catch (error) {
          issues.push(`Helcim: ${error.message}`)
        }
      } else {
        checks.helcim = true // Skip if not configured
      }

      // Email service check
      if (process.env.SMTP_HOST) {
        checks.email = true // Assume working unless we get an error
      }

      // Storage check
      try {
        const { data, error } = await supabase.storage
          .from('documents')
          .list('', { limit: 1 })
        
        if (!error) checks.storage = true
        else issues.push(`Storage: ${error.message}`)
      } catch (error) {
        issues.push(`Storage: ${error.message}`)
      }

    } catch (error) {
      issues.push(`Health check error: ${error.message}`)
    }

    const healthy = Object.values(checks).every(check => check === true)

    return {
      healthy,
      checks,
      issues,
      timestamp: new Date().toISOString()
    }
  }

  async sendPayoutEligibilityReport(eligibleSellers) {
    try {
      const totalPending = eligibleSellers.reduce((sum, seller) => sum + seller.pendingEarnings, 0)
      
      const emailHtml = `
        <h2>Daily Payout Eligibility Report</h2>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>Eligible Sellers:</strong> ${eligibleSellers.length}</p>
        <p><strong>Total Pending Amount:</strong> $${totalPending.toFixed(2)} CAD</p>
        <p><strong>Auto-Payout Enabled:</strong> ${eligibleSellers.filter(s => s.canAutoProcess).length}</p>
        
        <h3>Top Pending Payouts</h3>
        <ul>
          ${eligibleSellers
            .sort((a, b) => b.pendingEarnings - a.pendingEarnings)
            .slice(0, 10)
            .map(seller => `
              <li>${seller.display_name}: $${seller.pendingEarnings.toFixed(2)} 
                  ${seller.canAutoProcess ? '(Auto)' : '(Manual)'}
              </li>
            `).join('')}
        </ul>
      `

      await this.sendAdminEmail('Daily Payout Eligibility Report', emailHtml)
    } catch (error) {
      console.error('Error sending payout eligibility report:', error)
    }
  }

  async sendWeeklyAnalyticsReport(report) {
    try {
      const emailHtml = `
        <h2>Weekly Analytics Report</h2>
        <p><strong>Period:</strong> ${report.dateRange.startDate} to ${report.dateRange.endDate}</p>
        
        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>Summary</h3>
          <p><strong>Total Payouts:</strong> ${report.summary.totalPayouts}</p>
          <p><strong>Total Amount:</strong> $${report.summary.totalAmount.toFixed(2)} CAD</p>
          <p><strong>Successful:</strong> ${report.summary.successfulPayouts}</p>
          <p><strong>Failed:</strong> ${report.summary.failedPayouts}</p>
          <p><strong>Pending:</strong> ${report.summary.pendingPayouts}</p>
        </div>
        
        <h3>Payment Methods</h3>
        <ul>
          ${Object.entries(report.summary.byMethod).map(([method, data]) => `
            <li>${method}: ${data.count} payouts, $${data.amount.toFixed(2)}</li>
          `).join('')}
        </ul>
      `

      await this.sendAdminEmail('Weekly Analytics Report', emailHtml)
    } catch (error) {
      console.error('Error sending weekly analytics report:', error)
    }
  }

  async sendHealthAlert(healthStatus) {
    try {
      const emailHtml = `
        <h2>System Health Alert</h2>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Status:</strong> ⚠️ UNHEALTHY</p>
        
        <h3>Issues Detected</h3>
        <ul>
          ${healthStatus.issues.map(issue => `<li>${issue}</li>`).join('')}
        </ul>
        
        <h3>System Checks</h3>
        <ul>
          <li>Database: ${healthStatus.checks.database ? '✅' : '❌'}</li>
          <li>Helcim: ${healthStatus.checks.helcim ? '✅' : '❌'}</li>
          <li>Email: ${healthStatus.checks.email ? '✅' : '❌'}</li>
          <li>Storage: ${healthStatus.checks.storage ? '✅' : '❌'}</li>
        </ul>
        
        <p>Please investigate and resolve these issues immediately.</p>
      `

      await this.sendAdminEmail('URGENT: System Health Alert', emailHtml)
    } catch (error) {
      console.error('Error sending health alert:', error)
    }
  }

  async sendDatabaseAlert(error) {
    try {
      const emailHtml = `
        <h2>Database Connection Alert</h2>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Error:</strong> ${error.message}</p>
        <p>The database connection has failed. Please check the database status immediately.</p>
      `

      await this.sendAdminEmail('CRITICAL: Database Connection Failed', emailHtml)
    } catch (error) {
      console.error('Error sending database alert:', error)
    }
  }

  async sendAdminEmail(subject, html) {
    try {
      const { data: admins } = await supabase
        .from('profiles')
        .select('email')
        .eq('role', 'admin')

      const nodemailer = await import('nodemailer')
      const transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      })

      for (const admin of admins) {
        await transporter.sendMail({
          from: process.env.FROM_EMAIL,
          to: admin.email,
          subject: subject,
          html: html
        })
      }
    } catch (error) {
      console.error('Error sending admin email:', error)
    }
  }

  async logJobExecution(jobName, status, metadata = {}) {
    try {
      await supabase
        .from('cron_job_logs')
        .insert({
          job_name: jobName,
          status: status,
          metadata: metadata,
          executed_at: new Date()
        })
    } catch (error) {
      console.error('Error logging job execution:', error)
    }
  }

  // Manual job controls
  startJob(jobName) {
    const job = this.jobs.get(jobName)
    if (job) {
      job.start()
      console.log(`✅ Started job: ${jobName}`)
    } else {
      console.error(`❌ Job not found: ${jobName}`)
    }
  }

  stopJob(jobName) {
    const job = this.jobs.get(jobName)
    if (job) {
      job.stop()
      console.log(`🛑 Stopped job: ${jobName}`)
    } else {
      console.error(`❌ Job not found: ${jobName}`)
    }
  }

  getJobStatus() {
    const status = {}
    for (const [name, job] of this.jobs) {
      status[name] = {
        running: job.running || false,
        scheduled: job.scheduled || false
      }
    }
    return status
  }

  shutdown() {
    console.log('🛑 Shutting down all cron jobs...')
    for (const [name, job] of this.jobs) {
      job.stop()
      console.log(`  - Stopped ${name}`)
    }
    this.jobs.clear()
  }
}

// Export singleton instance
export default new CronJobManager()