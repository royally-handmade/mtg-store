// backend/routes/search.js - Fixed Supabase syntax for enhanced search routes
import express from 'express'
import { supabase } from '../server.js'
import { authenticateUser } from '../middleware/auth.js'

const router = express.Router()

// Global search endpoint - works with your existing database structure
router.get('/', async (req, res) => {
  try {
    const {
      q = '',
      type = 'all', // all, cards, listings, sellers
      page = 1,
      limit = 20,
      sort = 'relevance',
      min_price,
      max_price,
      condition,
      set,
      rarity,
      foil,
      signed,
      altered,
      seller_id,
      language = 'English',
      availability = 'in_stock'
    } = req.query

    const offset = (page - 1) * limit
    const results = {}

    // Search cards if requested
    if (type === 'all' || type === 'cards') {
      let cardsQuery = supabase
        .from('cards')
        .select(`
          *,
          listings(
            id,
            price,
            condition,
            quantity,
            seller_id,
            status,
            foil,
            signed,
            altered,
            language,
            created_at,
            profiles!seller_id(display_name, rating)
          )
        `, { count: 'exact' })

      // Apply card name/text filters
      if (q) {
        cardsQuery = cardsQuery.or(`name.ilike.%${q}%,type_line.ilike.%${q}%`)
      }
      if (set) cardsQuery = cardsQuery.eq('set_number', set)
      if (rarity) cardsQuery = cardsQuery.eq('rarity', rarity)

      // Only get cards that have active listings
      cardsQuery = cardsQuery.eq('listings.status', 'active')

      // Apply listing filters using proper syntax
      if (min_price) cardsQuery = cardsQuery.gte('listings.price', parseFloat(min_price))
      if (max_price) cardsQuery = cardsQuery.lte('listings.price', parseFloat(max_price))
      if (condition) cardsQuery = cardsQuery.eq('listings.condition', condition)
      if (foil !== undefined) cardsQuery = cardsQuery.eq('listings.foil', foil === 'true')
      if (signed !== undefined) cardsQuery = cardsQuery.eq('listings.signed', signed === 'true')
      if (altered !== undefined) cardsQuery = cardsQuery.eq('listings.altered', altered === 'true')
      if (seller_id) cardsQuery = cardsQuery.eq('listings.seller_id', seller_id)
      if (language) cardsQuery = cardsQuery.eq('listings.language', language)
      if (availability === 'in_stock') cardsQuery = cardsQuery.gt('listings.quantity', 0)

      // Apply sorting (note: complex sorting with foreign tables is limited)
      switch (sort) {
        case 'name_asc':
          cardsQuery = cardsQuery.order('name', { ascending: true })
          break
        case 'name_desc':
          cardsQuery = cardsQuery.order('name', { ascending: false })
          break
        default: // relevance, price sorts handled after grouping
          cardsQuery = cardsQuery.order('name', { ascending: true })
      }

      const { data: cards, error: cardsError, count: cardsCount } = await cardsQuery
        .range(offset, offset + limit - 1)

      if (cardsError) throw cardsError

      // Process cards to group listings by card
      const processedCards = cards?.reduce((acc, card) => {
        const existingCardIndex = acc.findIndex(c => c.id === card.id)
        
        if (existingCardIndex >= 0) {
          // Add listings to existing card
          if (card.listings && card.listings.length > 0) {
            acc[existingCardIndex].listings.push(...card.listings)
          }
        } else {
          // Add new card
          acc.push({
            id: card.id,
            name: card.name,
            set_name: card.set_name,
            set_number: card.set_number,
            rarity: card.rarity,
            type_line: card.type_line,
            market_price: card.market_price,
            image_url: card.image_url,
            created_at: card.created_at,
            listings: card.listings || []
          })
        }
        return acc
      }, []) || []

      // Add computed properties and apply post-processing sorts
      const finalCards = processedCards.map(card => ({
        ...card,
        lowest_price: card.listings?.length > 0 ? Math.min(...card.listings.map(l => l.price)) : null,
        listing_count: card.listings?.length || 0
      }))

      // Apply sorts that require post-processing
      if (sort === 'price_low') {
        finalCards.sort((a, b) => (a.lowest_price || 999999) - (b.lowest_price || 999999))
      } else if (sort === 'price_high') {
        finalCards.sort((a, b) => (b.lowest_price || 0) - (a.lowest_price || 0))
      }

      results.cards = {
        data: finalCards,
        count: cardsCount || 0,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: cardsCount || 0,
          totalPages: Math.ceil((cardsCount || 0) / limit)
        }
      }
    }

    // Search individual listings if requested
    if (type === 'all' || type === 'listings') {
      let listingsQuery = supabase
        .from('listings')
        .select(`
          *,
          cards(name, image_url, set_number, rarity, type_line, market_price),
          profiles!seller_id(display_name, rating, seller_tier)
        `, { count: 'exact' })
        .eq('status', 'active')

      // Apply filters
      if (q) {
        // Use inner join to filter based on card name/type
        listingsQuery = listingsQuery
          .select(`
            *,
            cards!inner(name, image_url, set_number, rarity, type_line, market_price),
            profiles!seller_id(display_name, rating, seller_tier)
          `)
          .or(`cards.name.ilike.%${q}%,cards.type_line.ilike.%${q}%`)
      }

      if (min_price) listingsQuery = listingsQuery.gte('price', parseFloat(min_price))
      if (max_price) listingsQuery = listingsQuery.lte('price', parseFloat(max_price))
      if (condition) listingsQuery = listingsQuery.eq('condition', condition)
      if (set) listingsQuery = listingsQuery.eq('cards.set_number', set)
      if (rarity) listingsQuery = listingsQuery.eq('cards.rarity', rarity)
      if (foil !== undefined) listingsQuery = listingsQuery.eq('foil', foil === 'true')
      if (signed !== undefined) listingsQuery = listingsQuery.eq('signed', signed === 'true')
      if (altered !== undefined) listingsQuery = listingsQuery.eq('altered', altered === 'true')
      if (seller_id) listingsQuery = listingsQuery.eq('seller_id', seller_id)
      if (language) listingsQuery = listingsQuery.eq('language', language)
      if (availability === 'in_stock') listingsQuery = listingsQuery.gt('quantity', 0)

      // Apply sorting
      switch (sort) {
        case 'price_low':
          listingsQuery = listingsQuery.order('price', { ascending: true })
          break
        case 'price_high':
          listingsQuery = listingsQuery.order('price', { ascending: false })
          break
        case 'newest':
          listingsQuery = listingsQuery.order('created_at', { ascending: false })
          break
        case 'oldest':
          listingsQuery = listingsQuery.order('created_at', { ascending: true })
          break
        default: // relevance, name sorts
          listingsQuery = listingsQuery.order('price', { ascending: true })
      }

      const { data: listings, error: listingsError, count: listingsCount } = await listingsQuery
        .range(offset, offset + limit - 1)

      if (listingsError) throw listingsError

      results.listings = {
        data: listings || [],
        count: listingsCount || 0,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: listingsCount || 0,
          totalPages: Math.ceil((listingsCount || 0) / limit)
        }
      }
    }

    // Search sellers if requested
    if (type === 'all' || type === 'sellers') {
      let sellersQuery = supabase
        .from('profiles')
        .select(`
          id,
          display_name,
          rating,
          seller_tier,
          location,
          created_at
        `, { count: 'exact' })
        .eq('role', 'seller')
        .eq('approved', true)

      if (q) {
        sellersQuery = sellersQuery.ilike('display_name', `%${q}%`)
      }

      sellersQuery = sellersQuery.order('rating', { ascending: false, nullsLast: true })

      const { data: sellers, error: sellersError, count: sellersCount } = await sellersQuery
        .range(offset, offset + limit - 1)

      if (sellersError) throw sellersError

      // Get listing counts for each seller
      const sellersWithCounts = await Promise.all((sellers || []).map(async (seller) => {
        const { count: listingCount } = await supabase
          .from('listings')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', seller.id)
          .eq('status', 'active')

        return {
          ...seller,
          _count_listings: listingCount || 0
        }
      }))

      results.sellers = {
        data: sellersWithCounts,
        count: sellersCount || 0,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: sellersCount || 0,
          totalPages: Math.ceil((sellersCount || 0) / limit)
        }
      }
    }

    res.json(results)
  } catch (error) {
    console.error('Search error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Search suggestions/autocomplete
router.get('/suggestions', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query

    if (!q || q.length < 2) {
      return res.json([])
    }

    const suggestions = []

    // Get card suggestions
    const { data: cards } = await supabase
      .from('cards')
      .select('id, name, image_url, set_number, rarity, type_line')
      .ilike('name', `${q}%`)
      .order('name')
      .limit(Math.floor(limit * 0.6))

    // Get set suggestions  
    const { data: sets } = await supabase
      .from('cards')
      .select('set_name, set_number')
      .or(`set_name.ilike.%${q}%,set_number.ilike.%${q}%`)
      .limit(Math.floor(limit * 0.3))

    // Add card suggestions
    if (cards) {
      cards.forEach(card => {
        suggestions.push({
          type: 'card',
          value: card.name,
          display: card.name,
          image: card.image_url,
          set: card.set_number,
          id: card.id,
          rarity: card.rarity,
          type_line: card.type_line
        })
      })
    }

    // Add unique set suggestions
    if (sets) {
      const uniqueSets = sets.reduce((acc, set) => {
        if (!acc.find(s => s.set_number === set.set_number)) {
          acc.push(set)
        }
        return acc
      }, [])

      uniqueSets.slice(0, Math.floor(limit * 0.3)).forEach(set => {
        suggestions.push({
          type: 'set',
          value: set.set_number,
          display: `${set.set_name} (${set.set_number})`
        })
      })
    }

    res.json(suggestions.slice(0, limit))
  } catch (error) {
    console.error('Suggestions error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Save search (for authenticated users) - requires saved_searches table
router.post('/save', authenticateUser, async (req, res) => {
  try {
    const { name, query_params, alert_enabled = false } = req.body

    if (!name || !query_params) {
      return res.status(400).json({ error: 'Name and query parameters are required' })
    }

    // Check if saved_searches table exists
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'saved_searches')

    if (tableError || !tables || tables.length === 0) {
      return res.status(501).json({ error: 'Saved searches feature not available. Please run the database migration first.' })
    }

    const { data, error } = await supabase
      .from('saved_searches')
      .insert({
        user_id: req.user.id,
        name,
        query_params,
        alert_enabled,
        created_at: new Date()
      })
      .select()
      .single()

    if (error) throw error

    res.json({
      message: 'Search saved successfully',
      search: data
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get saved searches
router.get('/saved', authenticateUser, async (req, res) => {
  try {
    // Check if saved_searches table exists
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'saved_searches')

    if (tableError || !tables || tables.length === 0) {
      return res.json([]) // Return empty array if table doesn't exist
    }

    const { data, error } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data || [])
  } catch (error) {
    console.error('Get saved searches error:', error)
    res.json([]) // Return empty array on error
  }
})

// Update saved search
router.patch('/saved/:id', authenticateUser, async (req, res) => {
  try {
    const { name, query_params, alert_enabled } = req.body
    const updateData = { updated_at: new Date() }
    
    if (name !== undefined) updateData.name = name
    if (query_params !== undefined) updateData.query_params = query_params
    if (alert_enabled !== undefined) updateData.alert_enabled = alert_enabled

    const { data, error } = await supabase
      .from('saved_searches')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single()

    if (error) throw error

    if (!data) {
      return res.status(404).json({ error: 'Saved search not found' })
    }

    res.json({
      message: 'Saved search updated successfully',
      search: data
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete saved search
router.delete('/saved/:id', authenticateUser, async (req, res) => {
  try {
    const { error } = await supabase
      .from('saved_searches')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)

    if (error) throw error

    res.json({ message: 'Saved search deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get search filters/facets for a given query
router.get('/facets', async (req, res) => {
  try {
    const { q = '' } = req.query

    // Get basic facet data from active listings
    let listingsQuery = supabase
      .from('listings')
      .select(`
        condition,
        language,
        price,
        cards!inner(rarity, set_number, set_name),
        profiles!seller_id(seller_tier)
      `)
      .eq('status', 'active')

    if (q) {
      listingsQuery = listingsQuery.or(`cards.name.ilike.%${q}%,cards.type_line.ilike.%${q}%`)
    }

    const { data: listings } = await listingsQuery.limit(1000) // Limit for performance

    if (!listings || listings.length === 0) {
      return res.json({
        conditions: [],
        rarities: [],
        sets: [],
        languages: [],
        seller_tiers: [],
        price_range: { min_price: 0, max_price: 100 }
      })
    }

    // Process facets
    const conditionCounts = {}
    const rarityCounts = {}
    const setCounts = {}
    const languageCounts = {}
    const tierCounts = {}
    let minPrice = Math.min(...listings.map(l => l.price))
    let maxPrice = Math.max(...listings.map(l => l.price))

    listings.forEach(listing => {
      // Conditions
      if (listing.condition) {
        conditionCounts[listing.condition] = (conditionCounts[listing.condition] || 0) + 1
      }

      // Rarities
      if (listing.cards?.rarity) {
        const rarity = listing.cards.rarity
        rarityCounts[rarity] = (rarityCounts[rarity] || 0) + 1
      }

      // Sets
      if (listing.cards?.set_number && listing.cards?.set_name) {
        const setKey = `${listing.cards.set_number}|${listing.cards.set_name}`
        setCounts[setKey] = (setCounts[setKey] || 0) + 1
      }

      // Languages
      if (listing.language) {
        languageCounts[listing.language] = (languageCounts[listing.language] || 0) + 1
      }

      // Seller tiers
      if (listing.profiles?.seller_tier) {
        const tier = listing.profiles.seller_tier
        tierCounts[tier] = (tierCounts[tier] || 0) + 1
      }
    })

    res.json({
      conditions: Object.entries(conditionCounts).map(([condition, count]) => ({
        condition,
        count
      })),
      rarities: Object.entries(rarityCounts).map(([rarity, count]) => ({
        rarity,
        count
      })),
      sets: Object.entries(setCounts)
        .map(([setKey, count]) => {
          const [set_number, set_name] = setKey.split('|')
          return { set_number, set_name, count }
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
      languages: Object.entries(languageCounts).map(([language, count]) => ({
        language,
        count
      })),
      seller_tiers: Object.entries(tierCounts).map(([tier, count]) => ({
        seller_tier: tier,
        count
      })),
      price_range: {
        min_price: Math.floor(minPrice) || 0,
        max_price: Math.ceil(maxPrice) || 100
      }
    })
  } catch (error) {
    console.error('Facets error:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router