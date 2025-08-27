// backend/services/marketPriceService.js
import { supabase } from '../server.js'
import cron from 'node-cron'

class MarketPriceService {
  constructor() {
    this.startDailyPriceCalculation()
  }

  /**
   * Start the daily price calculation cron job
   */
  startDailyPriceCalculation() {
    // Run every day at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('🔄 Starting daily market price calculation...')
      await this.calculateAllMarketPrices()
      await this.createDailyPriceSnapshots()
    })
    
    console.log('📊 Market price calculation service started')
  }

  /**
   * Calculate market price for a specific card based on recent sales
   */
  async calculateMarketPriceForCard(cardId, options = {}) {
    try {
      const {
        daysBack = 30,        // Look back 30 days for sales data
        minSalesCount = 3,    // Minimum number of sales to calculate average
        weightRecent = true   // Weight more recent sales higher
      } = options

      // Get recent completed sales for this card
      const sinceDate = new Date()
      sinceDate.setDate(sinceDate.getDate() - daysBack)

      const { data: recentSales, error: salesError } = await supabase
        .from('order_items')
        .select(`
          price,
          quantity,
          created_at,
          orders!inner(status, created_at),
          listings!inner(condition, cards!inner(id))
        `)
        .eq('orders.status', 'completed')
        .eq('listings.cards.id', cardId)
        .gte('orders.created_at', sinceDate.toISOString())
        .order('orders.created_at', { ascending: false })

      if (salesError) throw salesError

      let calculatedPrice = null
      let priceSource = 'fallback'
      let salesUsed = 0

      // Calculate price based on recent sales if we have enough data
      if (recentSales && recentSales.length >= minSalesCount) {
        let totalWeightedPrice = 0
        let totalWeight = 0

        recentSales.forEach((sale, index) => {
          // Weight calculation: more recent sales get higher weight
          const daysAgo = Math.floor((Date.now() - new Date(sale.orders.created_at)) / (1000 * 60 * 60 * 24))
          const weight = weightRecent ? Math.max(1, 30 - daysAgo) / 30 : 1
          
          // Add each unit sold at its price (handles quantity > 1)
          for (let i = 0; i < sale.quantity; i++) {
            totalWeightedPrice += sale.price * weight
            totalWeight += weight
          }
        })

        calculatedPrice = totalWeightedPrice / totalWeight
        priceSource = 'sales_average'
        salesUsed = recentSales.reduce((sum, sale) => sum + sale.quantity, 0)

        console.log(`📈 Card ${cardId}: Calculated from ${salesUsed} recent sales = $${calculatedPrice.toFixed(2)}`)
      }

      // Fallback 1: Use average of current active listings
      if (!calculatedPrice) {
        const { data: currentListings } = await supabase
          .from('listings')
          .select('price, quantity')
          .eq('card_id', cardId)
          .eq('status', 'active')
          .gt('quantity', 0)

        if (currentListings && currentListings.length > 0) {
          // Weight by quantity available
          let totalWeightedPrice = 0
          let totalQuantity = 0

          currentListings.forEach(listing => {
            totalWeightedPrice += listing.price * listing.quantity
            totalQuantity += listing.quantity
          })

          calculatedPrice = totalWeightedPrice / totalQuantity
          priceSource = 'current_listings'
          
          console.log(`📊 Card ${cardId}: Calculated from current listings = $${calculatedPrice.toFixed(2)}`)
        }
      }

      // Fallback 2: Use external price data (Scryfall, etc.)
      if (!calculatedPrice) {
        const { data: card } = await supabase
          .from('cards')
          .select('prices, market_price')
          .eq('id', cardId)
          .single()

        // Try Scryfall USD price first
        if (card?.prices?.usd) {
          calculatedPrice = parseFloat(card.prices.usd)
          priceSource = 'external_scryfall'
        }
        // Fall back to current market_price if it exists
        else if (card?.market_price) {
          calculatedPrice = parseFloat(card.market_price)
          priceSource = 'existing_price'
        }
        // Last resort: set a minimal price
        else {
          calculatedPrice = 0.25
          priceSource = 'minimum_fallback'
        }

        console.log(`🔄 Card ${cardId}: Using ${priceSource} = $${calculatedPrice.toFixed(2)}`)
      }

      // Update the card's market price
      if (calculatedPrice) {
        const { error: updateError } = await supabase
          .from('cards')
          .update({
            market_price: parseFloat(calculatedPrice.toFixed(2)),
            market_price_updated_at: new Date().toISOString(),
            market_price_source: priceSource,
            last_sales_count: salesUsed
          })
          .eq('id', cardId)

        if (updateError) throw updateError
      }

      return {
        success: true,
        cardId,
        price: calculatedPrice,
        source: priceSource,
        salesUsed,
        daysBack
      }

    } catch (error) {
      console.error(`❌ Error calculating market price for card ${cardId}:`, error)
      return {
        success: false,
        cardId,
        error: error.message
      }
    }
  }

  /**
   * Calculate market prices for all cards (or a subset)
   */
  async calculateAllMarketPrices(options = {}) {
    try {
      const {
        batchSize = 50,
        onlyCardsWithSales = false,
        cardIds = null
      } = options

      let query = supabase.from('cards').select('id')

      // Filter to specific cards if provided
      if (cardIds && Array.isArray(cardIds)) {
        query = query.in('id', cardIds)
      }
      // Or only cards that have had sales
      else if (onlyCardsWithSales) {
        query = query.in('id', supabase
          .from('order_items')
          .select('listings!inner(cards!inner(id))')
          .eq('orders.status', 'completed')
        )
      }

      const { data: cards, error } = await query.order('id')
      if (error) throw error

      console.log(`🔄 Calculating market prices for ${cards.length} cards...`)

      let processed = 0
      let successful = 0
      let failed = 0

      // Process in batches to avoid overwhelming the database
      for (let i = 0; i < cards.length; i += batchSize) {
        const batch = cards.slice(i, i + batchSize)
        
        // Process batch in parallel
        const batchPromises = batch.map(card => 
          this.calculateMarketPriceForCard(card.id)
        )
        
        const batchResults = await Promise.allSettled(batchPromises)
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value.success) {
            successful++
          } else {
            failed++
            console.error(`❌ Failed to process card ${batch[index].id}:`, 
              result.reason || result.value?.error)
          }
          processed++
        })

        // Small delay between batches
        if (i + batchSize < cards.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        // Progress logging
        if (processed % 100 === 0 || processed === cards.length) {
          console.log(`📊 Progress: ${processed}/${cards.length} cards processed (${successful} successful, ${failed} failed)`)
        }
      }

      console.log(`✅ Market price calculation complete: ${successful} successful, ${failed} failed`)

      return {
        success: true,
        totalProcessed: processed,
        successful,
        failed
      }

    } catch (error) {
      console.error('❌ Error in calculateAllMarketPrices:', error)
      throw error
    }
  }

  /**
   * Create daily price history snapshots
   */
  async createDailyPriceSnapshots() {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      // Check if we already have snapshots for today
      const { data: existingSnapshots } = await supabase
        .from('price_history')
        .select('card_id')
        .gte('date', today.toISOString())

      if (existingSnapshots && existingSnapshots.length > 0) {
        console.log(`📸 Price snapshots for ${today.toDateString()} already exist, skipping...`)
        return
      }

      // Get all cards with current market prices
      const { data: cards, error } = await supabase
        .from('cards')
        .select('id, market_price, market_price_source')
        .not('market_price', 'is', null)

      if (error) throw error

      console.log(`📸 Creating price snapshots for ${cards.length} cards...`)

      // Create price history entries in batches
      const batchSize = 100
      let inserted = 0

      for (let i = 0; i < cards.length; i += batchSize) {
        const batch = cards.slice(i, i + batchSize)
        
        const historyEntries = batch.map(card => ({
          card_id: card.id,
          price: card.market_price,
          date: today.toISOString(),
          price_source: card.market_price_source || 'unknown',
          created_at: new Date().toISOString()
        }))

        const { error: insertError } = await supabase
          .from('price_history')
          .insert(historyEntries)

        if (insertError) {
          console.error('❌ Error inserting price history batch:', insertError)
        } else {
          inserted += historyEntries.length
        }
      }

      console.log(`✅ Created ${inserted} price history snapshots for ${today.toDateString()}`)

      return { success: true, inserted }

    } catch (error) {
      console.error('❌ Error creating daily price snapshots:', error)
      throw error
    }
  }

  /**
   * Trigger market price recalculation after an order is completed
   */
  async onOrderCompleted(orderId) {
    try {
      // Get all unique card IDs from this order
      const { data: orderItems, error } = await supabase
        .from('order_items')
        .select('listings!inner(cards!inner(id))')
        .eq('order_id', orderId)

      if (error) throw error

      const uniqueCardIds = [...new Set(
        orderItems.map(item => item.listings.cards.id)
      )]

      console.log(`🔄 Order ${orderId} completed, recalculating prices for ${uniqueCardIds.length} cards...`)

      // Recalculate market price for each affected card
      const results = await Promise.allSettled(
        uniqueCardIds.map(cardId => this.calculateMarketPriceForCard(cardId))
      )

      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
      const failed = results.length - successful

      console.log(`✅ Price recalculation after order completion: ${successful} successful, ${failed} failed`)

      return { success: true, cardsUpdated: successful, cardsFailed: failed }

    } catch (error) {
      console.error(`❌ Error in onOrderCompleted for order ${orderId}:`, error)
      throw error
    }
  }

  /**
   * Get market price statistics
   */
  async getMarketPriceStats() {
    try {
      // Get overall stats
      const { data: overallStats, error: statsError } = await supabase
        .from('cards')
        .select('market_price, market_price_source, market_price_updated_at', { count: 'exact' })
        .not('market_price', 'is', null)

      if (statsError) throw statsError

      // Group by price source
      const sourceStats = {}
      let totalCards = 0
      let averagePrice = 0

      overallStats.forEach(card => {
        const source = card.market_price_source || 'unknown'
        sourceStats[source] = (sourceStats[source] || 0) + 1
        totalCards++
        averagePrice += parseFloat(card.market_price || 0)
      })

      averagePrice = totalCards > 0 ? averagePrice / totalCards : 0

      // Get recent update stats
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count: recentlyUpdated } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .gte('market_price_updated_at', oneDayAgo)

      return {
        totalCardsWithPrices: totalCards,
        averageMarketPrice: parseFloat(averagePrice.toFixed(2)),
        priceSourceBreakdown: sourceStats,
        recentlyUpdated: recentlyUpdated || 0
      }

    } catch (error) {
      console.error('❌ Error getting market price stats:', error)
      throw error
    }
  }
}

// Create and export singleton instance
export const marketPriceService = new MarketPriceService()