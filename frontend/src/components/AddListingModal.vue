<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-full max-w-lg">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold">Add Listing for {{ card.name }}</h2>
        <button @click="$emit('close')" class="text-gray-500 hover:text-gray-700">
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <!-- Condition Selection (affects price suggestions) -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Condition</label>
          <select v-model="form.condition" @change="onConditionChange" required class="input-field">
            <option value="">Select condition</option>
            <option value="nm">Near Mint</option>
            <option value="lp">Lightly Played</option>
            <option value="mp">Moderately Played</option>
            <option value="hp">Heavily Played</option>
            <option value="dmg">Damaged</option>
          </select>
        </div>

        <!-- Price Input with Auto-Suggestions -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Price (CAD)</label>
          <div class="relative">
            <input 
              v-model="form.price" 
              type="number" 
              step="0.01" 
              min="0" 
              required 
              class="input-field pr-20" 
              placeholder="0.00"
              @focus="showSuggestions = true"
            />
            <button
              v-if="suggestedPrice && !form.price"
              type="button"
              @click="applySuggestedPrice"
              class="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
            >
              Use ${{ suggestedPrice.toFixed(2) }}
            </button>
          </div>
          
          <!-- Price Suggestions Panel -->
          <div v-if="showSuggestions && (suggestedPrice || priceSuggestions.length > 0)" 
               class="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 class="text-sm font-medium text-gray-700 mb-2">💡 Price Suggestions</h4>
            
            <!-- Primary Suggestion -->
            <div v-if="suggestedPrice" class="mb-2">
              <button
                type="button"
                @click="applySuggestedPrice"
                class="w-full text-left p-2 bg-blue-100 border border-blue-200 rounded hover:bg-blue-200 transition-colors"
              >
                <div class="flex justify-between items-center">
                  <span class="text-sm font-medium text-blue-800">
                    {{ priceSource }}
                  </span>
                  <span class="font-bold text-blue-900">${{ suggestedPrice.toFixed(2) }} CAD</span>
                </div>
                <div class="text-xs text-blue-600 mt-1">{{ priceReason }}</div>
              </button>
            </div>

            <!-- Additional Price Points -->
            <div v-if="priceSuggestions.length > 0" class="space-y-1">
              <div class="text-xs text-gray-600 mb-1">Other price points:</div>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="suggestion in priceSuggestions.slice(0, 4)"
                  :key="suggestion.source"
                  type="button"
                  @click="form.price = suggestion.price.toFixed(2)"
                  class="text-xs p-2 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  <div class="font-medium">{{ suggestion.label }}</div>
                  <div class="text-gray-600">${{ suggestion.price.toFixed(2) }}</div>
                </button>
              </div>
            </div>

            <!-- Market Context -->
            <div v-if="marketStats" class="mt-3 pt-2 border-t border-gray-200">
              <div class="text-xs text-gray-600 space-y-1">
                <div>Market Range: ${{ marketStats.lowest.toFixed(2) }} - ${{ marketStats.highest.toFixed(2) }}</div>
                <div>Average: ${{ marketStats.average.toFixed(2) }} • {{ totalListings }} active listings</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Quantity -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
          <input v-model="form.quantity" type="number" min="1" required 
            class="input-field" placeholder="1" />
        </div>

        <!-- Market Price Reference -->
        <div class="bg-blue-50 border border-blue-200 rounded p-3">
          <div class="flex justify-between items-center">
            <div>
              <p class="text-sm text-blue-800">
                Market price: ${{ card.market_price || '0.00' }} CAD
              </p>
              <p v-if="card.market_price_source" class="text-xs text-blue-600">
                Based on {{ getMarketPriceSourceLabel(card.market_price_source) }}
              </p>
            </div>
            <button
              type="button"
              @click="refreshPriceSuggestions"
              :disabled="loadingSuggestions"
              class="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {{ loadingSuggestions ? 'Updating...' : 'Refresh' }}
            </button>
          </div>
          
          <div v-if="lastUpdated" class="text-xs text-blue-600 mt-1">
            Prices updated {{ lastUpdated }}
          </div>

          <!-- Market Price Quality Indicator -->
          <div v-if="card.market_price_source" class="mt-2">
            <div class="flex items-center text-xs">
              <div 
                class="w-2 h-2 rounded-full mr-2"
                :class="getMarketPriceQualityColor(card.market_price_source)"
              ></div>
              <span class="text-gray-600">{{ getMarketPriceQualityText(card.market_price_source) }}</span>
            </div>
          </div>
        </div>

        <!-- Competitive Pricing Alert -->
        <div v-if="form.price && competitivenessAlert" 
             class="p-3 rounded-lg" 
             :class="competitivenessAlert.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' : 'bg-red-50 border border-red-200'">
          <div class="flex items-start space-x-2">
            <div class="text-sm">
              {{ competitivenessAlert.type === 'warning' ? '⚠️' : '🔴' }}
            </div>
            <div class="text-sm" :class="competitivenessAlert.type === 'warning' ? 'text-yellow-800' : 'text-red-800'">
              {{ competitivenessAlert.message }}
            </div>
          </div>
        </div>

        <div class="flex space-x-4 pt-2">
          <button type="button" @click="$emit('close')" 
            class="flex-1 btn-secondary">
            Cancel
          </button>
          <button type="submit" :disabled="loading" 
            class="flex-1 btn-primary disabled:opacity-50">
            {{ loading ? 'Adding...' : 'Add Listing' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'
import { useToast } from 'vue-toastification'
import api from '@/lib/api'

const props = defineProps({
  card: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'added'])
const toast = useToast()

const loading = ref(false)
const loadingSuggestions = ref(false)
const showSuggestions = ref(false)
const form = ref({
  price: '',
  condition: '',
  quantity: 1
})

// Price suggestion data
const currentListings = ref([])
const externalPrices = ref({})
const suggestedPrice = ref(null)
const priceSource = ref('')
const priceReason = ref('')
const priceSuggestions = ref([])
const lastUpdated = ref('')

// Market statistics
const marketStats = computed(() => {
  if (currentListings.value.length === 0) return null
  
  const prices = currentListings.value.map(l => l.price)
  return {
    lowest: Math.min(...prices),
    highest: Math.max(...prices),
    average: prices.reduce((sum, price) => sum + price, 0) / prices.length
  }
})

const totalListings = computed(() => currentListings.value.length)

// Competitive pricing analysis
const competitivenessAlert = computed(() => {
  if (!form.value.price || !currentListings.value.length) return null
  
  const userPrice = parseFloat(form.value.price)
  const lowestPrice = Math.min(...currentListings.value.map(l => l.price))
  
  if (userPrice > lowestPrice * 1.5) {
    return {
      type: 'error',
      message: `Your price is significantly higher than the current lowest price ($${lowestPrice.toFixed(2)}). Consider lowering it for better visibility.`
    }
  }
  
  if (userPrice > lowestPrice * 1.2) {
    return {
      type: 'warning', 
      message: `Your price is 20%+ higher than the current lowest price ($${lowestPrice.toFixed(2)}).`
    }
  }
  
  return null
})

// Condition multipliers for price suggestions
const conditionMultipliers = {
  nm: 1.0,
  lp: 0.85,
  mp: 0.7,
  hp: 0.55,
  dmg: 0.4
}

const calculatePriceSuggestions = () => {
  priceSuggestions.value = []
  
  // Current listings analysis
  if (currentListings.value.length > 0) {
    const sameConditionListings = currentListings.value.filter(l => l.condition === form.value.condition)
    const allConditionPrices = currentListings.value.map(l => l.price)
    
    const lowestPrice = Math.min(...allConditionPrices)
    const averagePrice = allConditionPrices.reduce((sum, p) => sum + p, 0) / allConditionPrices.length
    
    // Same condition average
    if (sameConditionListings.length > 0) {
      const sameConditionAvg = sameConditionListings.reduce((sum, l) => sum + l.price, 0) / sameConditionListings.length
      priceSuggestions.value.push({
        source: 'same_condition',
        label: 'Same Condition Avg',
        price: sameConditionAvg
      })
    }
    
    // Competitive pricing options
    priceSuggestions.value.push(
      { source: 'lowest', label: 'Match Lowest', price: lowestPrice },
      { source: 'undercut', label: 'Undercut by $0.50', price: Math.max(0.5, lowestPrice - 0.5) },
      { source: 'average', label: 'Market Average', price: averagePrice }
    )
  }
  
  // External price suggestions
  if (externalPrices.value.prices) {
    const extPrices = Object.values(externalPrices.value.prices).filter(p => p > 0)
    if (extPrices.length > 0) {
      const conditionMultiplier = conditionMultipliers[form.value.condition] || 1.0
      const avgExternalPrice = extPrices.reduce((sum, p) => sum + p, 0) / extPrices.length * conditionMultiplier
      
      priceSuggestions.value.push({
        source: 'external_avg',
        label: 'Ext. Market Avg',
        price: avgExternalPrice
      })
    }
  }
  
  // Remove duplicates and sort
  priceSuggestions.value = priceSuggestions.value
    .filter((suggestion, index, self) => 
      index === self.findIndex(s => Math.abs(s.price - suggestion.price) < 0.01)
    )
    .sort((a, b) => a.price - b.price)
}

const calculateSuggestedPrice = () => {
  if (!form.value.condition) return
  
  // Priority 1: Lowest current listing for competitive pricing
  if (currentListings.value.length > 0) {
    const sameConditionListings = currentListings.value.filter(l => l.condition === form.value.condition)
    
    if (sameConditionListings.length > 0) {
      const lowestSameCondition = Math.min(...sameConditionListings.map(l => l.price))
      suggestedPrice.value = lowestSameCondition - 0.25 // Slightly undercut
      priceSource.value = 'Competitive Pricing'
      priceReason.value = `$0.25 below lowest ${form.value.condition.toUpperCase()} listing`
    } else {
      // No same condition listings, adjust lowest listing by condition
      const lowestListing = Math.min(...currentListings.value.map(l => l.price))
      const conditionMultiplier = conditionMultipliers[form.value.condition] || 1.0
      suggestedPrice.value = lowestListing * conditionMultiplier
      priceSource.value = 'Condition Adjusted'
      priceReason.value = `Adjusted from lowest listing for ${form.value.condition.toUpperCase()} condition`
    }
  } 
  // Priority 2: External market data
  else if (externalPrices.value.prices) {
    const prices = Object.values(externalPrices.value.prices).filter(p => p > 0)
    if (prices.length > 0) {
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length
      const conditionMultiplier = conditionMultipliers[form.value.condition] || 1.0
      suggestedPrice.value = avgPrice * conditionMultiplier
      priceSource.value = 'Market Data'
      priceReason.value = `Based on external market prices for ${form.value.condition.toUpperCase()} condition`
    }
  }
  // Priority 3: Card's market price
  else if (props.card.market_price) {
    const conditionMultiplier = conditionMultipliers[form.value.condition] || 1.0
    suggestedPrice.value = parseFloat(props.card.market_price) * conditionMultiplier
    priceSource.value = 'Market Price'
    priceReason.value = `Based on card market price adjusted for ${form.value.condition.toUpperCase()}`
  }
}

const applySuggestedPrice = () => {
  if (suggestedPrice.value) {
    form.value.price = suggestedPrice.value.toFixed(2)
    showSuggestions.value = false
  }
}

const onConditionChange = () => {
  calculateSuggestedPrice()
  calculatePriceSuggestions()
}

const fetchCurrentListings = async () => {
  try {
    const response = await api.get(`/cards/${props.card.id}/listings`)
    currentListings.value = response.data.filter(listing => 
      listing.status === 'active' && listing.quantity > 0
    )
  } catch (error) {
    console.error('Error fetching current listings:', error)
  }
}

const fetchPriceSuggestions = async () => {
  if (!form.value.condition) return
  
  try {
    const response = await api.get(`/cards/${props.card.id}/price-suggestions`, {
      params: { condition: form.value.condition }
    })
    
    const data = response.data
    
    // Set primary suggestion
    if (data.primary_suggestion) {
      suggestedPrice.value = data.primary_suggestion.price
      priceSource.value = data.primary_suggestion.label
      priceReason.value = data.primary_suggestion.reason
    }
    
    // Set additional suggestions
    priceSuggestions.value = data.suggestions || []
    
    // Update market stats
    marketStats.value = data.market_stats
    
    lastUpdated.value = new Date().toLocaleString()
    
  } catch (error) {
    console.error('Error fetching price suggestions:', error)
    // Fallback to basic calculation if API fails
    calculateSuggestedPrice()
    calculatePriceSuggestions()
  }
}

const fetchExternalPrices = async () => {
  try {
    const response = await api.get(`/cards/${props.card.id}/external-prices`)
    externalPrices.value = response.data
  } catch (error) {
    console.error('Error fetching external prices:', error)
  }
}

const refreshPriceSuggestions = async () => {
  loadingSuggestions.value = true
  try {
    await Promise.all([
      fetchCurrentListings(), 
      fetchPriceSuggestions(),
      fetchExternalPrices()
    ])
  } finally {
    loadingSuggestions.value = false
  }
}

/* const onConditionChange = async () => {
  // Clear current price when condition changes
  form.value.price = ''
  suggestedPrice.value = null
  
  // Fetch new suggestions for the selected condition
  if (form.value.condition) {
    loadingSuggestions.value = true
    try {
      await fetchPriceSuggestions()
    } finally {
      loadingSuggestions.value = false
    }
  }
} */

const handleSubmit = async () => {
  loading.value = true
  try {
    const response = await api.post('/seller/listings', {
      card_id: props.card.id,
      price: parseFloat(form.value.price),
      condition: form.value.condition,
      quantity: parseInt(form.value.quantity)
    })
    
    toast.success('Listing added successfully!')
    emit('added', response.data)
    emit('close')
  } catch (error) {
    console.error('Error creating listing:', error)
    toast.error(error.response?.data?.error || 'Failed to create listing')
  } finally {
    loading.value = false
  }
}

// Auto-hide suggestions when clicking outside
const getMarketPriceSourceLabel = (source) => {
  const labels = {
    'sales_average': 'recent platform sales',
    'current_listings': 'current market listings', 
    'external_scryfall': 'external market data',
    'calculated': 'automated calculation',
    'rarity_default': 'estimated from rarity',
    'minimum_fallback': 'minimum default',
    'manual': 'manual entry',
    'existing_price': 'previous data'
  }
  return labels[source] || 'unknown source'
}

const getMarketPriceQualityColor = (source) => {
  const colors = {
    'sales_average': 'bg-green-500',     // High confidence - actual sales
    'current_listings': 'bg-yellow-500', // Medium confidence - market listings
    'calculated': 'bg-blue-500',        // Medium confidence - calculated
    'external_scryfall': 'bg-orange-500', // Medium confidence - external data
    'rarity_default': 'bg-gray-400',    // Low confidence - estimated
    'minimum_fallback': 'bg-red-400',   // Low confidence - fallback
    'manual': 'bg-purple-500',          // Manual entry
    'existing_price': 'bg-gray-400'     // Unknown confidence
  }
  return colors[source] || 'bg-gray-400'
}

const getMarketPriceQualityText = (source) => {
  const quality = {
    'sales_average': 'High accuracy - based on recent sales',
    'current_listings': 'Good accuracy - based on current market',
    'calculated': 'Good accuracy - automatically calculated', 
    'external_scryfall': 'Fair accuracy - external market data',
    'rarity_default': 'Estimated - based on card rarity',
    'minimum_fallback': 'Estimated - fallback pricing',
    'manual': 'Manually set price',
    'existing_price': 'Legacy pricing data'
  }
  return quality[source] || 'Unknown accuracy'
}

// Load initial data
onMounted(async () => {
  await fetchCurrentListings()
  await fetchExternalPrices()
})

// Watch for condition changes and recalculate
watch(() => form.value.condition, onConditionChange)
</script>

<style scoped>
.input-field {
  @apply w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500;
}

.btn-primary {
  @apply bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors;
}

.btn-secondary {
  @apply bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors;
}
</style>