<template>
  <div v-if="card" class="grid grid-cols-1 lg:grid-cols-2 gap-8">
    <div>
      <img :src="card.image_url" :alt="card.name" class="w-full max-w-md mx-auto rounded-lg shadow-lg" />
      <!-- Treatment Badge positioned on card image -->
      <div class="mt-6 space-y-4">
        <div class="flex items-center gap-3 flex-wrap">
          <h1 class="text-3xl font-bold">{{ card.name }}</h1>
          <TreatmentBadge :treatment="card.treatment" size="md" />
        </div>

        <div class="grid grid-cols-2 gap-4 text-sm">
          <div><strong>Set:</strong> {{ card.set_number }}</div>
          <div><strong>Rarity:</strong> {{ card.rarity }}</div>
          <div><strong>Mana Cost:</strong> <ManaCostDisplay :mana-cost=card.mana_cost size="large"/></div>
          <div><strong>Type:</strong> {{ card.type_line }}</div>
          <div><strong>Card Number:</strong> {{ card.card_number || 'N/A' }}</div>
        </div>

        <div class="bg-gray-100 p-4 rounded">
          <h3 class="font-semibold mb-2">Market Price Comparison</h3>
          <PriceComparisonChart :prices="externalPrices" />
        </div>

        <div class="bg-blue-50 p-4 rounded">
          <h3 class="font-semibold mb-2">Price History (Our Platform)</h3>
          <PriceTrendChart :data="priceHistory" />
        </div>
      </div>
    </div>

    <div>
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold">Current Listings</h2>
          <button v-if="authStore.isSeller" @click="showAddListing = true"
            class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Add Listing
          </button>
        </div>

        <div class="space-y-3">
          <div v-for="listing in listings" :key="listing.id" class="border rounded p-4 hover:bg-gray-50">
            <div class="flex justify-between items-start">
              <div>
                <div class="font-medium">${{ listing.price }} CAD</div>
                <div class="text-sm text-gray-600">{{ listing.condition }}</div>
                <div class="text-sm text-gray-500">
                  Sold by {{ listing.seller_name }}
                  <span class="text-yellow-500">★ {{ listing.seller_rating }}</span>
                </div>
                <div class="text-xs text-gray-400">Qty: {{ listing.quantity }}</div>
              </div>
              <button @click="addToCart(listing)"
                class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </div>

      <WishlistButton :card-id="card.id" />
    </div>

    <!-- Add Listing Modal -->
    <AddListingModal v-if="showAddListing" :card="card" @close="showAddListing = false" @added="fetchListings" />
  </div>
</template>

<script setup>
  import { ref, onMounted } from 'vue'
  import { useRoute } from 'vue-router'
  import { useAuthStore } from '@/stores/auth'
  import api from '@/lib/api'
  import PriceTrendChart from '@/components/PriceTrendChart.vue'
  import PriceComparisonChart from '@/components/PriceComparisonChart.vue'
  import AddListingModal from '@/components/AddListingModal.vue'
  import WishlistButton from '@/components/WishlistButton.vue'
  import TreatmentBadge from '../components/TreatmentBadge.vue'
  import ManaCostDisplay from '../components/ManaCostDisplay.vue'

  const route = useRoute()
  const authStore = useAuthStore()

  const card = ref(null)
  const listings = ref([])
  const priceHistory = ref([])
  const externalPrices = ref({})
  const showAddListing = ref(false)

  const fetchCard = async () => {
    try {
      const response = await api.get(`/cards/${route.params.id}`)
      card.value = response.data
    } catch (error) {
      console.error('Error fetching card:', error)
    }
  }

  const fetchListings = async () => {
    try {
      const response = await api.get(`/cards/${route.params.id}/listings`)
      listings.value = response.data
    } catch (error) {
      console.error('Error fetching listings:', error)
    }
  }

  const fetchPriceHistory = async () => {
    try {
      const response = await api.get(`/cards/${route.params.id}/price-history`)
      priceHistory.value = response.data
    } catch (error) {
      console.error('Error fetching price history:', error)
    }
  }

  const fetchExternalPrices = async () => {
    try {
      const response = await api.get(`/cards/${route.params.id}/external-prices`)
      externalPrices.value = response.data
    } catch (error) {
      console.error('Error fetching external prices:', error)
    }
  }

  const addToCart = (listing) => {
    // Add to cart logic
    console.log('Adding to cart:', listing)
  }

  onMounted(async () => {
    await fetchCard()
    await fetchListings()
    await fetchPriceHistory()
    await fetchExternalPrices()
  })
</script>