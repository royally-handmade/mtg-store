import { supabase } from '../server.js'
import { sendPriceAlert } from './emailService.js'
import cron from 'node-cron'

class PriceMonitoringService {
  constructor() {
    this.startPriceAlertProcessor()
  }

  // Start the price alert processing cron job
  startPriceAlertProcessor() {
    // Run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.processPriceAlerts()
    })
    
    console.log('🔔 Price alert processor started')
  }

  // Process pending price alert notifications
  async processPriceAlerts() {
    try {
      const { data: alerts, error } = await supabase
        .from('price_alert_notifications')
        .select(`
          *,
          profiles:user_id (email, display_name, email_preferences),
          cards:card_id (name, image_url, set_number)
        `)
        .eq('email_sent', false)
        .limit(50) // Process in batches
      
      if (error) throw error
      
      for (const alert of alerts) {
        try {
          // Check if user wants price alert emails
          const emailPrefs = alert.profiles?.email_preferences || {}
          if (emailPrefs.price_alerts === false) {
            // Mark as sent but don't actually send
            await this.markAlertAsSent(alert.id, false)
            continue
          }
          
          // Send price alert email
          await sendPriceAlert(
            alert.profiles.email,
            alert.cards,
            alert.current_price,
            alert.alert_price
          )
          
          await this.markAlertAsSent(alert.id, true)
          console.log(`✅ Price alert sent for ${alert.cards.name} to ${alert.profiles.email}`)
          
          // Small delay to avoid overwhelming email service
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          console.error(`❌ Failed to send price alert ${alert.id}:`, error)
          // Could implement retry logic here
        }
      }
      
      if (alerts.length > 0) {
        console.log(`📧 Processed ${alerts.length} price alerts`)
      }
    } catch (error) {
      console.error('Error processing price alerts:', error)
    }
  }

  // Mark alert as sent
  async markAlertAsSent(alertId, emailSent = true) {
    await supabase
      .from('price_alert_notifications')
      .update({
        email_sent: emailSent,
        email_sent_at: emailSent ? new Date().toISOString() : null
      })
      .eq('id', alertId)
  }

  // Get price alert statistics
  async getPriceAlertStats(timeframe = '24h') {
    try {
      const hoursBack = timeframe === '1h' ? 1 : timeframe === '24h' ? 24 : 168
      const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()
      
      const { data, error } = await supabase
        .from('price_alert_notifications')
        .select('*')
        .gte('triggered_at', since)
      
      if (error) throw error
      
      return {
        total_alerts: data.length,
        emails_sent: data.filter(alert => alert.email_sent).length,
        pending_emails: data.filter(alert => !alert.email_sent).length,
        timeframe
      }
    } catch (error) {
      console.error('Error getting price alert stats:', error)
      return null
    }
  }
}

// Create singleton instance
export const priceMonitoringService = new PriceMonitoringService()
