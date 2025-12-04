import express from 'express'
import { supabase } from '../server.js'
import { authenticateUser } from '../middleware/auth.js'
import { wishlistRateLimiter } from '../middleware/rateLimiter.js'
import { sendPriceAlert } from '../services/emailServiceMailgun.js'

const router = express.Router()

// Apply rate limiting to wishlist operations
router.use(wishlistRateLimiter)

// Get user's wishlist
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { limit = 50, include_listings = false } = req.query
    
    let query = supabase
      .from('wishlists')
      .select(`
        *,
        cards (
          id,
          name,
          image_url,
          set_number,
          market_price,
          rarity,
          type_line
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

      
    const { data, error } = await query

    if (error) throw error
    
    // Optionally include current listings for each card
    if (include_listings === 'true') {
      for (const item of data) {
        const { data: listings } = await supabase
          .from('listings')
          .select(`
            id, price, condition, quantity, seller_id,
            profiles:seller_id (display_name, rating)
          `)
          .eq('card_id', item.card_id)
          .eq('status', 'active')
          .order('price', { ascending: true })
          .limit(5)
        
        item.available_listings = listings || []
      }
    }
    
    res.json(data)
  } catch (error) {
    console.error('Error fetching wishlist:', error)
    res.status(500).json({ error: error.message })
  }
})

// Check if specific cards are in wishlist (bulk check)
router.post('/check', authenticateUser, async (req, res) => {
  try {
    const { card_ids } = req.body
    
    if (!Array.isArray(card_ids)) {
      return res.status(400).json({ error: 'card_ids must be an array' })
    }
    
    const { data, error } = await supabase
      .from('wishlists')
      .select('card_id, max_price')
      .eq('user_id', req.user.id)
      .in('card_id', card_ids)
    
    if (error) throw error
    
    const result = {}
    card_ids.forEach(cardId => {
      const wishlistItem = data.find(item => item.card_id === cardId)
      result[cardId] = {
        inWishlist: !!wishlistItem,
        maxPrice: wishlistItem?.max_price || null
      }
    })
    
    res.json(result)
  } catch (error) {
    console.error('Error checking wishlist:', error)
    res.status(500).json({ error: error.message })
  }
})

// Check if single card is in wishlist
router.get('/check/:card_id', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('wishlists')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('card_id', req.params.card_id)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error
    
    res.json({
      inWishlist: !!data,
      maxPrice: data?.max_price || null,
      conditionPreference: data?.condition_preference || null,
      createdAt: data?.created_at || null
    })
  } catch (error) {
    console.error('Error checking wishlist status:', error)
    res.status(500).json({ error: error.message })
  }
})

// Add card to wishlist
router.post('/', authenticateUser, async (req, res) => {
  try {
    const { card_id, max_price = null, condition_preference = null } = req.body
    
    if (!card_id) {
      return res.status(400).json({ error: 'card_id is required' })
    }
    
    // Check if card exists
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, name, market_price')
      .eq('id', card_id)
      .single()
    
    if (cardError) {
      return res.status(404).json({ error: 'Card not found' })
    }
    
    // Validate max_price if provided
    if (max_price && (max_price <= 0 || max_price > card.market_price * 2)) {
      return res.status(400).json({ error: 'Invalid max_price' })
    }
    
    // Check if already in wishlist
    const { data: existing } = await supabase
      .from('wishlists')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('card_id', card_id)
      .single()
    
    if (existing) {
      return res.status(409).json({ error: 'Card already in wishlist' })
    }
    
    const { data, error } = await supabase
      .from('wishlists')
      .insert({
        user_id: req.user.id,
        card_id,
        max_price,
        condition_preference
      })
      .select(`
        *,
        cards (
          id, name, image_url, set_number, market_price, rarity
        )
      `)
      .single()
    
    if (error) throw error
    
    // Log wishlist activity
    await logWishlistActivity(req.user.id, 'added', card_id, {
      max_price,
      condition_preference
    })
    
    res.status(201).json(data)
  } catch (error) {
    console.error('Error adding to wishlist:', error)
    res.status(500).json({ error: error.message })
  }
})

// Update wishlist item (price alert, condition preference)
router.put('/:card_id', authenticateUser, async (req, res) => {
  try {
    const { max_price, condition_preference } = req.body
    const card_id = req.params.card_id
    
    // Validate max_price if provided
    if (max_price !== null && max_price !== undefined) {
      if (max_price <= 0) {
        return res.status(400).json({ error: 'max_price must be greater than 0' })
      }
      
      // Check current card price
      const { data: card } = await supabase
        .from('cards')
        .select('market_price')
        .eq('id', card_id)
        .single()
      
      if (card && max_price > card.market_price * 2) {
        return res.status(400).json({ error: 'max_price too high' })
      }
    }
    
    const updateData = {}
    if (max_price !== undefined) updateData.max_price = max_price
    if (condition_preference !== undefined) updateData.condition_preference = condition_preference
    updateData.updated_at = new Date()
    
    const { data, error } = await supabase
      .from('wishlists')
      .update(updateData)
      .eq('user_id', req.user.id)
      .eq('card_id', card_id)
      .select(`
        *,
        cards (
          id, name, image_url, set_number, market_price, rarity
        )
      `)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Wishlist item not found' })
      }
      throw error
    }
    
    // Log wishlist activity
    await logWishlistActivity(req.user.id, 'updated', card_id, updateData)
    
    res.json(data)
  } catch (error) {
    console.error('Error updating wishlist item:', error)
    res.status(500).json({ error: error.message })
  }
})

// Remove card from wishlist
router.delete('/:card_id', authenticateUser, async (req, res) => {
  try {
    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', req.user.id)
      .eq('card_id', req.params.card_id)
    
    if (error) throw error
    
    // Log wishlist activity
    await logWishlistActivity(req.user.id, 'removed', req.params.card_id)
    
    res.json({ message: 'Card removed from wishlist' })
  } catch (error) {
    console.error('Error removing from wishlist:', error)
    res.status(500).json({ error: error.message })
  }
})

// Clear entire wishlist
router.delete('/', authenticateUser, async (req, res) => {
  try {
    const { data: items } = await supabase
      .from('wishlists')
      .select('card_id')
      .eq('user_id', req.user.id)
    
    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', req.user.id)
    
    if (error) throw error
    
    // Log wishlist activity
    await logWishlistActivity(req.user.id, 'cleared', null, {
      items_count: items?.length || 0
    })
    
    res.json({ 
      message: 'Wishlist cleared',
      removed_count: items?.length || 0
    })
  } catch (error) {
    console.error('Error clearing wishlist:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get price alerts (cards below max price)
router.get('/alerts', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('wishlists')
      .select(`
        *,
        cards (
          id,
          name,
          image_url,
          set_number,
          market_price,
          rarity
        )
      `)
      .eq('user_id', req.user.id)
      .not('max_price', 'is', null)
    
    if (error) throw error
    
    // Filter cards where current market price is below max price
    const alerts = data.filter(item => 
      item.cards.market_price && 
      parseFloat(item.cards.market_price) <= parseFloat(item.max_price)
    )
    
    res.json(alerts)
  } catch (error) {
    console.error('Error fetching price alerts:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get wishlist statistics
router.get('/stats', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('wishlists')
      .select(`
        max_price,
        cards (market_price, rarity)
      `)
      .eq('user_id', req.user.id)
    
    if (error) throw error
    
    const stats = {
      totalItems: data.length,
      totalValue: data.reduce((sum, item) => sum + (parseFloat(item.cards.market_price) || 0), 0).toFixed(2),
      averagePrice: data.length > 0 ? (data.reduce((sum, item) => sum + (parseFloat(item.cards.market_price) || 0), 0) / data.length).toFixed(2) : '0.00',
      priceAlertsSet: data.filter(item => item.max_price).length,
      rarityBreakdown: {
        common: data.filter(item => item.cards.rarity === 'common').length,
        uncommon: data.filter(item => item.cards.rarity === 'uncommon').length,
        rare: data.filter(item => item.cards.rarity === 'rare').length,
        mythic: data.filter(item => item.cards.rarity === 'mythic').length
      }
    }
    
    res.json(stats)
  } catch (error) {
    console.error('Error fetching wishlist stats:', error)
    res.status(500).json({ error: error.message })
  }
})

// Export wishlist
router.get('/export', authenticateUser, async (req, res) => {
  try {
    const { format = 'json' } = req.query
    
    const { data, error } = await supabase
      .from('wishlists')
      .select(`
        *,
        cards (
          name,
          set_number,
          card_number,
          rarity,
          type_line,
          mana_cost,
          market_price
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    if (format === 'csv') {
      const csv = convertWishlistToCSV(data)
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename="wishlist.csv"')
      res.send(csv)
    } else {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', 'attachment; filename="wishlist.json"')
      res.json({
        exported_at: new Date().toISOString(),
        user_id: req.user.id,
        total_items: data.length,
        wishlist: data
      })
    }
  } catch (error) {
    console.error('Error exporting wishlist:', error)
    res.status(500).json({ error: error.message })
  }
})

