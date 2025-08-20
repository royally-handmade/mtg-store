<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold">Deck Builder</h1>
      <div class="flex space-x-4">
        <button @click="showUploadModal = true"
          class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Upload Decklist
        </button>
        <button @click="optimizePrices"
          class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
          Optimize Prices
        </button>
      </div>
    </div>
    
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Deck List -->
      <div class="lg:col-span-2 bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-bold mb-4">Current Deck</h2>
        <div class="space-y-3">
          <div v-for="card in deckCards" :key="card.id" 
            class="flex justify-between items-center border-b pb-2">
            <div class="flex items-center space-x-3">
              <img :src="card.image_url" :alt="card.name" class="w-12 h-16 object-cover rounded" />
              <div>
                <div class="font-medium">{{ card.quantity }}x {{ card.name }}</div>
                <div class="text-sm text-gray-600">${{ card.selectedPrice }} CAD</div>
                <div class="text-xs text-gray-400">{{ card.selectedCondition }}</div>
              </div>
            </div>
            <div class="flex items-center space-x-2">
              <select v-model="card.selectedListing" @change="updateCardPrice(card)"
                class="text-sm rounded border-gray-300">
                <option v-for="listing in card.availableListings" :key="listing.id" :value="listing">
                  ${{ listing.price }} - {{ listing.condition }} ({{ listing.seller_name }})
                </option>
              </select>
              <button @click="removeFromDeck(card.id)" 
                class="text-red-600 hover:text-red-800">
                <TrashIcon class="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        
        <div class="mt-6 pt-4 border-t">
          <div class="flex justify-between items-center text-lg font-bold">
            <span>Total Cost:</span>
            <span>${{ totalCost }} CAD</span>
          </div>
        </div>
      </div>
      
      <!-- Cart Summary -->
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-bold mb-4">Cart Summary</h2>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span>Subtotal:</span>
            <span>${{ subtotal }} CAD</span>
          </div>
          <div class="flex justify-between">
            <span>Shipping:</span>
            <span>${{ shippingCost }} CAD</span>
          </div>
          <div class="flex justify-between">
            <span>Tax:</span>
            <span>${{ taxAmount }} CAD</span>
          </div>
          <div class="border-t pt-2 flex justify-between font-bold">
            <span>Total:</span>
            <span>${{ grandTotal }} CAD</span>
          </div>
        </div>
        
        <button @click="addAllToCart" 
          class="w-full mt-4 bg-green-600 text-white py-2 rounded hover:bg-green-700">
          Add All to Cart
        </button>
        
        <div class="mt-4 text-sm text-gray-600">
          <div>Cards from {{ uniqueSellers }} sellers</div>
          <div>Estimated shipping: {{ estimatedShipping }} days</div>
        </div>
      </div>
    </div>
    
    <!-- Upload Decklist Modal -->
    <DecklistUploadModal v-if="showUploadModal" @close="showUploadModal = false" 
      @uploaded="processDeckList" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { TrashIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import DecklistUploadModal from '@/components/DecklistUploadModal.vue'

const deckCards = ref([])
const showUploadModal = ref(false)
const shippingCost = ref(0)
const taxRate = 0.13 // 13% HST for Canada

const totalCost = computed(() => {
  return deckCards.value.reduce((total, card) => {
    return total + (card.quantity * parseFloat(card.selectedPrice || 0))
  }, 0).toFixed(2)
})

const subtotal = computed(() => totalCost.value)
const taxAmount = computed(() => (subtotal.value * taxRate).toFixed(2))
const grandTotal = computed(() => (parseFloat(subtotal.value) + parseFloat(taxAmount.value) + shippingCost.value).toFixed(2))

const uniqueSellers = computed(() => {
  const sellers = new Set()
  deckCards.value.forEach(card => {
    if (card.selectedListing) {
      sellers.add(card.selectedListing.seller_id)
    }
  })
  return sellers.size
})

const estimatedShipping = computed(() => {
  // Calculate based on sellers and locations
  return '3-5'
})

const processDeckList = async (decklistText) => {
  try {
    const response = await api.post('/deck-builder/process', { 
      decklist: decklistText 
    })
    deckCards.value = response.data
    await calculateShipping()
  } catch (error) {
    console.error('Error processing decklist:', error)
  }
}

const updateCardPrice = (card) => {
  if (card.selectedListing) {
    card.selectedPrice = card.selectedListing.price
    card.selectedCondition = card.selectedListing.condition
  }
}

const optimizePrices = async () => {
  try {
    const response = await api.post('/deck-builder/optimize', { 
      cards: deckCards.value 
    })
    deckCards.value = response.data
  } catch (error) {
    console.error('Error optimizing prices:', error)
  }
}

const removeFromDeck = (cardId) => {
  deckCards.value = deckCards.value.filter(card => card.id !== cardId)
}

const calculateShipping = async () => {
  try {
    const response = await api.post('/shipping/calculate', {
      items: deckCards.value.map(card => ({
        seller_id: card.selectedListing?.seller_id,
        quantity: card.quantity
      }))
    })
    shippingCost.value = response.data.totalCost
  } catch (error) {
    console.error('Error calculating shipping:', error)
  }
}

const addAllToCart = async () => {
  try {
    await api.post('/cart/add-multiple', {
      items: deckCards.value.map(card => ({
        listing_id: card.selectedListing.id,
        quantity: card.quantity
      }))
    })
    // Navigate to cart or show success message
  } catch (error) {
    console.error('Error adding to cart:', error)
  }
}

onMounted(() => {
  // Load any saved deck
})
</script>