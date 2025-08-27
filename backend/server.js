import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Import routes
import authRoutes from './routes/auth.js'
import cardsRoutes from './routes/cards.js'
import listingsRoutes from './routes/listings.js'
import ordersRoutes from './routes/orders.js'
import sellerRoutes from './routes/seller.js'
import adminRoutes from './routes/admin.js'
import deckBuilderRoutes from './routes/deckBuilder.js'
import cartRoutes from './routes/cart.js'
import shippingRoutes from './routes/shipping.js'
import paymentRoutes from './routes/payment.js'
import wishlistRoutes from './routes/wishlist.js'  // Add this import
import scryfallRoutes from './routes/scryfall.js'
import usersRoutes from './routes/users.js'
import './services/priceMonitoringService.js'
import { WishlistAnalyticsService } from './services/wishlistAnalyticsService.js'
import searchRoutes from './routes/search.js'
import { marketPriceService } from './services/marketPriceService.js'

// Import middleware
import { authenticateUser } from './middleware/auth.js'
import { rateLimitMiddleware } from './middleware/rateLimiter.js'

// Import cron jobs
//import './jobs/cronJobs.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Supabase client
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export const superbaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

// Middleware
app.use(helmet())
app.use(cors())
app.use(morgan('combined'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(rateLimitMiddleware)


// Routes
app.use('/api/auth', authRoutes)
app.use('/api/cards', cardsRoutes)
app.use('/api/listings', listingsRoutes)
app.use('/api/orders', ordersRoutes)
app.use('/api/seller', authenticateUser, sellerRoutes)
app.use('/api/admin', authenticateUser, adminRoutes)
app.use('/api/deck-builder', authenticateUser, deckBuilderRoutes)
app.use('/api/cart', cartRoutes)
app.use('/api/shipping', shippingRoutes)
app.use('/api/payment', paymentRoutes)
app.use('/api/wishlist', wishlistRoutes)  // Add this route
app.use('/api/users', usersRoutes)
app.use('/api/scryfall', authenticateUser, scryfallRoutes)
app.use('/api/search', searchRoutes)


// Health check
app.get('/api/health', async (req, res) => {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {}
    }

    // Test database connection
    try {
      const { data: dbTest, error: dbError } = await supabase
        .from('cards')
        .select('id')
        .limit(1)

      if (dbError) throw dbError
      healthCheck.services.database = 'connected'
    } catch (error) {
      healthCheck.services.database = `error: ${error.message}`
      healthCheck.status = 'degraded'
    }

    // Test market price service
    try {
      const priceStats = await marketPriceService.getMarketPriceStats()
      healthCheck.services.marketPriceService = 'active'
      healthCheck.marketPriceStats = {
        totalCardsWithPrices: priceStats.totalCardsWithPrices,
        averageMarketPrice: priceStats.averageMarketPrice,
        recentlyUpdated: priceStats.recentlyUpdated,
        priceSourceBreakdown: priceStats.priceSourceBreakdown
      }
    } catch (error) {
      healthCheck.services.marketPriceService = `error: ${error.message}`
      healthCheck.status = 'degraded'
    }

    // Return appropriate HTTP status
    const httpStatus = healthCheck.status === 'healthy' ? 200 : 503
    res.status(httpStatus).json(healthCheck)

  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Something went wrong!' })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

//Wishlist Analytics Service
app.get('/api/analytics/wishlist-popular', async (req, res) => {
  try {
    const popularCards = await WishlistAnalyticsService.getPopularWishlistCards(20)
    res.json(popularCards)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch popular wishlist cards' })
  }
})

// Optional: Run initial price calculation on server startup
// Uncomment this section if you want to calculate prices immediately when server starts
/*setTimeout(async () => {
  try {
    console.log('🔄 Running initial market price calculation...')
    
    // Only update cards that have sales data to avoid overwhelming the system
    const result = await marketPriceService.calculateAllMarketPrices({
      onlyCardsWithSales: true, // Only cards with actual sales
      batchSize: 25             // Smaller batch size for startup
    })
    
    console.log(`✅ Initial price calculation complete: ${result.successful} cards updated, ${result.failed} failed`)
    
    // Also create initial price snapshots if needed
    await marketPriceService.createDailyPriceSnapshots()
    console.log('📸 Initial price snapshots created')
    
  } catch (error) {
    console.error('❌ Error in initial price calculation:', error)
    // Don't crash the server if price calculation fails
  }
}, 5000) // Wait 5 seconds after server startup to let everything settle

process.on('unhandledRejection', (error) => {
  // Check if the error is related to market price calculations
  if (error.message?.includes('market_price') || 
      error.message?.includes('price_history') ||
      error.message?.includes('calculateMarketPrice')) {
    
    console.error('❌ Market price service error (non-fatal):', error)
    
    // Log additional context
    console.error('Error stack:', error.stack)
    console.error('Error occurred at:', new Date().toISOString())
    
    // Don't crash the server for price calculation errors
    // The main application should continue running even if price calc fails
    return
  }
  
  // Re-throw other errors that should crash the server
  console.error('💥 Critical server error:', error)
  throw error
})
  */


app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`)
  console.log(`❤️ Wishlist functionality: Enabled`)

})