// Import wishlist from file
router.post('/import', authenticateUser, async (req, res) => {
  try {
    const { wishlist_data, replace_existing = false } = req.body
    
    if (!Array.isArray(wishlist_data)) {
      return res.status(400).json({ error: 'wishlist_data must be an array' })
    }
    
    // Clear existing wishlist if replace_existing is true
    if (replace_existing) {
      await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', req.user.id)
    }
    
    const results = {
      imported: 0,
      skipped: 0,
      errors: []
    }
    
    for (const item of wishlist_data) {
      try {
        // Find card by name and set
        const { data: card } = await supabase
          .from('cards')
          .select('id')
          .eq('name', item.card_name)
          .eq('set_number', item.set_number || item.set)
          .single()
        
        if (!card) {
          results.errors.push(`Card not found: ${item.card_name}`)
          continue
        }
        
        // Check if already exists (unless replacing)
        if (!replace_existing) {
          const { data: existing } = await supabase
            .from('wishlists')
            .select('id')
            .eq('user_id', req.user.id)
            .eq('card_id', card.id)
            .single()
          
          if (existing) {
            results.skipped++
            continue
          }
        }
        
        // Insert wishlist item
        await supabase
          .from('wishlists')
          .insert({
            user_id: req.user.id,
            card_id: card.id,
            max_price: item.max_price || null,
            condition_preference: item.condition_preference || null
          })
        
        results.imported++
      } catch (error) {
        results.errors.push(`Error importing ${item.card_name}: ${error.message}`)
      }
    }
    
    res.json(results)
  } catch (error) {
    console.error('Error importing wishlist:', error)
    res.status(500).json({ error: error.message })
  }
})

