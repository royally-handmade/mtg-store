import express from 'express'
import { supabase } from '../server.js'
import { authenticateUser, authenticateAdmin } from '../middleware/auth.js'
import axios from 'axios'

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
    console.log(data)

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

export default router