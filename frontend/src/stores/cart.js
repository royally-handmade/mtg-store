import { defineStore } from 'pinia'
import api from '@/lib/api'

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [],
    summary: {
      itemCount: 0,
      subtotal: '0.00',
      estimatedShipping: '0.00',
      tax: '0.00',
      total: '0.00',
      uniqueSellers: 0
    },
    loading: false
  }),

  getters: {
    itemCount: (state) => state.items.length,
    totalPrice: (state) => parseFloat(state.summary.total),
    
    // Helper to check if a listing is already in cart
    isInCart: (state) => (listingId) => {
      return state.items.some(item => item.listing_id === listingId)
    }
  },

  actions: {
    async fetchCart() {
      this.loading = true
      try {
        const [itemsRes, summaryRes] = await Promise.all([
          api.get('/cart'),
          api.get('/cart/summary')
        ])
        
        this.items = itemsRes.data
        this.summary = summaryRes.data
      } catch (error) {
        console.error('Error fetching cart:', error)
        // Don't throw error if user is not authenticated
        if (error.response?.status !== 401) {
          throw error
        }
      } finally {
        this.loading = false
      }
    },

    async addItem(listingId, quantity = 1) {
      try {
        await api.post('/cart/add', { listing_id: listingId, quantity })
        await this.fetchCart()
      } catch (error) {
        throw error
      }
    },

    async updateQuantity(itemId, quantity) {
      try {
        if (quantity <= 0) {
          await this.removeItem(itemId)
        } else {
          await api.put(`/cart/${itemId}`, { quantity })
          await this.fetchCart()
        }
      } catch (error) {
        throw error
      }
    },

    async removeItem(itemId) {
      try {
        await api.delete(`/cart/${itemId}`)
        await this.fetchCart()
      } catch (error) {
        throw error
      }
    },

    async clearCart() {
      try {
        await api.delete('/cart')
        this.resetState()
      } catch (error) {
        throw error
      }
    },

    // Reset store state (for logout)
    resetState() {
      this.items = []
      this.summary = {
        itemCount: 0,
        subtotal: '0.00',
        estimatedShipping: '0.00',
        tax: '0.00',
        total: '0.00',
        uniqueSellers: 0
      }
      this.loading = false
    },

    // Pinia $reset method
    $reset() {
      this.resetState()
    }
  }
})