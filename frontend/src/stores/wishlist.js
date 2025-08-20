import { defineStore } from 'pinia'
import api from '@/lib/api'

export const useWishlistStore = defineStore('wishlist', {
  state: () => ({
    items: [],
    loading: false,
    wishlistIds: new Set(), // Quick lookup for wishlist status
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
    }
  },

  actions: {
    async fetchWishlist() {
      this.loading = true
      try {
        const response = await api.get('/wishlist')
        this.items = response.data || []
        this.wishlistIds = new Set(this.items.map(item => item.card_id))
      } catch (error) {
        console.error('Error fetching wishlist:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async addToWishlist(cardId, options = {}) {
      try {
        const response = await api.post('/wishlist', {
          card_id: cardId,
          max_price: options.maxPrice || null,
          condition_preference: options.conditionPreference || null
        })
        
        this.items.push(response.data)
        this.wishlistIds.add(cardId)
        return response.data
      } catch (error) {
        console.error('Error adding to wishlist:', error)
        throw error
      }
    },

    async removeFromWishlist(cardId) {
      try {
        await api.delete(`/wishlist/${cardId}`)
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