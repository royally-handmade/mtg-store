// routes/scryfall.js
import express from 'express'
import { supabase } from '../server.js'
import { authenticateAdmin } from '../middleware/auth.js'
import scryfallService from '../services/scryfallService.js'
import zlib from 'zlib'

const router = express.Router()

// Import specific card by name and set
router.post('/import-card', authenticateAdmin, async (req, res) => {
  try {
    const { name, set_code } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Card name is required' })
    }

    // Search for the card on Scryfall
    const result = set_code 
      ? await scryfallService.getCardByNameAndSet(name, set_code)
      : await scryfallService.searchCards(`!"${name}"`, { unique: 'cards' })

    if (!result.success || (result.data?.length === 0 && !result.data?.id)) {
      return res.status(404).json({ error: 'Card not found on Scryfall' })
    }

    const scryfallCard = result.data?.id ? result.data : result.data[0]
    const transformedCard = scryfallService.transformCardData(scryfallCard)

    // Check if card already exists
    const { data: existingCard } = await supabase
      .from('cards')
      .select('id, scryfall_id')
      .eq('scryfall_id', transformedCard.scryfall_id)
      .single()

    if (existingCard) {
      // Update existing card
      const { data: updatedCard, error } = await supabase
        .from('cards')
        .update(transformedCard)
        .eq('id', existingCard.id)
        .select()
        .single()

      if (error) throw error

      res.json({
        message: 'Card updated successfully',
        card: updatedCard,
        action: 'updated'
      })
    } else {
      // Insert new card
      const { data: newCard, error } = await supabase
        .from('cards')
        .insert(transformedCard)
        .select()
        .single()

      if (error) throw error

      res.json({
        message: 'Card imported successfully',
        card: newCard,
        action: 'created'
      })
    }

  } catch (error) {
    console.error('Error importing card:', error)
    res.status(500).json({ error: error.message })
  }
})

// Import all cards from a specific set
router.post('/import-set', authenticateAdmin, async (req, res) => {
  try {
    const { set_code } = req.body

    if (!set_code) {
      return res.status(400).json({ error: 'Set code is required' })
    }

    // Verify set exists
    const setResult = await scryfallService.getSet(set_code)
    if (!setResult.success) {
      return res.status(404).json({ error: 'Set not found on Scryfall' })
    }

    const setInfo = setResult.data
    let importedCount = 0
    let updatedCount = 0
    let errorCount = 0
    let hasMore = true
    let page = 1

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked'
    })

    res.write(JSON.stringify({
      type: 'start',
      set: setInfo.name,
      card_count: setInfo.card_count
    }) + '\n')

    while (hasMore) {
      try {
        const cardsResult = await scryfallService.getCardsFromSet(set_code, page)
        if (!cardsResult.success) break

        const batch = []
        for (const scryfallCard of cardsResult.data) {
          try {
            const transformedCard = scryfallService.transformCardData(scryfallCard)
            batch.push(transformedCard)
          } catch (transformError) {
            console.error(`Error transforming card ${scryfallCard.name}:`, transformError)
            errorCount++
          }
        }

        // Batch upsert cards
        if (batch.length > 0) {
          const { data: upsertedCards, error } = await supabase
            .from('cards')
            .upsert(batch, { 
              onConflict: 'scryfall_id',
              ignoreDuplicates: false 
            })
            .select('id, name, scryfall_id')

          if (error) {
            console.error('Batch upsert error:', error)
            errorCount += batch.length
          } else {
            // Count new vs updated (simplified - in real implementation you'd track this better)
            importedCount += upsertedCards.length
            
            res.write(JSON.stringify({
              type: 'progress',
              page: page,
              imported: importedCount,
              errors: errorCount,
              current_batch: upsertedCards.length
            }) + '\n')
          }
        }

        hasMore = cardsResult.has_more
        page++

        // Safety limit
        if (page > 50) {
          res.write(JSON.stringify({
            type: 'warning',
            message: 'Reached page limit (50) for safety'
          }) + '\n')
          break
        }

      } catch (pageError) {
        console.error(`Error processing page ${page}:`, pageError)
        errorCount++
        break
      }
    }

    res.write(JSON.stringify({
      type: 'complete',
      imported: importedCount,
      updated: updatedCount,
      errors: errorCount,
      set: setInfo.name
    }) + '\n')

    res.end()

  } catch (error) {
    console.error('Error importing set:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: error.message })
    } else {
      res.write(JSON.stringify({
        type: 'error',
        error: error.message
      }) + '\n')
      res.end()
    }
  }
})

