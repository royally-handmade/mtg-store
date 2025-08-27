import { defineStore } from 'pinia'
import api from '@/lib/api'

export const useWishlistStore = defineStore('wishlist', {
  state: () => ({
    items: [],
    loading: false,
    initialized: false, // Track if wishlist has been loaded
    wishlistIds: new Set(), // Quick lookup for wishlist status
    error: null
  }),

  getters: {
    itemCount: (state) => state.items.length,
    totalValue: (state) => {
      return state.items.reduce((sum, item) => {
        return sum + (parseFloat(item.cards?.market_price || 0))
      }, 0).toFixed(2)
    },
    isInWishlist: (state) => (cardId) => {
      return state.wishlistIds.has(cardId)
    },
    isReady: (state) => state.initialized && !state.loading
  },

  actions: {
    // Main fetch method with deduplication logic
    async fetchWishlist() {
      // If already initialized, don't fetch again
      if (this.initialized && !this.error) {
        return this.items
      }

      // If already loading, wait for it to complete
      if (this.loading) {
        return new Promise((resolve, reject) => {
          const checkLoading = () => {
            if (!this.loading) {
              if (this.error) {
                reject(this.error)
              } else {
                resolve(this.items)
              }
            } else {
              setTimeout(checkLoading, 50)
            }
          }
          checkLoading()
        })
      }

      this.loading = true
      this.error = null
      
      try {
        const response = await api.get('/wishlist')
        this.items = response.data || []
        this.wishlistIds = new Set(this.items.map(item => item.card_id))
        this.initialized = true
        console.log('✅ Wishlist fetched successfully:', this.items.length, 'items')
        return this.items
      } catch (error) {
        console.error('❌ Error fetching wishlist:', error)
        this.error = error
        // Don't throw - let components handle gracefully
        this.items = []
        this.wishlistIds = new Set()
        this.initialized = true // Mark as initialized even on error to prevent retries
        return this.items
      } finally {
        this.loading = false
      }
    },

    // Force refresh - useful when data might be stale
    async refresh() {
      this.initialized = false
      this.error = null
      return await this.fetchWishlist()
    },

    // Reset store (useful for logout)
    reset() {
      this.items = []
      this.wishlistIds = new Set()
      this.loading = false
      this.initialized = false
      this.error = null
    },

    // Safe add method with duplicate checking and error handling
    async safeAddToWishlist(cardId, options = {}) {
      try {
        // Ensure wishlist is initialized first
        if (!this.initialized) {
          await this.initialize()
        }

        // Check if already in wishlist
        if (this.isInWishlist(cardId)) {
          return {
            success: false,
            alreadyExists: true,
            message: 'Card is already in your wishlist'
          }
        }

        const response = await api.post('/wishlist', {
          card_id: cardId,
          max_price: options.maxPrice || null,
          condition_preference: options.conditionPreference || null
        })
        
        // Update local state optimistically
        this.items.push(response.data)
        this.wishlistIds.add(cardId)
        
        return {
          success: true,
          data: response.data,
          message: 'Added to wishlist'
        }
      } catch (error) {
        console.error('Error adding to wishlist:', error)
        
        // Handle specific error cases
        if (error.response?.status === 409) {
          return {
            success: false,
            alreadyExists: true,
            message: 'Card is already in your wishlist'
          }
        }
        
        return {
          success: false,
          error: error.message,
          message: 'Failed to add to wishlist'
        }
      }
    },

    async addToWishlist(cardId, options = {}) {
      const result = await this.safeAddToWishlist(cardId, options)
      if (!result.success && !result.alreadyExists) {
        throw new Error(result.message)
      }
      return result.data
    },

    async removeFromWishlist(cardId) {
      try {
        await api.delete(`/wishlist/${cardId}`)
        
        // Update local state optimistically
        this.items = this.items.filter(item => item.card_id !== cardId)
        this.wishlistIds.delete(cardId)
      } catch (error) {
        console.error('Error removing from wishlist:', error)
        throw error
      }
    },

    async updateWishlistItem(cardId, options) {
      try {
        const response = await api.put(`/wishlist/${cardId}`, options)
        const index = this.items.findIndex(item => item.card_id === cardId)
        if (index !== -1) {
          this.items[index] = { ...this.items[index], ...response.data }
        }
        return response.data
      } catch (error) {
        console.error('Error updating wishlist item:', error)
        throw error
      }
    },

    async clearWishlist() {
      try {
        await api.delete('/wishlist')
        this.items = []
        this.wishlistIds.clear()
      } catch (error) {
        console.error('Error clearing wishlist:', error)
        throw error
      }
    },

    async addItemToCart(cardId, quantity = 1) {
      try {
        // Find cheapest available listing for this card
        const response = await api.get(`/cards/${cardId}/listings`)
        const listings = response.data
        
        if (listings.length === 0) {
          throw new Error('No listings available for this card')
        }
        
        // Find cheapest listing with sufficient quantity
        const availableListing = listings.find(listing => 
          listing.quantity >= quantity && listing.status === 'active'
        )
        
        if (!availableListing) {
          throw new Error('No listings with sufficient quantity available')
        }
        
        const { useCartStore } = await import('./cart')
        const cartStore = useCartStore()
        await cartStore.addItem(availableListing.id, quantity)
        
        return availableListing
      } catch (error) {
        console.error('Error adding wishlist item to cart:', error)
        throw error
      }
    },

    async addAllToCart() {
      const results = []
      let successCount = 0
      let failCount = 0
      
      for (const item of this.items) {
        try {
          await this.addItemToCart(item.card_id, 1)
          results.push({ cardId: item.card_id, success: true })
          successCount++
        } catch (error) {
          results.push({ 
            cardId: item.card_id, 
            success: false, 
            error: error.message 
          })
          failCount++
        }
      }
      
      return {
        results,
        successCount,
        failCount,
        totalItems: this.items.length
      }
    }
  }
})