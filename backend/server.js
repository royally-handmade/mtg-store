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
import usersRoutes from './routes/users.js'
import './services/priceMonitoringService.js'
import { WishlistAnalyticsService } from './services/wishlistAnalyticsService.js'

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
})

app.get('/api/analytics/wishlist-popular', async (req, res) => {
  try {
    const popularCards = await WishlistAnalyticsService.getPopularWishlistCards(20)
    res.json(popularCards)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch popular wishlist cards' })
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

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`)
  console.log(`❤️ Wishlist functionality: Enabled`)
})