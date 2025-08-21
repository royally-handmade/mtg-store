<!-- Updated CardDetail.vue with Scryfall Integration -->
<template>
  <div v-if="card" class="grid grid-cols-1 lg:grid-cols-2 gap-8">
    <div>
      <!-- Card Image with potential double-faced card support -->
      <div class="mb-6">
        <img :src="card.image_url || card.image_url_large" :alt="card.name" 
             class="w-full max-w-md mx-auto rounded-lg shadow-lg" />
        
        <!-- Double-faced card images if available -->
        <div v-if="card.card_faces && card.card_faces.length > 1" class="mt-4">
          <p class="text-sm font-medium text-gray-700 text-center mb-2">Double-faced card:</p>
          <div class="grid grid-cols-2 gap-2 max-w-md mx-auto">
            <img
              v-for="(face, index) in card.card_faces"
              :key="index"
              :src="face.image_url"
              :alt="face.name"
              class="w-full rounded border cursor-pointer hover:shadow-md"
              @click="selectCardFace(index)"
            >
          </div>
        </div>
      </div>

      <!-- Enhanced Card Information -->
      <div class="space-y-4">
        <div class="flex items-center gap-3 flex-wrap">
          <h1 class="text-3xl font-bold">{{ card.name }}</h1>
          <TreatmentBadge :treatment="card.treatment" size="md" />
          
          <!-- Additional badges for special attributes -->
          <span v-if="card.foil" class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
            Foil Available
          </span>
          <span v-if="card.promo" class="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
            Promo
          </span>
        </div>

        <!-- Enhanced Card Details Grid -->
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div><strong>Set:</strong> {{ card.set_name || card.set_number }}</div>
          <div><strong>Rarity:</strong> <span class="capitalize">{{ card.rarity?.replace('_', ' ') }}</span></div>
          <div><strong>Mana Cost:</strong> <ManaCostDisplay :mana-cost="card.mana_cost" size="large"/></div>
          <div v-if="card.cmc !== undefined"><strong>CMC:</strong> {{ card.cmc }}</div>
          <div><strong>Type:</strong> {{ card.type_line }}</div>
          <div v-if="card.card_number"><strong>Card Number:</strong> {{ card.card_number }}</div>
          <div v-if="card.power || card.toughness"><strong>P/T:</strong> {{ card.power }}/{{ card.toughness }}</div>
          <div v-if="card.loyalty"><strong>Loyalty:</strong> {{ card.loyalty }}</div>
          <div v-if="card.artist"><strong>Artist:</strong> {{ card.artist }}</div>
          <div v-if="card.released_at"><strong>Released:</strong> {{ formatDate(card.released_at) }}</div>
        </div>

        <!-- Oracle Text -->
        <div v-if="card.oracle_text" class="bg-gray-50 p-4 rounded-lg">
          <h3 class="font-semibold mb-2">Oracle Text</h3>
          <div class="text-sm italic whitespace-pre-line">{{ card.oracle_text }}</div>
        </div>

        <!-- Keywords -->
        <div v-if="card.keywords && card.keywords.length > 0" class="space-y-2">
          <h3 class="font-semibold">Keywords</h3>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="keyword in card.keywords"
              :key="keyword"
              class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
            >
              {{ keyword }}
            </span>
          </div>
        </div>

        <!-- Enhanced Price Comparison -->
        <div class="bg-gray-100 p-4 rounded">
          <h3 class="font-semibold mb-2">Market Price Comparison</h3>
          <div class="space-y-2">
            <!-- Platform Price -->
            <div class="flex justify-between items-center">
              <span class="text-sm font-medium text-gray-700">Our Platform</span>
              <span class="font-semibold text-green-600">
                ${{ card.market_price?.toFixed(2) || 'N/A' }}
              </span>
            </div>
            
            <!-- External Prices from Scryfall integration -->
            <div v-if="card.prices?.usd" class="flex justify-between items-center">
              <span class="text-sm text-gray-600">Scryfall (USD)</span>
              <span class="text-gray-800">${{ parseFloat(card.prices.usd).toFixed(2) }}</span>
            </div>
            
            <div v-if="card.prices?.usd_foil" class="flex justify-between items-center">
              <span class="text-sm text-gray-600">Scryfall Foil (USD)</span>
              <span class="text-gray-800">${{ parseFloat(card.prices.usd_foil).toFixed(2) }}</span>
            </div>
            
            <div v-if="card.prices?.eur" class="flex justify-between items-center">
              <span class="text-sm text-gray-600">Cardmarket (EUR)</span>
              <span class="text-gray-800">€{{ parseFloat(card.prices.eur).toFixed(2) }}</span>
            </div>
            
            <!-- Additional external prices if available -->
            <div v-if="externalPrices.tcgplayer" class="flex justify-between items-center">
              <span class="text-sm text-gray-600">TCGPlayer</span>
              <span class="text-gray-800">${{ externalPrices.tcgplayer.toFixed(2) }}</span>
            </div>
            
            <div v-if="externalPrices.cardkingdom" class="flex justify-between items-center">
              <span class="text-sm text-gray-600">Card Kingdom</span>
              <span class="text-gray-800">${{ externalPrices.cardkingdom.toFixed(2) }}</span>
            </div>
          </div>
          <PriceComparisonChart :prices="externalPrices" />
        </div>

        <!-- Enhanced Price History -->
        <div class="bg-blue-50 p-4 rounded">
          <h3 class="font-semibold mb-2">Price History (Our Platform)</h3>
          <PriceTrendChart :data="priceHistory" />
          
          <!-- Market Statistics -->
          <div v-if="listings.length > 0" class="mt-4 pt-4 border-t border-blue-200">
            <h4 class="font-medium mb-2">Market Stats</h4>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-gray-600">Lowest Price:</span>
                <span class="font-medium ml-1">${{ lowestPrice.toFixed(2) }}</span>
              </div>
              <div>
                <span class="text-gray-600">Average Price:</span>
                <span class="font-medium ml-1">${{ averagePrice.toFixed(2) }}</span>
              </div>
              <div>
                <span class="text-gray-600">Available Copies:</span>
                <span class="font-medium ml-1">{{ totalQuantity }}</span>
              </div>
              <div>
                <span class="text-gray-600">Active Sellers:</span>
                <span class="font-medium ml-1">{{ uniqueSellers }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div>
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold">Current Listings</h2>
          <button v-if="authStore.isSeller" @click="showAddListing = false"
            class="bg-slate-300 text-white px-4 py-2 rounded ">
            Add Listing
          </button>
          <button v-else="authStore.isApproved" @click="showAddListing = true"
              class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Add Listing
          </button>
        </div>

        <!-- Listings Filter -->
        <div v-if="listings.length > 0" class="mb-4 flex gap-2 flex-wrap">
          <select v-model="selectedCondition" class="text-sm border rounded px-2 py-1">
            <option value="">All Conditions</option>
            <option value="near_mint">Near Mint</option>
            <option value="lightly_played">Lightly Played</option>
            <option value="moderately_played">Moderately Played</option>
            <option value="heavily_played">Heavily Played</option>
            <option value="damaged">Damaged</option>
          </select>
          
          <select v-model="sortBy" class="text-sm border rounded px-2 py-1">
            <option value="price">Sort by Price</option>
            <option value="condition">Sort by Condition</option>
            <option value="quantity">Sort by Quantity</option>
            <option value="seller_rating">Sort by Seller Rating</option>
          </select>
        </div>

        <!-- Enhanced Listings Display -->
        <div class="space-y-3">
          <div v-for="listing in filteredAndSortedListings" :key="listing.id" 
               class="border rounded p-4 hover:bg-gray-50 transition-colors">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <div class="font-medium text-lg">${{ listing.price }} CAD</div>
                  <span class="px-2 py-1 text-xs rounded-full"
                        :class="getConditionColor(listing.condition)">
                    {{ listing.condition.replace('_', ' ').toUpperCase() }}
                  </span>
                  <span v-if="listing.treatment" class="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                    {{ listing.treatment }}
                  </span>
                </div>
                
                <div class="text-xs text-gray-600 mb-">
                  Sold by {{ listing.seller_name }}
                  <span class="text-yellow-500 ml-1">★ {{ listing.seller_rating || 'New' }}</span>
                </div>
                <div class="text-xs text-gray-600 mb-1">
                  Ships From Canada <!--Replace with seller country-->
                </div>
                
                <div class="flex items-center gap-4 text-xs text-gray-500">
                  <span>Qty: {{ listing.quantity }}</span>
                  <span v-if="listing.created_at">Listed {{ timeAgo(listing.created_at) }}</span>
                  <span v-if="listing.language && listing.language !== 'en'" 
                        class="px-1 py-0.5 bg-gray-100 rounded">
                    {{ listing.language.toUpperCase() }}
                  </span>
                </div>
              </div>
              
              <div class="flex flex-col gap-2 ml-4">
                <button @click="addToCart(listing)"
                  class="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition-colors">
                  Add to Cart
                </button>
                <button @click="addToWishlist(listing)"
                  class="border border-gray-300 text-gray-700 px-4 py-1 rounded text-xs hover:bg-gray-50">
                  Watch Price
                </button>
              </div>
            </div>
          </div>
          
          <div v-if="filteredAndSortedListings.length === 0 && listings.length > 0" 
               class="text-center py-4 text-gray-500">
            No listings match your filters
          </div>
          
          <div v-if="listings.length === 0" class="text-center py-8 text-gray-500">
            <div class="text-lg mb-2">No listings available</div>
            <div class="text-sm">Be the first to list this card!</div>
          </div>
        </div>
      </div>

      <!-- Wishlist Button -->
      <div class="mt-6">
        <WishlistButton :card-id="card.id" />
      </div>
    </div>

    <!-- Add Listing Modal -->
    <AddListingModal v-if="showAddListing" :card="card" @close="showAddListing = false" @added="fetchListings" />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
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
const selectedCondition = ref('')
const sortBy = ref('price')

// Computed properties for enhanced functionality
const filteredAndSortedListings = computed(() => {
  let filtered = listings.value

  // Filter by condition
  if (selectedCondition.value) {
    filtered = filtered.filter(listing => listing.condition === selectedCondition.value)
  }

  // Sort listings
  return filtered.sort((a, b) => {
    switch (sortBy.value) {
      case 'price':
        return a.price - b.price
      case 'condition':
        const conditionOrder = ['near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged']
        return conditionOrder.indexOf(a.condition) - conditionOrder.indexOf(b.condition)
      case 'quantity':
        return b.quantity - a.quantity
      case 'seller_rating':
        return (b.seller_rating || 0) - (a.seller_rating || 0)
      default:
        return 0
    }
  })
})

const lowestPrice = computed(() => {
  return listings.value.length > 0 ? Math.min(...listings.value.map(l => l.price)) : 0
})

const averagePrice = computed(() => {
  if (listings.value.length === 0) return 0
  return listings.value.reduce((sum, l) => sum + l.price, 0) / listings.value.length
})

const totalQuantity = computed(() => {
  return listings.value.reduce((sum, l) => sum + l.quantity, 0)
})

const uniqueSellers = computed(() => {
  return new Set(listings.value.map(l => l.seller_id)).size
})

// API calls
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
    // If endpoint doesn't exist yet, populate with mock data from Scryfall prices
    if (card.value?.prices) {
      externalPrices.value = {
        scryfall: card.value.prices.usd ? parseFloat(card.value.prices.usd) : null,
        scryfall_foil: card.value.prices.usd_foil ? parseFloat(card.value.prices.usd_foil) : null,
        cardmarket: card.value.prices.eur ? parseFloat(card.value.prices.eur) : null
      }
    }
  }
}

