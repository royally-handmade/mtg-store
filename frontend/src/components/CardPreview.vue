<template>
  <div class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer relative"
    @click="$router.push(`/card/${card.id}`)">
    
    <!-- Wishlist Button Overlay -->
    <div class="absolute top-2 right-2 z-10">
      <WishlistButton 
        :card-id="card.id" 
        :show-text="false" 
        :show-price-alert="false"
        @click.stop
      />
    </div>
    
    <div class="overflow-hidden rounded-t-lg">
      <img :src="card.image_url" :alt="card.name" 
        class="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
    </div>
    <div class="p-4">
    <TreatmentBadge :treatment="card.treatment" size="sm" />
      <h3 class="font-semibold text-lg mb-1 truncate">{{ card.name }}</h3>
      <p class="text-sm text-gray-600 mb-2">{{ card.set_number.toUpperCase() }} • {{ card.rarity.toUpperCase() }}</p>
      <div class="flex justify-between items-center">
        <span class="text-lg font-bold text-green-600">
          ${{ card.market_price || '0.00' }} CAD
        </span>
       <!-- <button
          @click.stop="quickAddToCart"
          :disabled="addingToCart"
          class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {{ addingToCart ? 'Adding...' : 'Quick Add' }}
        </button>-->
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useCartStore } from '@/stores/cart'
import { useToast } from 'vue-toastification'
import WishlistButton from '@/components/WishlistButton.vue'
import api from '@/lib/api'
import TreatmentBadge from './TreatmentBadge.vue'
import { setMapStoreSuffix } from 'pinia'

const props = defineProps({
  card: {
    type: Object,
    required: true
  }
})

const cartStore = useCartStore()
const toast = useToast()
const addingToCart = ref(false)

const quickAddToCart = async () => {
  addingToCart.value = true
  try {
    // Find cheapest available listing
    const response = await api.get(`/cards/${props.card.id}/listings`)
    const listings = response.data
    
    if (listings.length === 0) {
      toast.error('No listings available for this card')
      return
    }
    
    const cheapestListing = listings[0] // Already sorted by price
    await cartStore.addItem(cheapestListing.id, 1)
    toast.success('Added to cart')
  } catch (error) {
    toast.error('Error adding to cart')
  } finally {
    addingToCart.value = false
  }
}
</script>