// Share wishlist (create shareable link)
router.post('/share', authenticateUser, async (req, res) => {
  try {
    const { include_price_alerts = false, expires_in_days = 30 } = req.body
    
    const { data: wishlistItems, error } = await supabase
      .from('wishlists')
      .select(`
        card_id,
        ${include_price_alerts ? 'max_price,' : ''}
        cards (
          name,
          set_number,
          image_url,
          market_price,
          rarity
        )
      `)
      .eq('user_id', req.user.id)
    
    if (error) throw error
    
    // Create shared wishlist record
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expires_in_days)
    
    const { data: sharedList, error: shareError } = await supabase
      .from('shared_wishlists')
      .insert({
        user_id: req.user.id,
        wishlist_data: wishlistItems,
        include_price_alerts,
        expires_at: expiresAt.toISOString(),
        view_count: 0
      })
      .select('id')
      .single()
    
    if (shareError) throw shareError
    
    const shareUrl = `${process.env.FRONTEND_URL}/wishlist/shared/${sharedList.id}`
    
    res.json({
      share_id: sharedList.id,
      share_url: shareUrl,
      expires_at: expiresAt.toISOString(),
      item_count: wishlistItems.length
    })
  } catch (error) {
    console.error('Error sharing wishlist:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get shared wishlist (public endpoint)
router.get('/shared/:share_id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('shared_wishlists')
      .select(`
        *,
        profiles:user_id (display_name)
      `)
      .eq('id', req.params.share_id)
      .single()
    
    if (error) {
      return res.status(404).json({ error: 'Shared wishlist not found' })
    }
    
    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Shared wishlist has expired' })
    }
    
    // Increment view count
    await supabase
      .from('shared_wishlists')
      .update({ view_count: data.view_count + 1 })
      .eq('id', req.params.share_id)
    
    res.json({
      id: data.id,
      owner_name: data.profiles?.display_name || 'Anonymous',
      created_at: data.created_at,
      item_count: data.wishlist_data.length,
      total_value: data.wishlist_data.reduce((sum, item) => sum + (parseFloat(item.cards.market_price) || 0), 0).toFixed(2),
      include_price_alerts: data.include_price_alerts,
      wishlist: data.wishlist_data,
      view_count: data.view_count + 1
    })
  } catch (error) {
    console.error('Error fetching shared wishlist:', error)
    res.status(500).json({ error: error.message })
  }
})

// ===== HELPER FUNCTIONS =====

// Log wishlist activity for analytics
const logWishlistActivity = async (userId, action, cardId, metadata = {}) => {
  try {
    await supabase
      .from('wishlist_activity_log')
      .insert({
        user_id: userId,
        action,
        card_id: cardId,
        metadata,
        timestamp: new Date().toISOString()
      })
  } catch (error) {
    console.error('Failed to log wishlist activity:', error)
  }
}

// Convert wishlist to CSV format
const convertWishlistToCSV = (wishlistData) => {
  const headers = [
    'Card Name',
    'Set',
    'Set Number',
    'Rarity',
    'Type',
    'Mana Cost',
    'Market Price',
    'Max Price Alert',
    'Condition Preference',
    'Added Date'
  ]
  
  const rows = wishlistData.map(item => [
    item.cards.name,
    item.cards.set_number,
    item.cards.card_number || '',
    item.cards.rarity,
    item.cards.type_line || '',
    item.cards.mana_cost || '',
    item.cards.market_price || '0.00',
    item.max_price || '',
    item.condition_preference || '',
    new Date(item.created_at).toLocaleDateString()
  ])
  
  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  
  return csvContent
}

export default router
