// services/scryfallService.js
import axios from 'axios'

const SCRYFALL_API_BASE = 'https://api.scryfall.com'
const SCRYFALL_BULK_DATA_URL = `${SCRYFALL_API_BASE}/bulk-data`

class ScryfallService {
  constructor() {
    this.axiosInstance = axios.create({
      baseURL: SCRYFALL_API_BASE,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MTG-Marketplace/1.0'
      }
    })

    // Rate limiting: Scryfall allows 100 requests/second
    this.lastRequestTime = 0
    this.minInterval = 10 // 10ms between requests
  }

  async rateLimit() {
    const now = Date.now()
    const timeToWait = this.minInterval - (now - this.lastRequestTime)
    if (timeToWait > 0) {
      await new Promise(resolve => setTimeout(resolve, timeToWait))
    }
    this.lastRequestTime = Date.now()
  }

  // Search for cards by name
  async searchCards(query, options = {}) {
    await this.rateLimit()

    const params = {
      q: query,
      unique: options.unique || 'cards',
      order: options.order || 'name',
      dir: options.dir || 'auto',
      include_extras: options.include_extras || false,
      include_multilingual: options.include_multilingual || false,
      include_variations: options.include_variations || false,
      page: options.page || 1
    }

    try {
      const response = await this.axiosInstance.get('/cards/search', { params })
      console.log(response.data.data)
      if(response.data.data[0].card_faces.length > 0){
        console.log(response.data.data[0].card_faces)
      }

      return {
        success: true,
        data: response.data.data,
        has_more: response.data.has_more,
        next_page: response.data.next_page,
        total_cards: response.data.total_cards
      }
    } catch (error) {
      if (error.response?.status === 404) {
        return { success: true, data: [], has_more: false, total_cards: 0 }
      }
      throw this.handleError(error)
    }
  }

  // Get card by exact name and set
  async getCardByNameAndSet(name, setCode) {
    await this.rateLimit()

    try {
      const response = await this.axiosInstance.get(`/cards/named`, {
        params: {
          exact: name,
          set: setCode
        }
      })
      return { success: true, data: response.data }
    } catch (error) {
      if (error.response?.status === 404) {
        return { success: false, error: 'Card not found' }
      }
      throw this.handleError(error)
    }
  }

  // Get card by Scryfall ID
  async getCardById(scryfallId) {
    await this.rateLimit()

    try {
      const response = await this.axiosInstance.get(`/cards/${scryfallId}`)
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

  // Get specific set
  async getSet(setCode) {
    await this.rateLimit()

    try {
      const response = await this.axiosInstance.get(`/sets/${setCode}`)
      return { success: true, data: response.data }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // Get cards from a specific set
  async getCardsFromSet(setCode, page = 1) {
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

  // Transform Scryfall card data to your database format
  transformCardData(scryfallCard) {

    let dual = scryfallCard.card_faces && scryfallCard.card_faces.length > 0 ? true : false

    return {
      scryfall_id: scryfallCard.id,
      name: scryfallCard.name,
      set_number: scryfallCard.set.toUpperCase(),
      card_number: scryfallCard.collector_number,
      mana_cost: dual ? scryfallCard.card_faces[0].mana_cost || '' : scryfallCard.mana_cost || '',
      cmc: scryfallCard.cmc || 0,
      type_line: dual ? scryfallCard.card_faces[0].type_line || '' : scryfallCard.type_line || '',
      oracle_text: dual ? scryfallCard.card_faces[0].oracle_text || '' : scryfallCard.oracle_text || '',
      power: scryfallCard.power || null,
      toughness: scryfallCard.toughness || null,
      loyalty: scryfallCard.loyalty || null,
      rarity: scryfallCard.rarity?.toLowerCase(),
      treatment: null,
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
      card_faces: scryfallCard.card_faces ? scryfallCard.card_faces.map(face => ({
        name: face.name,
        mana_cost: face.mana_cost,
        type_line: face.type_line,
        oracle_text: face.oracle_text,
        power: face.power,
        toughness: face.toughness,
        loyalty: face.loyalty,
        image_url: face.image_uris?.normal
      })) : null,
      // Market price (will be calculated from your platform's sales)
      market_price: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      frame_effects: scryfallCard.frame_effects,
      promo_types: scryfallCard.promo_types
    }
  }

  // Determine card treatment/finish
  getTreatment(scryfallCard) {
    const treatments = []

    if (scryfallCard.foil) treatments.push('foil')
    if (scryfallCard.etched) treatments.push('etched')
    if (scryfallCard.glossy) treatments.push('glossy')

    // Check for special treatments in frame effects
    if (scryfallCard.frame_effects?.includes('showcase')) treatments.push('showcase')
    if (scryfallCard.frame_effects?.includes('extendedart')) treatments.push('extended-art')
    if (scryfallCard.frame_effects?.includes('borderless')) treatments.push('borderless')

    return treatments.length > 0 ? treatments.join(', ') : ''
  }

  // Handle API errors
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

  // Helper method to search for cards with pagination
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