// Search Scryfall for cards
router.get('/search', authenticateAdmin, async (req, res) => {
  try {
    const { q: query, page = 1, unique = 'cards' } = req.query

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters long' })
    }

    const result = await scryfallService.searchCards(query, { page, unique })
    
    if (!result.success) {
      return res.status(404).json({ error: 'No cards found' })
    }

    // Transform cards to include import status
    const cardsWithStatus = await Promise.all(
      result.data.map(async (scryfallCard) => {
        const { data: existingCard } = await supabase
          .from('cards')
          .select('id, name, updated_at')
          .eq('scryfall_id', scryfallCard.id)
          .single()

        return {
          scryfall_id: scryfallCard.id,
          name: scryfallCard.name,
          set: scryfallCard.set,
          set_name: scryfallCard.set_name,
          rarity: scryfallCard.rarity,
          image_url: scryfallCard.image_uris?.small || scryfallCard.card_faces?.[0]?.image_uris?.small,
          prices: scryfallCard.prices,
          is_imported: !!existingCard,
          local_id: existingCard?.id,
          last_updated: existingCard?.updated_at
        }
      })
    )

    res.json({
      cards: cardsWithStatus,
      has_more: result.has_more,
      next_page: result.next_page,
      total_cards: result.total_cards,
      query: query
    })

  } catch (error) {
    console.error('Error searching Scryfall:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get all available sets from Scryfall
router.get('/sets', authenticateAdmin, async (req, res) => {
  try {
    const result = await scryfallService.getAllSets()
    
    if (!result.success) {
      return res.status(500).json({ error: 'Failed to fetch sets from Scryfall' })
    }

    // Filter to only Magic sets and add import status
    const magicSets = result.data.filter(set => 
      ['core', 'expansion', 'masters', 'draft_innovation', 'commander'].includes(set.set_type)
    )

    // Get import status for each set
    const setsWithStatus = await Promise.all(
      magicSets.map(async (set) => {
        const { count } = await supabase
          .from('cards')
          .select('id', { count: 'exact' })
          .eq('set_number', set.code)

        return {
          code: set.code,
          name: set.name,
          type: set.set_type,
          card_count: set.card_count,
          released_at: set.released_at,
          icon_svg_uri: set.icon_svg_uri,
          imported_count: count || 0,
          is_fully_imported: (count || 0) >= set.card_count,
          import_percentage: set.card_count > 0 ? Math.round(((count || 0) / set.card_count) * 100) : 0
        }
      })
    )

    // Sort by release date (newest first)
    setsWithStatus.sort((a, b) => new Date(b.released_at) - new Date(a.released_at))

    res.json(setsWithStatus)

  } catch (error) {
    console.error('Error fetching sets:', error)
    res.status(500).json({ error: error.message })
  }
})

// Bulk import from Scryfall bulk data
router.post('/bulk-import', authenticateAdmin, async (req, res) => {
  try {
    const { type = 'default_cards', batch_size = 1000 } = req.body

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked'
    })

    res.write(JSON.stringify({
      type: 'start',
      message: 'Starting bulk import from Scryfall...'
    }) + '\n')

    // Download bulk data
    const bulkResult = await scryfallService.downloadBulkData(type)
    if (!bulkResult.success) {
      throw new Error('Failed to download bulk data')
    }

    res.write(JSON.stringify({
      type: 'info',
      message: `Downloaded bulk data (${(bulkResult.size / 1024 / 1024).toFixed(2)} MB)`
    }) + '\n')

    let totalProcessed = 0
    let totalImported = 0
    let totalUpdated = 0
    let totalErrors = 0
    let batch = []
    let lineBuffer = ''

    const gunzip = zlib.createGunzip()
    bulkResult.stream.pipe(gunzip)

    gunzip.on('data', async (chunk) => {
      lineBuffer += chunk.toString()
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue

        try {
          const scryfallCard = JSON.parse(line)
          
          // Filter out digital-only cards, tokens, etc. if desired
          if (scryfallCard.digital || scryfallCard.layout === 'token') {
            continue
          }

          const transformedCard = scryfallService.transformCardData(scryfallCard)
          batch.push(transformedCard)
          totalProcessed++

          // Process batch when it reaches batch_size
          if (batch.length >= batch_size) {
            try {
              const { data, error } = await supabase
                .from('cards')
                .upsert(batch, { 
                  onConflict: 'scryfall_id',
                  ignoreDuplicates: false 
                })

              if (error) {
                console.error('Batch upsert error:', error)
                totalErrors += batch.length
              } else {
                totalImported += batch.length
              }

              res.write(JSON.stringify({
                type: 'progress',
                processed: totalProcessed,
                imported: totalImported,
                errors: totalErrors,
                batch_size: batch.length
              }) + '\n')

              batch = []
            } catch (batchError) {
              console.error('Batch processing error:', batchError)
              totalErrors += batch.length
              batch = []
            }
          }

        } catch (parseError) {
          console.error('Error parsing line:', parseError)
          totalErrors++
        }
      }
    })

    gunzip.on('end', async () => {
      // Process remaining batch
      if (batch.length > 0) {
        try {
          const { data, error } = await supabase
            .from('cards')
            .upsert(batch, { 
              onConflict: 'scryfall_id',
              ignoreDuplicates: false 
            })

          if (error) {
            console.error('Final batch upsert error:', error)
            totalErrors += batch.length
          } else {
            totalImported += batch.length
          }
        } catch (batchError) {
          console.error('Final batch processing error:', batchError)
          totalErrors += batch.length
        }
      }

      res.write(JSON.stringify({
        type: 'complete',
        total_processed: totalProcessed,
        total_imported: totalImported,
        total_errors: totalErrors,
        message: 'Bulk import completed'
      }) + '\n')

      res.end()
    })

    gunzip.on('error', (error) => {
      console.error('Gunzip error:', error)
      res.write(JSON.stringify({
        type: 'error',
        error: error.message
      }) + '\n')
      res.end()
    })

  } catch (error) {
    console.error('Error in bulk import:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: error.message })
    } else {
      res.write(JSON.stringify({
        type: 'error',
        error: error.message
      }) + '\n')
      res.end()
    }
  }
})

