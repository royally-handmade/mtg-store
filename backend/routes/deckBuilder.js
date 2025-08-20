import express from 'express'
import { supabase } from '../server.js'

const router = express.Router()

// Process decklist text
router.post('/process', async (req, res) => {
  try {
    const { decklist } = req.body
    const processedCards = await processDecklistText(decklist)
    res.json(processedCards)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Optimize prices for deck
router.post('/optimize', async (req, res) => {
  try {
    const { cards } = req.body
    const optimizedCards = await optimizeDeckPrices(cards)
    res.json(optimizedCards)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

async function processDecklistText(decklistText) {
  const lines = decklistText.split('\n').filter(line => line.trim())
  const processedCards = []
  
  for (const line of lines) {
    const match = line.match(/^(\d+)\s+(.+)$/)
    if (match) {
      const quantity = parseInt(match[1])
      const cardName = match[2].trim()
      
      // Find card in database
      const { data: cards } = await supabase
        .from('cards')
        .select('*')
        .ilike('name', cardName)
        .limit(1)
      
      if (cards && cards.length > 0) {
        const card = cards[0]
        
        // Get available listings
        const { data: listings } = await supabase
          .from('listings')
          .select(`
            *,
            profiles:seller_id (display_name, rating)
          `)
          .eq('card_id', card.id)
          .eq('status', 'active')
          .gte('quantity', quantity)
          .order('price', { ascending: true })
        
        if (listings && listings.length > 0) {
          processedCards.push({
            ...card,
            quantity,
            availableListings: listings.map(listing => ({
              ...listing,
              seller_name: listing.profiles.display_name
            })),
            selectedListing: listings[0], // Default to cheapest
            selectedPrice: listings[0].price,
            selectedCondition: listings[0].condition
          })
        }
      }
    }
  }
  
  return processedCards
}

async function optimizeDeckPrices(cards) {
  // Group by seller to minimize shipping costs
  const sellerGroups = {}
  
  for (const card of cards) {
    for (const listing of card.availableListings) {
      const sellerId = listing.seller_id
      if (!sellerGroups[sellerId]) {
        sellerGroups[sellerId] = []
      }
      sellerGroups[sellerId].push({ card, listing })
    }
  }
  
  // Find optimal combination
  // This is a simplified version - could implement more sophisticated algorithms
  const optimizedCards = cards.map(card => ({
    ...card,
    selectedListing: card.availableListings[0] // For now, just select cheapest
  }))
  
  return optimizedCards
}

export default router