import express from 'express'
import { supabase } from '../server.js'
import { authenticateUser, authenticateAdmin } from '../middleware/auth.js'
import { marketPriceService } from '../services/marketPriceService.js'

const router = express.Router()

// Get all cards with optional filters
router.get('/', async (req, res) => {
  try {
    var { set, rarity, search, page = 1, limit } = req.query

    if (!limit) {
      limit = 20
    }

    let query = supabase
      .from('cards')
      .select('*')
      .limit(limit)


    if (set) query = query.eq('set_number', set)
    if (rarity) query = query.eq('rarity', rarity)
    if (search) query = query.ilike('name', `%${search}%`)


    const { data, error } = await query
    if (error) throw error

    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get card by ID with listings
router.get('/:id', async (req, res) => {
  try {
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (cardError) throw cardError

    res.json(card)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get listings for a card
router.get('/:id/listings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('listings')
      .select(`
        *,
        profiles (id, display_name)
      `)
      .eq('card_id', req.params.id)
      .eq('status', 'active')
      .order('price', { ascending: true })

    if (error) throw error

    const listings = data.map(listing => ({
      ...listing,
      seller_name: listing.profiles.display_name,
      seller_rating: listing.profiles.rating
    }))

    res.json(listings)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get price history for a card
router.get('/:id/price-history', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('card_id', req.params.id)
      .order('date', { ascending: true })

    if (error) throw error
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get external price comparison
router.get('/:id/external-prices', async (req, res) => {
  try {
    const { data: card } = await supabase
      .from('cards')
      .select('name, set_number')
      .eq('id', req.params.id)
      .single()

    // Fetch prices from external sources
    const externalPrices = await fetchExternalPrices(card.name, card.set_number)
    res.json(externalPrices)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

async function fetchExternalPrices(cardName, setNumber) {
  try {
    // This would integrate with actual APIs
    // For now, returning mock data
    return {
      scryfall: Math.random() * 50,
      tcgplayer: Math.random() * 50,
      cardkingdom: Math.random() * 50,
      cardmarket: Math.random() * 50
    }
  } catch (error) {
    console.error('Error fetching external prices:', error)
    return {}
  }
}

// Get recent sales
router.get('/recent-sales', async (req, res) => {
  try {
    const { limit = 10 } = req.query

    const { data, error } = await supabase
      .from('order_items')
      .select(`
        price,
        quantity,
        created_at,
        orders!inner(status, created_at),
        listings!inner(
          condition,
          cards!inner(name, image_url, set_number)
        )
      `)
      .eq('orders.status', 'completed')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    const formattedSales = data.map(item => ({
      id: item.id,
      card_name: item.listings.cards.name,
      card_image: item.listings.cards.image_url,
      set_name: item.listings.cards.set_number,
      condition: item.listings.condition,
      price: item.price,
      quantity: item.quantity,
      sold_at: item.orders.created_at
    }))

    res.json(formattedSales)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get platform stats
router.get('/stats', async (req, res) => {
  try {
    const [cardsRes, sellersRes, salesRes] = await Promise.all([
      supabase.from('cards').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'seller').eq('approved', true),
      supabase.from('orders').select('total_amount').eq('status', 'completed')
    ])

    const totalValue = salesRes.data?.reduce((sum, order) => sum + order.total_amount, 0) || 0

    res.json({
      totalCards: cardsRes.count || 0,
      totalSellers: sellersRes.count || 0,
      totalSales: salesRes.data?.length || 0,
      totalValue: totalValue.toLocaleString()
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/search', async (req, res) => {
  try {
    const { q: query } = req.query;

    // Validate query parameter
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Query parameter "q" is required and must be a string',
        cards: []
      });
    }

    // Minimum query length check
    if (query.trim().length < 2) {
      return res.status(400).json({
        error: 'Query must be at least 2 characters long',
        cards: []
      });
    }

    // Search cards in Supabase
    // Adjust the table name and columns based on your actual database schema
    const { data: cards, error } = await supabase
      .from('cards') // Replace with your actual table name
      .select(`
        id,
        name,
        set_number,
        card_number,
        mana_cost,
        rarity,
        treatment,
        image_url,
        type_line,
        market_price,
        created_at
      `)
      .or(`name.ilike.%${query}%,set_name.ilike.%${query}%,type.ilike.%${query}%`)
      .order('name', { ascending: true })
      .limit(10); // Limit results for performance

    if (error) {
      console.error('Supabase search error:', error);
      return res.status(500).json({
        error: 'Database search failed',
        cards: []
      });
    }

    // Return results
    res.json({
      cards: cards || [],
      query: query,
      count: cards?.length || 0
    });

  } catch (error) {
    console.error('Search endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      cards: []
    });
  }
});

router.get('/recent-sales', async (req, res) => {
  try {
    const { limit = 10 } = req.query

    const { data, error } = await supabase
      .from('order_items')
      .select(`
        price,
        quantity,
        created_at,
        orders!inner(status, created_at),
        listings!inner(
          condition,
          cards!inner(id, name, image_url, set_number, market_price)
        )
      `)
      .eq('orders.status', 'completed')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    const formattedSales = data.map(item => ({
      id: item.id,
      card_id: item.listings.cards.id,
      card_name: item.listings.cards.name,
      card_image: item.listings.cards.image_url,
      set_name: item.listings.cards.set_number,
      condition: item.listings.condition,
      price: item.price,
      quantity: item.quantity,
      market_price: item.listings.cards.market_price,
      sold_at: item.orders.created_at
    }))

    res.json(formattedSales)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get cards with wishlist status for authenticated user
router.get('/with-wishlist-status', authenticateUser, async (req, res) => {
  try {
    const { page = 1, limit = 20, ...filters } = req.query
    const offset = (page - 1) * limit

    // Get cards with filters
    let query = supabase
      .from('cards')
      .select('*')
      .range(offset, offset + limit - 1)

    // Apply filters
    if (filters.set) query = query.eq('set_number', filters.set)
    if (filters.rarity) query = query.eq('rarity', filters.rarity)
    if (filters.search) query = query.ilike('name', `%${filters.search}%`)

    const { data: cards, error } = await query
    if (error) throw error

    // Get wishlist status for these cards
    const cardIds = cards.map(card => card.id)
    const { data: wishlistItems } = await supabase
      .from('wishlists')
      .select('card_id, max_price')
      .eq('user_id', req.user.id)
      .in('card_id', cardIds)

    // Merge wishlist status with cards
    const cardsWithWishlistStatus = cards.map(card => {
      const wishlistItem = wishlistItems?.find(item => item.card_id === card.id)
      return {
        ...card,
        in_wishlist: !!wishlistItem,
        wishlist_max_price: wishlistItem?.max_price || null
      }
    })

    res.json(cardsWithWishlistStatus)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/:id/external-prices', async (req, res) => {
  try {
    const cardId = req.params.id

    // Get card with Scryfall data
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, name, scryfall_id, prices, tcgplayer_id, cardmarket_id')
      .eq('id', cardId)
      .single()

    if (cardError) throw cardError

    // Get stored external prices
    const { data: externalPricesData, error: pricesError } = await supabase
      .from('external_price_sources')
      .select('source, price_usd, price_usd_foil, price_eur, last_updated')
      .eq('card_id', cardId)

    if (pricesError) throw pricesError

    // Format response
    const externalPrices = {}

    // Add Scryfall prices from card data
    if (card.prices) {
      if (card.prices.usd) externalPrices.scryfall = parseFloat(card.prices.usd)
      if (card.prices.usd_foil) externalPrices.scryfall_foil = parseFloat(card.prices.usd_foil)
      if (card.prices.eur) externalPrices.cardmarket_scryfall = parseFloat(card.prices.eur)
      if (card.prices.tix) externalPrices.mtgo = parseFloat(card.prices.tix)
    }

    // Add external source prices
    externalPricesData?.forEach(priceData => {
      if (priceData.price_usd) {
        externalPrices[priceData.source] = priceData.price_usd
      }
      if (priceData.price_usd_foil && priceData.source !== 'cardmarket') {
        externalPrices[`${priceData.source}_foil`] = priceData.price_usd_foil
      }
      if (priceData.price_eur && priceData.source === 'cardmarket') {
        externalPrices.cardmarket = priceData.price_eur
      }
    })

    // Calculate price comparison metrics
    const prices = Object.values(externalPrices).filter(p => p > 0)
    const priceStats = prices.length > 0 ? {
      lowest: Math.min(...prices),
      highest: Math.max(...prices),
      average: prices.reduce((sum, price) => sum + price, 0) / prices.length,
      spread: Math.max(...prices) - Math.min(...prices)
    } : null

    res.json({
      card_id: cardId,
      card_name: card.name,
      prices: externalPrices,
      price_stats: priceStats,
      last_updated: externalPricesData?.reduce((latest, current) => {
        return new Date(current.last_updated) > new Date(latest) ? current.last_updated : latest
      }, '1970-01-01') || null
    })

  } catch (error) {
    console.error('Error fetching external prices:', error)
    res.status(500).json({ error: error.message })
  }
})

// Update external prices for a card (admin only)
router.post('/:id/update-external-prices', authenticateAdmin, async (req, res) => {
  try {
    const cardId = req.params.id
    const { source, price_usd, price_usd_foil, price_eur } = req.body

    if (!source || (!price_usd && !price_usd_foil && !price_eur)) {
      return res.status(400).json({ error: 'Source and at least one price required' })
    }

    // Validate source
    const validSources = ['tcgplayer', 'cardkingdom', 'cardmarket', 'mtgstocks']
    if (!validSources.includes(source)) {
      return res.status(400).json({ error: 'Invalid price source' })
    }

    // Upsert external price
    const { data, error } = await supabase
      .from('external_price_sources')
      .upsert({
        card_id: parseInt(cardId),
        source: source,
        price_usd: price_usd ? parseFloat(price_usd) : null,
        price_usd_foil: price_usd_foil ? parseFloat(price_usd_foil) : null,
        price_eur: price_eur ? parseFloat(price_eur) : null,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'card_id,source'
      })

    if (error) throw error

    res.json({
      message: 'External price updated successfully',
      data: data
    })

  } catch (error) {
    console.error('Error updating external price:', error)
    res.status(500).json({ error: error.message })
  }
})

// Bulk update external prices from Scryfall (admin only)
router.post('/bulk-update-scryfall-prices', authenticateAdmin, async (req, res) => {
  try {
    const { card_ids, batch_size = 50 } = req.body

    if (!card_ids || !Array.isArray(card_ids)) {
      return res.status(400).json({ error: 'card_ids array is required' })
    }

    let updated = 0
    let errors = 0

    // Process in batches to avoid rate limits
    for (let i = 0; i < card_ids.length; i += batch_size) {
      const batch = card_ids.slice(i, i + batch_size)

      for (const cardId of batch) {
        try {
          // Get card with Scryfall ID
          const { data: card } = await supabase
            .from('cards')
            .select('scryfall_id, name')
            .eq('id', cardId)
            .single()

          if (!card?.scryfall_id) {
            errors++
            continue
          }

          // Get updated data from Scryfall
          const scryfallData = await scryfallService.getCardById(card.scryfall_id)
          if (!scryfallData.success) {
            errors++
            continue
          }

          // Update card with new price data
          const { error: updateError } = await supabase
            .from('cards')
            .update({
              prices: {
                usd: scryfallData.data.prices?.usd || null,
                usd_foil: scryfallData.data.prices?.usd_foil || null,
                eur: scryfallData.data.prices?.eur || null,
                tix: scryfallData.data.prices?.tix || null
              },
              scryfall_updated_at: new Date().toISOString()
            })
            .eq('id', cardId)

          if (updateError) {
            console.error(`Error updating card ${cardId}:`, updateError)
            errors++
          } else {
            updated++
          }

          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 50))

        } catch (cardError) {
          console.error(`Error processing card ${cardId}:`, cardError)
          errors++
        }
      }

      // Longer delay between batches
      if (i + batch_size < card_ids.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    res.json({
      message: 'Bulk price update completed',
      updated: updated,
      errors: errors,
      total: card_ids.length
    })

  } catch (error) {
    console.error('Error in bulk price update:', error)
    res.status(500).json({ error: error.message })
  }
})

router.get('/:id/price-suggestions', async (req, res) => {
  try {
    const cardId = req.params.id
    const { condition = 'nm' } = req.query

    // Get card details with updated market price
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select(`
        id, name, market_price, market_price_source, market_price_updated_at,
        prices, last_sales_count
      `)
      .eq('id', cardId)
      .single()

    if (cardError) throw cardError

    // Get current active listings
    const { data: currentListings, error: listingsError } = await supabase
      .from('listings')
      .select('price, condition, quantity, created_at')
      .eq('card_id', cardId)
      .eq('status', 'active')
      .gt('quantity', 0)
      .order('price', { ascending: true })

    if (listingsError) throw listingsError

    // Get recent sales data for context
    const { data: recentSales, error: salesError } = await supabase
      .from('order_items')
      .select(`
        price,
        quantity,
        created_at,
        orders!inner(status, created_at),
        listings!inner(condition)
      `)
      .eq('orders.status', 'completed')
      .eq('listings.cards.id', cardId)
      .gte('orders.created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('orders.created_at', { ascending: false })
      .limit(50)

    if (salesError) throw salesError

    // Get external prices
    const { data: externalPrices, error: extError } = await supabase
      .from('external_price_sources')
      .select('source, price_usd, price_usd_foil, price_eur, last_updated')
      .eq('card_id', cardId)

    // Don't fail if external prices don't exist
    const externalPricesData = extError ? [] : (externalPrices || [])

    // Calculate condition multipliers
    const conditionMultipliers = {
      nm: 1.0,      // Near Mint
      lp: 0.85,     // Lightly Played  
      mp: 0.7,      // Moderately Played
      hp: 0.55,     // Heavily Played
      dmg: 0.4      // Damaged
    }

    const conditionMultiplier = conditionMultipliers[condition] || 1.0

    // Build suggestions array
    const suggestions = []
    let primarySuggestion = null

    // 1. Same condition competitive pricing
    const sameConditionListings = currentListings.filter(l => l.condition === condition)
    if (sameConditionListings.length > 0) {
      const lowestSameCondition = Math.min(...sameConditionListings.map(l => l.price))
      const avgSameCondition = sameConditionListings.reduce((sum, l) => sum + l.price, 0) / sameConditionListings.length

      // Primary suggestion: undercut by small amount
      primarySuggestion = {
        price: Math.max(0.25, lowestSameCondition - 0.25),
        source: 'competitive_undercut',
        label: `Competitive (${condition.toUpperCase()})`,
        reason: `$0.25 below lowest ${condition.toUpperCase()} listing ($${lowestSameCondition.toFixed(2)})`,
        confidence: 'high'
      }

      suggestions.push(
        { ...primarySuggestion },
        {
          price: lowestSameCondition,
          source: 'match_lowest',
          label: 'Match Lowest',
          reason: `Match lowest ${condition.toUpperCase()} listing`,
          confidence: 'high'
        },
        {
          price: avgSameCondition,
          source: 'condition_average',
          label: 'Condition Average',
          reason: `Average of ${sameConditionListings.length} ${condition.toUpperCase()} listings`,
          confidence: 'medium'
        }
      )
    }
    // 2. Adjust from other conditions
    else if (currentListings.length > 0) {
      const lowestListing = Math.min(...currentListings.map(l => l.price))
      const adjustedPrice = lowestListing * conditionMultiplier

      primarySuggestion = {
        price: adjustedPrice,
        source: 'condition_adjusted',
        label: `Condition Adjusted`,
        reason: `Adjusted from lowest listing for ${condition.toUpperCase()} condition`,
        confidence: 'medium'
      }

      suggestions.push({ ...primarySuggestion })
    }

    // 3. Market price with condition adjustment
    if (card.market_price) {
      const marketAdjusted = card.market_price * conditionMultiplier
      suggestions.push({
        price: marketAdjusted,
        source: 'market_price',
        label: 'Market Price',
        reason: `Platform market price adjusted for ${condition.toUpperCase()}`,
        confidence: card.market_price_source === 'sales_average' ? 'high' : 'medium'
      })

      // If no primary suggestion yet, use market price
      if (!primarySuggestion) {
        primarySuggestion = suggestions[suggestions.length - 1]
      }
    }

    // 4. Recent sales average
    if (recentSales.length >= 3) {
      const salesPrices = recentSales.map(s => s.price)
      const avgSalesPrice = salesPrices.reduce((sum, p) => sum + p, 0) / salesPrices.length
      const conditionAdjustedSales = avgSalesPrice * conditionMultiplier

      suggestions.push({
        price: conditionAdjustedSales,
        source: 'recent_sales',
        label: 'Recent Sales',
        reason: `Based on ${recentSales.length} recent sales`,
        confidence: 'high'
      })
    }

    // 5. External price suggestions
    const externalSuggestions = []
    
    // Add Scryfall prices from card data
    if (card.prices) {
      if (card.prices.usd) {
        externalSuggestions.push({
          price: parseFloat(card.prices.usd) * conditionMultiplier,
          source: 'scryfall',
          label: 'Scryfall',
          reason: 'External market data (Scryfall)',
          confidence: 'medium'
        })
      }
    }

    // Add stored external prices
    externalPricesData.forEach(extPrice => {
      if (extPrice.price_usd) {
        externalSuggestions.push({
          price: parseFloat(extPrice.price_usd) * conditionMultiplier,
          source: extPrice.source,
          label: extPrice.source.toUpperCase(),
          reason: `External market data (${extPrice.source})`,
          confidence: 'medium'
        })
      }
    })

    suggestions.push(...externalSuggestions)

    // Remove duplicates and sort by price
    const uniqueSuggestions = suggestions
      .filter((suggestion, index, self) => 
        index === self.findIndex(s => Math.abs(s.price - suggestion.price) < 0.01)
      )
      .sort((a, b) => a.price - b.price)

    // Calculate market statistics
    const marketStats = currentListings.length > 0 ? {
      lowest: Math.min(...currentListings.map(l => l.price)),
      highest: Math.max(...currentListings.map(l => l.price)),
      average: currentListings.reduce((sum, l) => sum + l.price, 0) / currentListings.length,
      count: currentListings.length
    } : null

    // Build response
    const response = {
      card: {
        id: card.id,
        name: card.name,
        market_price: card.market_price,
        market_price_source: card.market_price_source,
        market_price_updated: card.market_price_updated_at,
        last_sales_count: card.last_sales_count
      },
      condition,
      condition_multiplier: conditionMultiplier,
      primary_suggestion: primarySuggestion,
      suggestions: uniqueSuggestions.slice(0, 8), // Limit to 8 suggestions
      market_stats: marketStats,
      recent_sales_count: recentSales.length,
      current_listings_count: currentListings.length,
      same_condition_listings: sameConditionListings.length,
      last_updated: new Date().toISOString()
    }

    res.json(response)

  } catch (error) {
    console.error('Error getting price suggestions:', error)
    res.status(500).json({ error: error.message })
  }
})

// Trigger market price recalculation for a specific card
router.post('/:id/recalculate-price', authenticateUser, async (req, res) => {
  try {
    const cardId = req.params.id

    // Check if user is admin or has listings for this card
    const isAdmin = req.user.role === 'admin'
    
    if (!isAdmin) {
      const { data: userListings } = await supabase
        .from('listings')
        .select('id')
        .eq('card_id', cardId)
        .eq('seller_id', req.user.id)
        .limit(1)

      if (!userListings || userListings.length === 0) {
        return res.status(403).json({ error: 'Not authorized to recalculate price for this card' })
      }
    }

    console.log(`🔄 Manual price recalculation requested for card ${cardId} by user ${req.user.id}`)

    const result = await marketPriceService.calculateMarketPriceForCard(cardId)

    if (result.success) {
      res.json({
        message: 'Market price recalculated successfully',
        card_id: cardId,
        new_price: result.price,
        price_source: result.source,
        sales_used: result.salesUsed
      })
    } else {
      res.status(500).json({
        error: 'Failed to recalculate market price',
        details: result.error
      })
    }

  } catch (error) {
    console.error('Error in manual price recalculation:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get price trend data for charts
router.get('/:id/price-trend', async (req, res) => {
  try {
    const cardId = req.params.id
    const { days = 90 } = req.query

    // Get price history from database
    const { data: priceHistory, error } = await supabase
      .from('price_history')
      .select('date, price, price_source')
      .eq('card_id', cardId)
      .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('date', { ascending: true })

    if (error) throw error

    // If no price history, create some basic data points
    if (!priceHistory || priceHistory.length === 0) {
      const { data: card } = await supabase
        .from('cards')
        .select('market_price, market_price_updated_at')
        .eq('id', cardId)
        .single()

      if (card && card.market_price) {
        // Create a basic trend with current price
        const today = new Date()
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
        
        res.json([
          {
            date: thirtyDaysAgo.toISOString().split('T')[0],
            price: card.market_price,
            price_source: 'estimated'
          },
          {
            date: today.toISOString().split('T')[0],
            price: card.market_price,
            price_source: card.market_price_source || 'current'
          }
        ])
        return
      }

      res.json([])
      return
    }

    // Format dates for frontend consumption
    const formattedHistory = priceHistory.map(entry => ({
      date: entry.date.split('T')[0], // Convert to YYYY-MM-DD
      price: parseFloat(entry.price),
      source: entry.price_source
    }))

    res.json(formattedHistory)

  } catch (error) {
    console.error('Error getting price trend:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get market price comparison with external sources
router.get('/:id/price-comparison', async (req, res) => {
  try {
    const cardId = req.params.id

    // Get card with current market price and Scryfall data
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select(`
        id, name, market_price, market_price_source, 
        prices, scryfall_id, tcgplayer_id, cardmarket_id
      `)
      .eq('id', cardId)
      .single()

    if (cardError) throw cardError

    // Get stored external prices
    const { data: externalPrices, error: extError } = await supabase
      .from('external_price_sources')
      .select('source, price_usd, price_usd_foil, price_eur, last_updated')
      .eq('card_id', cardId)

    // Build comparison data
    const comparison = {
      card: {
        id: card.id,
        name: card.name
      },
      platform_price: {
        price: card.market_price,
        source: card.market_price_source,
        currency: 'CAD'
      },
      external_prices: {},
      price_analysis: {}
    }

    // Add Scryfall prices from card data
    if (card.prices) {
      if (card.prices.usd) {
        comparison.external_prices.scryfall_usd = {
          price: parseFloat(card.prices.usd),
          currency: 'USD',
          source: 'scryfall',
          last_updated: null
        }
      }
      if (card.prices.usd_foil) {
        comparison.external_prices.scryfall_foil = {
          price: parseFloat(card.prices.usd_foil),
          currency: 'USD',
          source: 'scryfall_foil',
          last_updated: null
        }
      }
      if (card.prices.eur) {
        comparison.external_prices.cardmarket = {
          price: parseFloat(card.prices.eur),
          currency: 'EUR',
          source: 'cardmarket',
          last_updated: null
        }
      }
    }

    // Add stored external prices
    if (!extError && externalPrices) {
      externalPrices.forEach(extPrice => {
        if (extPrice.price_usd) {
          comparison.external_prices[extPrice.source] = {
            price: parseFloat(extPrice.price_usd),
            currency: 'USD',
            source: extPrice.source,
            last_updated: extPrice.last_updated
          }
        }
        if (extPrice.price_eur && extPrice.source === 'cardmarket') {
          comparison.external_prices.cardmarket_eur = {
            price: parseFloat(extPrice.price_eur),
            currency: 'EUR',
            source: 'cardmarket',
            last_updated: extPrice.last_updated
          }
        }
      })
    }

    // Calculate price analysis (assuming 1 USD = 1.35 CAD for comparison)
    const USD_TO_CAD = 1.35
    const platformPrice = card.market_price || 0
    const externalPricesCAD = []

    Object.values(comparison.external_prices).forEach(extPrice => {
      if (extPrice.currency === 'USD') {
        externalPricesCAD.push(extPrice.price * USD_TO_CAD)
      } else if (extPrice.currency === 'EUR') {
        // Approximate EUR to CAD conversion
        externalPricesCAD.push(extPrice.price * 1.5)
      } else {
        externalPricesCAD.push(extPrice.price)
      }
    })

    if (externalPricesCAD.length > 0 && platformPrice > 0) {
      const avgExternalPrice = externalPricesCAD.reduce((sum, p) => sum + p, 0) / externalPricesCAD.length
      const minExternalPrice = Math.min(...externalPricesCAD)
      const maxExternalPrice = Math.max(...externalPricesCAD)

      comparison.price_analysis = {
        platform_vs_market: {
          difference_cad: platformPrice - avgExternalPrice,
          percentage_difference: ((platformPrice - avgExternalPrice) / avgExternalPrice * 100).toFixed(1),
          competitive_rating: platformPrice <= avgExternalPrice ? 'competitive' : 
                             platformPrice <= avgExternalPrice * 1.1 ? 'fair' : 'high'
        },
        market_range: {
          min: minExternalPrice,
          max: maxExternalPrice,
          average: avgExternalPrice,
          spread: maxExternalPrice - minExternalPrice
        }
      }
    }

    res.json(comparison)

  } catch (error) {
    console.error('Error getting price comparison:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router