// Update card prices from Scryfall
router.post('/update-prices', authenticateAdmin, async (req, res) => {
  try {
    const { card_ids } = req.body

    if (!card_ids || !Array.isArray(card_ids)) {
      return res.status(400).json({ error: 'card_ids array is required' })
    }

    let updated = 0
    let errors = 0

    for (const cardId of card_ids) {
      try {
        // Get local card
        const { data: localCard } = await supabase
          .from('cards')
          .select('scryfall_id, name')
          .eq('id', cardId)
          .single()

        if (!localCard || !localCard.scryfall_id) {
          errors++
          continue
        }

        // Get updated data from Scryfall
        const result = await scryfallService.getCardById(localCard.scryfall_id)
        if (!result.success) {
          errors++
          continue
        }

        const updatedData = scryfallService.transformCardData(result.data)

        // Update only price-related fields
        const { error } = await supabase
          .from('cards')
          .update({
            prices: updatedData.prices,
            updated_at: new Date().toISOString()
          })
          .eq('id', cardId)

        if (error) {
          console.error(`Error updating card ${cardId}:`, error)
          errors++
        } else {
          updated++
        }

      } catch (cardError) {
        console.error(`Error processing card ${cardId}:`, cardError)
        errors++
      }
    }

    res.json({
      message: `Price update completed`,
      updated: updated,
      errors: errors,
      total: card_ids.length
    })

  } catch (error) {
    console.error('Error updating prices:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router