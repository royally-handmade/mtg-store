import axios from 'axios'

class ScryfallService {
  constructor() {
    this.baseURL = 'https://api.scryfall.com'
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Accept': 'application/json'
      }
    })
    this.lastRequestTime = 0
    this.requestDelay = 100 // 100ms between requests (Scryfall recommends 50-100ms)

    // ========================================
    // CONFIGURATION: Filters for unwanted types
    // ========================================
    
    /**
     * Promo types to filter out (not displayed to users)
     * Add any promo types here that you want to exclude from the treatment badges
     */
    this.FILTERED_PROMO_TYPES = [
      'boosterfun',      // Generic category, not specific enough
      'universesbeyond'
      // Add more promo types to filter here:
      // 'release',
      // 'stamped',
    ]

    /**
     * Frame effects to filter out (not displayed to users)
     * Add any frame effects here that you want to exclude from the treatment badges
     */
    this.FILTERED_FRAME_EFFECTS = [
      // Add frame effects to filter here:
       'legendary',     // Too common, might want to filter
       'miracle',       // Mechanics-based, not visual
      'draft',         // Not visually distinct
      'inverted'
    ]

    /**
     * Treatments to filter out (not displayed to users)
     * Add any treatments here that you want to exclude
     */
    this.FILTERED_TREATMENTS = [
      // Add treatments to filter here if needed:
      // 'glossy',        // If you don't want to show this
    ]
  }

  // Rate limiting helper
  async rateLimit() {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    
    if (timeSinceLastRequest < this.requestDelay) {
      await new Promise(resolve => setTimeout(resolve, this.requestDelay - timeSinceLastRequest))
    }
    
    this.lastRequestTime = Date.now()
  }

  // Get a single card by Scryfall ID
  async getCard(scryfallId) {
    await this.rateLimit()

    try {
      const response = await this.axiosInstance.get(`/cards/${scryfallId}`)
      return { success: true, data: response.data }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // Get card by set code and collector number
  async getCardBySetAndNumber(setCode, collectorNumber) {
    await this.rateLimit()

    try {
      const response = await this.axiosInstance.get(`/cards/${setCode}/${collectorNumber}`)
      return { success: true, data: response.data }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // Search cards
  async searchCards(query, options = {}) {
    await this.rateLimit()

    const params = {
      q: query,
      ...options
    }

    try {
      const response = await this.axiosInstance.get('/cards/search', { params })
      return {
        success: true,
        data: response.data.data,
        has_more: response.data.has_more,
        next_page: response.data.next_page,
        total_cards: response.data.total_cards
      }
    } catch (error) {
      if (error.response?.status === 404) {
        // No cards found is not an error
        return { success: true, data: [], has_more: false, total_cards: 0 }
      }
      throw this.handleError(error)
    }
  }

  // Get all printings of a card
  async getCardPrintings(oracleId) {
    await this.rateLimit()

    try {
      const response = await this.axiosInstance.get(`/cards/search`, {
        params: {
          q: `oracleid:${oracleId}`,
          order: 'released',
          dir: 'desc'
        }
      })
      return {
        success: true,
        data: response.data.data
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // Get set information
  async getSet(setCode) {
    await this.rateLimit()

    try {
      const response = await this.axiosInstance.get(`/sets/${setCode}`)
      return { success: true, data: response.data }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // Get all sets
  async getAllSets() {
    await this.rateLimit()

    try {
      const response = await this.axiosInstance.get('/sets')
      return { success: true, data: response.data.data }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // Get cards from a specific set
  async getSetCards(setCode, page = 1) {
    await this.rateLimit()

    try {
      const response = await this.axiosInstance.get(`/cards/search`, {
        params: {
          q: `set:${setCode}`,
          page: page,
          order: 'set'
        }
      })
      return {
        success: true,
        data: response.data.data,
        has_more: response.data.has_more,
        next_page: response.data.next_page
      }
    } catch (error) {
      if (error.response?.status === 404) {
        return { success: true, data: [], has_more: false }
      }
      throw this.handleError(error)
    }
  }

  // Get bulk data info
  async getBulkDataInfo() {
    await this.rateLimit()

    try {
      const response = await this.axiosInstance.get('/bulk-data')
      return { success: true, data: response.data.data }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // Download and process bulk data
  async downloadBulkData(type = 'default_cards') {
    const bulkInfo = await this.getBulkDataInfo()
    if (!bulkInfo.success) {
      throw new Error('Failed to get bulk data info')
    }

    const targetBulk = bulkInfo.data.find(bulk => bulk.type === type)
    if (!targetBulk) {
      throw new Error(`Bulk data type '${type}' not found`)
    }

    try {
      console.log(`Downloading bulk data from: ${targetBulk.download_uri}`)
      console.log(`File size: ${(targetBulk.size / 1024 / 1024).toFixed(2)} MB`)

      const response = await axios.get(targetBulk.download_uri, {
        timeout: 300000, // 5 minute timeout for bulk download
        responseType: 'stream'
      })

      return {
        success: true,
        stream: response.data,
        size: targetBulk.size,
        updated_at: targetBulk.updated_at
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Transform Scryfall card data to database format
   * This method properly handles all treatment types for the TreatmentBadge component
   */
  transformCardData(scryfallCard) {
    const isDualFaced = scryfallCard.card_faces && scryfallCard.card_faces.length > 0

    // Extract and format all treatment-related data as comma-separated strings
    const treatment = this.getTreatment(scryfallCard)
    const frame_effects = this.getFrameEffects(scryfallCard)
    const promo_types = this.getPromoTypes(scryfallCard)

    return {
      scryfall_id: scryfallCard.id,
      oracle_id: scryfallCard.oracle_id,
      name: scryfallCard.name,
      set_number: scryfallCard.set.toUpperCase(),
      card_number: scryfallCard.collector_number,
      mana_cost: isDualFaced ? scryfallCard.card_faces[0].mana_cost || '' : scryfallCard.mana_cost || '',
      cmc: scryfallCard.cmc || 0,
      type_line: isDualFaced ? scryfallCard.card_faces[0].type_line || '' : scryfallCard.type_line || '',
      oracle_text: isDualFaced ? scryfallCard.card_faces[0].oracle_text || '' : scryfallCard.oracle_text || '',
      power: scryfallCard.power || null,
      toughness: scryfallCard.toughness || null,
      loyalty: scryfallCard.loyalty || null,
      rarity: scryfallCard.rarity?.toLowerCase(),
      
      // Treatment fields - all comma-separated for TreatmentBadge component
      treatment: treatment,
      frame_effects: frame_effects,
      promo_types: promo_types,
      
      image_url: scryfallCard.image_uris?.normal || scryfallCard.card_faces?.[0]?.image_uris?.normal || '',
      image_url_small: scryfallCard.image_uris?.small || scryfallCard.card_faces?.[0]?.image_uris?.small || '',
      image_url_large: scryfallCard.image_uris?.large || scryfallCard.card_faces?.[0]?.image_uris?.large || '',
      
      prices: {
        usd: scryfallCard.prices?.usd ? parseFloat(scryfallCard.prices.usd) : null,
        usd_foil: scryfallCard.prices?.usd_foil ? parseFloat(scryfallCard.prices.usd_foil) : null,
        eur: scryfallCard.prices?.eur ? parseFloat(scryfallCard.prices.eur) : null,
        tix: scryfallCard.prices?.tix ? parseFloat(scryfallCard.prices.tix) : null
      },
      
      set_name: scryfallCard.set_name,
      set_type: scryfallCard.set_type,
      released_at: scryfallCard.released_at,
      artist: scryfallCard.artist,
      border_color: scryfallCard.border_color,
      frame: scryfallCard.frame,
      security_stamp: scryfallCard.security_stamp,
      layout: scryfallCard.layout,
      multiverse_ids: scryfallCard.multiverse_ids || [],
      mtgo_id: scryfallCard.mtgo_id,
      arena_id: scryfallCard.arena_id,
      tcgplayer_id: scryfallCard.tcgplayer_id,
      cardmarket_id: scryfallCard.cardmarket_id,
      lang: scryfallCard.lang || 'en',
      digital: scryfallCard.digital || false,
      foil: scryfallCard.foil || false,
      nonfoil: scryfallCard.nonfoil || false,
      oversized: scryfallCard.oversized || false,
      promo: scryfallCard.promo || false,
      reprint: scryfallCard.reprint || false,
      variation: scryfallCard.variation || false,
      
      // Keywords for search
      keywords: scryfallCard.keywords || [],
      
      // Card faces for double-faced cards
      card_faces: scryfallCard.card_faces ? 
        scryfallCard.card_faces.map(face => ({
          name: face.name,
          mana_cost: face.mana_cost,
          type_line: face.type_line,
          oracle_text: face.oracle_text,
          flavor_text: face.flavor_text || null,
          power: face.power || null,
          toughness: face.toughness || null,
          loyalty: face.loyalty || null,
          image_url: face.image_uris?.normal
        })) : null,
      
      // Market price (will be calculated from your platform's sales)
      market_price: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      flavor_text: scryfallCard.flavor_text,
      legalities: scryfallCard.legalities
    }
  }

  /**
   * Extract card treatments/finishes
   * Returns comma-separated string for TreatmentBadge component
   * Examples: "foil", "foil, etched", "etched"
   */
  getTreatment(scryfallCard) {
    const treatments = []

    // Check for foil finishes
    // Note: We check scryfallCard.finishes array (newer Scryfall format)
    // and fallback to boolean flags (older format)
    if (scryfallCard.finishes) {
      // New format: finishes is an array like ["foil", "nonfoil", "etched"]
      if (scryfallCard.finishes.includes('foil') && !scryfallCard.finishes.includes('etched')) {
        treatments.push('foil')
      }
      if (scryfallCard.finishes.includes('etched')) {
        treatments.push('foil-etched')
      }
    } else {
      // Old format: boolean flags
      if (scryfallCard.foil && !scryfallCard.etched) {
        treatments.push('foil')
      }
      if (scryfallCard.etched) {
        treatments.push('foil-etched')
      }
    }

    // Check for other finishes
    if (scryfallCard.glossy) {
      treatments.push('glossy')
    }

    // Filter out unwanted treatments
    const filteredTreatments = treatments.filter(treatment => {
      return !this.FILTERED_TREATMENTS.includes(treatment.toLowerCase())
    })

    return filteredTreatments.length > 0 ? filteredTreatments.join(', ') : ''
  }

  /**
   * Extract frame effects
   * Returns comma-separated string for TreatmentBadge component
   * Examples: "showcase", "extended-art", "borderless, showcase"
   */
  getFrameEffects(scryfallCard) {
    if (!scryfallCard.frame_effects || !Array.isArray(scryfallCard.frame_effects)) {
      return ''
    }

    // Map Scryfall frame effects to our display names
    const frameEffectMap = {
      'showcase': 'showcase',
      'extendedart': 'extended-art',
      'borderless': 'borderless',
      'inverted': 'inverted',
      'legendary': 'legendary',
      'nyxtouched': 'nyxtouched',
      'draft': 'draft',
      'devoid': 'devoid',
      'tombstone': 'tombstone',
      'colorshifted': 'colorshifted',
      'sunmoondfc': 'sun-moon',
      'compasslanddfc': 'compass',
      'originpwdfc': 'origin',
      'mooneldrazidfc': 'moon-eldrazi',
      'waxingandwaningmoondfc': 'waxing-waning',
      'fullart': 'full-art',
      'snow': 'snow',
      'miracle': 'miracle',
      'convertdfc': 'transform',
      'fandfc': 'fan',
      'upsidedowndfc': 'upside-down',
      'lesson': 'lesson',
      'shatteredglass': 'shattered-glass',
      'textless': 'textless'
    }

    const frameEffects = []

    scryfallCard.frame_effects.forEach(effect => {
      const normalizedEffect = effect.toLowerCase()
      
      // Check if this frame effect should be filtered out
      if (this.FILTERED_FRAME_EFFECTS.includes(normalizedEffect)) {
        return // Skip this frame effect
      }
      
      if (frameEffectMap[normalizedEffect]) {
        frameEffects.push(frameEffectMap[normalizedEffect])
      }
    })

    // Remove duplicates and return
    return [...new Set(frameEffects)].join(', ')
  }

  /**
   * Extract promo types
   * Returns comma-separated string for TreatmentBadge component
   * Examples: "prerelease", "serialized", "buyabox"
   * Note: Filters out items in FILTERED_PROMO_TYPES array
   */
  getPromoTypes(scryfallCard) {
    if (!scryfallCard.promo_types || !Array.isArray(scryfallCard.promo_types)) {
      return ''
    }

    // Map Scryfall promo types to display names
    const promoTypeMap = {
      'prerelease': 'prerelease',
      'datestamped': 'date-stamped',
      'planeswalkerstamped': 'planeswalker-stamped',
      'releasedate': 'release-date',
      'setpromo': 'set-promo',
      'starterdeck': 'starter-deck',
      'instore': 'in-store',
      'league': 'league',
      'buyabox': 'buy-a-box',
      'giftbox': 'gift-box',
      'intropack': 'intro-pack',
      'gameday': 'game-day',
      'convention': 'convention',
      'judgegift': 'judge-gift',
      'fnm': 'fnm',
      'playerrewards': 'player-rewards',
      'duels': 'duels',
      'openhouse': 'open-house',
      'bundle': 'bundle',
      'premierplaypromo': 'premier-play',
      'serialized': 'serialized',
      'thick': 'thick-stock',
      'stamped': 'stamped',
      'scholastic': 'scholastic',
      'wizardsplaynetwork': 'wpn',
      'commanderparty': 'commander-party',
      'storechampionship': 'store-championship',
      'draftweekend': 'draft-weekend',
      'neonink':'neon-ink',
      'raisedfoil':'raised-foil'
    }

    const promoTypes = scryfallCard.promo_types
      .filter(type => {
        const normalizedType = type.toLowerCase()
        // Filter out promo types in the FILTERED_PROMO_TYPES array
        return !this.FILTERED_PROMO_TYPES.includes(normalizedType)
      })
      .map(type => {
        const normalizedType = type.toLowerCase()
        return promoTypeMap[normalizedType] || type
      })

    // Remove duplicates and return
    return [...new Set(promoTypes)].join(', ')
  }

  /**
   * Handle API errors
   */
  handleError(error) {
    if (error.response) {
      const status = error.response.status
      const message = error.response.data?.details || error.response.statusText

      switch (status) {
        case 404:
          throw new Error('Card or resource not found')
        case 422:
          throw new Error(`Invalid request: ${message}`)
        case 429:
          throw new Error('Rate limit exceeded. Please try again later.')
        case 500:
        case 502:
        case 503:
          throw new Error('Scryfall API is temporarily unavailable')
        default:
          throw new Error(`Scryfall API error (${status}): ${message}`)
      }
    } else if (error.request) {
      throw new Error('Unable to connect to Scryfall API')
    } else {
      throw new Error(`Request error: ${error.message}`)
    }
  }

  /**
   * Helper method to search for cards with pagination
   */
  async searchAllCards(query, options = {}) {
    const allCards = []
    let hasMore = true
    let page = 1

    while (hasMore) {
      const result = await this.searchCards(query, { ...options, page })
      if (!result.success) break

      allCards.push(...result.data)
      hasMore = result.has_more
      page++

      // Safety limit to prevent infinite loops
      if (page > 100) {
        console.warn('Reached page limit (100) for search query:', query)
        break
      }
    }

    return {
      success: true,
      data: allCards,
      total_cards: allCards.length
    }
  }
}

export default new ScryfallService()