// Helper functions
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

const timeAgo = (dateString) => {
  const now = new Date()
  const date = new Date(dateString)
  const diffInHours = Math.floor((now - date) / (1000 * 60 * 60))
  
  if (diffInHours < 1) return 'less than an hour ago'
  if (diffInHours < 24) return `${diffInHours} hours ago`
  if (diffInHours < 168) return `${Math.floor(diffInHours / 24)} days ago`
  return `${Math.floor(diffInHours / 168)} weeks ago`
}

const getConditionColor = (condition) => {
  const colors = {
    near_mint: 'bg-green-100 text-green-800',
    nm: 'bg-green-100 text-green-800',
    lightly_played: 'bg-blue-100 text-blue-800',
    moderately_played: 'bg-yellow-100 text-yellow-800',
    heavily_played: 'bg-orange-100 text-orange-800',
    damaged: 'bg-red-100 text-red-800'
  }
  return colors[condition] || 'bg-gray-100 text-gray-800'
}

const selectCardFace = (index) => {
  // For double-faced cards, could implement face switching
  console.log('Selected card face:', index)
}

const addToCart = (listing) => {
  // Add to cart logic
  console.log('Adding to cart:', listing)
}

const addToWishlist = (listing) => {
  // Add to wishlist with price watching
  console.log('Adding to wishlist:', listing)
}

onMounted(async () => {
  await fetchCard()
  await fetchListings()
  await fetchPriceHistory()
  await fetchExternalPrices()
})
</script>