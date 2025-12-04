<!-- Updated CardDetail.vue with Scryfall Integration -->
<template>
  <div v-if="displayedCard" class="">
    <div class="grid grid-cols-1 md:grid-cols-2  gap-2 md:gap-8">
      <!-- Card Image with enhanced double-faced card support -->
      <div class="mb-6">
        <img :src="currentImageUrl" :alt="displayedCard.name"
          class="w- md:w-full md:max-w-md mx-auto rounded-lg shadow-lg" />
        <!-- Enhanced Double-faced card interface -->
        <div v-if="hasMultipleFaces" class="mt-4">
          <p class="text-sm font-medium text-gray-700 text-center mb-3">Double-faced card:</p>

          <!-- Face Selection Buttons -->
          <div class="flex justify-center space-x-2 mb-3">
            <button v-for="(face, index) in card.card_faces" :key="`btn-${index}`" @click="selectCardFace(index)"
              :class="[
                'px-3 py-2 rounded-lg font-medium transition-all text-sm',
                selectedFaceIndex === index
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              ]">
              {{ getFaceName(index) }}
            </button>
          </div>

          <!-- Face Preview Thumbnails -->
          <div class="grid grid-cols-2 gap-2 w-80 md:max-w-md mx-auto">
            <div v-for="(face, index) in card.card_faces" :key="`thumb-${index}`" @click="selectCardFace(index)" :class="[
              'cursor-pointer rounded-lg border-2 transition-all overflow-hidden',
              selectedFaceIndex === index
                ? 'border-blue-500 shadow-lg ring-2 ring-blue-200'
                : 'border-gray-300 hover:border-gray-400 hover:shadow-md'
            ]">
              <img :src="face.image_url" :alt="face.name"
                class="w-full rounded-md transition-transform hover:scale-105" />
              <div class="p-2 bg-white">
                <p class="text-xs font-medium text-center truncate">{{ face.name }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>



      <!-- Enhanced Card Information -->
      <div class="space-y-4">
        <div class="flex items-center gap-3 flex-wrap">
          <h2 class="text-2xl font-bold">{{ card.name }}</h2>
        </div>

        <!-- Treatment Badges Section - Combined into one component call -->
        <div class="flex flex-wrap gap-2">
          <!-- Card Treatment (foil, etched, etc.) -->
          <TreatmentBadge v-if="displayedCard.treatment && displayedCard.treatment !== 'foil'" :treatment="displayedCard.treatment" />
          
          <!-- Border Treatment (borderless) -->
          <TreatmentBadge v-if="displayedCard.border_color === 'borderless'" treatment="borderless" />
          
          <!-- Frame Effects (showcase, extended-art, etc.) -->
          <TreatmentBadge v-if="displayedCard.frame_effects" :treatment="displayedCard.frame_effects" />
          
          <!-- Promo Types -->
          <TreatmentBadge v-if="displayedCard.promo_types && displayedCard.promo_types !== 'universesbeyond'" :treatment="displayedCard.promo_types" />
        </div>

        <!-- Enhanced Card Details Grid -->

        <div class="grid">
          <div class="flex">
            <!--Set Icon Image-->
            <SetIcon :setCode="displayedCard.set_number" />
            <!--Set Name-->
            <h5 class="text-md px-2">
              {{ displayedCard.set_name }} ({{ displayedCard.set_number.toUpperCase() }})
            </h5>
          </div>

          <div class="">
            <!--Card Number / Rarity Name / Foil-->
            <span class="text-xs capitalize">
              #{{ displayedCard.card_number }} | {{ displayedCard.rarity?.replace('_', ' ') }} | {{ card.foil ? 'Foil'
                : null }} {{ card.foil && card.nonfoil ? '/' : null }} {{ card.nonfoil ? 'NonFoil' : null }}
            </span>
          </div>
          <div class="p-2">
            <hr />
          </div>

          <div class="text-sm" v-if="hasMultipleFaces">{{ displayedCard.name }}</div>
          <div class="grid grid-cols-2 gap-1 bg-gray-200 p-2 rounded-lg text-sm">

            <!--Card Face Details-->
            <p class="col-span-2" v-if="displayedCard.type_line !== null">{{
              displayedCard.type_line }}</p>

            <ManaCostDisplay :mana-cost="displayedCard.mana_cost" size="large" />

            <p v-if="displayedCard.power !== null && displayedCard.toughness !== null">{{
              displayedCard.power }}/{{ displayedCard.toughness }}</p>

            <p v-if="displayedCard.loyalty !== null">{{
              displayedCard.loyalty }}</p>

          </div>

          <!--Oracle Text-->
          <div v-if="displayedCard.oracle_text" class=" bg-gray-100 p-3 rounded-lg">
            <div class="text-sm leading-relaxed">
              <ManaCostInText :text="displayedCard.oracle_text" size="small" :preserve-newlines="true" />
            </div>
            <div v-if="displayedCard.flavor_text" class="text-sm py-3">
              <i>"{{ displayedCard.flavor_text }}"</i>
            </div>
          </div>

          <!--Misc Card Details-->
          <div class="grid grid-cols-2 p-2">
            <div v-if="displayedCard.released_at" class="text-xs font-mono"><strong>Released:</strong> {{
              formatDate(displayedCard.released_at)
            }}
            </div>
            <div v-if="displayedCard.artist" class="text-xs font-mono"><strong>Artist:</strong> {{
              displayedCard.artist }}
            </div>
          </div>
        </div>

        <div class="mt-6">
          <WishlistButton :card-id="displayedCard.id" />
        </div>

        <!-- Cheapest Listing Section -->
        <div v-if="cheapestListing" class="mt-4">
          <CardListing
            :listing="cheapestListing"
            :is-cheapest="true"
            :adding-to-cart="addingToCart"
            :was-recently-added="wasRecentlyAdded(cheapestListing.id)"
            :is-in-cart="isListingInCart(cheapestListing)"
            :is-authenticated="authStore.isAuthenticated"
            :is-own-listing="cheapestListing.seller_id === authStore.user?.id"
            :disabled="isAddToCartDisabled(cheapestListing)"
            :shipping-cost="calculateShippingCost(cheapestListing)"
            @add-to-cart="addToCartWithQuantity"
          />
        </div>

        <!-- View Other Listings Button -->
        <div v-if="otherListings.length > 0" class="mt-3">
          <button
            @click="scrollToListings"
            class="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border border-gray-300 text-sm font-medium text-gray-700"
          >
            View {{ otherListings.length }} Other Listing{{ otherListings.length !== 1 ? 's' : '' }}
            <span v-if="otherListings.length > 0" class="ml-2 text-gray-600">
              (from ${{ Math.min(...otherListings.map(l => l.price)).toFixed(2) }})
            </span>
          </button>
        </div>

        <div v-if="card && card.oracle_id">
          <CardVersions :oracle-id="card.oracle_id" :current-card-id="card.id" />
        </div>
        <!-- Wishlist Button -->


        <!-- Enhanced Price Comparison -->
        <div class="bg-gray-100 p-4 rounded" style="display:none;">
          <h3 class="font-semibold mb-2">Market Price Comparison</h3>
          <div class="space-y-2">
            <!-- Platform Price -->
            <div class="flex justify-between items-center">
              <span class="text-sm font-medium text-gray-700">Our Platform</span>
              <span class="font-semibold text-green-600">
                ${{ displayedCard.market_price?.toFixed(2) || 'N/A' }}
              </span>
            </div>

            <!-- External Prices from Scryfall integration -->
            <div v-if="displayedCard.prices?.usd" class="flex justify-between items-center">
              <span class="text-sm text-gray-600">Scryfall (USD)</span>
              <span class="text-gray-800">${{ parseFloat(displayedCard.prices.usd).toFixed(2) }}</span>
            </div>

            <div v-if="displayedCard.prices?.usd_foil" class="flex justify-between items-center">
              <span class="text-sm text-gray-600">Scryfall Foil (USD)</span>
              <span class="text-gray-800">${{ parseFloat(displayedCard.prices.usd_foil).toFixed(2) }}</span>
            </div>

            <div v-if="displayedCard.prices?.eur" class="flex justify-between items-center">
              <span class="text-sm text-gray-600">Cardmarket (EUR)</span>
              <span class="text-gray-800">€{{ parseFloat(displayedCard.prices.eur).toFixed(2) }}</span>
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
        <div class="bg-blue-50 p-4 rounded" style="display:none;">
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

    <div class="space-y-6">
      <!-- All Listings Section -->
      <div id="all-listings" class="bg-gray-50 rounded-lg shadow p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold">
            {{ cheapestListing ? 'Other Listings' : 'Current Listings' }}
          </h2>

          <!-- Create Listing Button for Sellers -->
          <div class="flex items-center space-x-2">
            <button v-if="authStore.isAuthenticated && (authStore.isSeller || authStore.isApproved)"
              @click="handleCreateListing" :disabled="creatingListing"
              class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
              </svg>
              <span>Create Listing</span>
            </button>

            <!-- Not a seller message -->
            <div v-else-if="authStore.isAuthenticated && !authStore.isSeller && !authStore.isApproved"
              class="text-sm text-gray-500 text-center">
              <p class="mb-1">Want to sell cards?</p>
              <router-link to="/seller" class="text-blue-600 hover:text-blue-800 underline">
                Apply to become a seller
              </router-link>
            </div>

            <!-- Not logged in message -->
            <div v-else-if="!authStore.isAuthenticated" class="text-sm text-gray-500 text-center">
              <p class="mb-1">Want to list this card?</p>
              <router-link to="/auth" class="text-blue-600 hover:text-blue-800 underline">
                Sign in to create listings
              </router-link>
            </div>
          </div>
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

        <!-- Error Message for Listing Creation -->
        <div v-if="listingError" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-red-600 text-sm">{{ listingError }}</p>
        </div>

        <!-- Display listings (other listings if cheapest exists, all listings otherwise) -->
        <div class="space-y-2 md:space-y-3">
          <CardListing
            v-for="listing in (cheapestListing ? otherListings : filteredAndSortedListings)"
            :key="listing.id"
            :listing="listing"
            :is-cheapest="false"
            :adding-to-cart="addingToCart"
            :was-recently-added="wasRecentlyAdded(listing.id)"
            :is-in-cart="isListingInCart(listing)"
            :is-authenticated="authStore.isAuthenticated"
            :is-own-listing="listing.seller_id === authStore.user?.id"
            :disabled="isAddToCartDisabled(listing)"
            :shipping-cost="calculateShippingCost(listing)"
            @add-to-cart="addToCartWithQuantity"
          />
        </div>

        <!-- Show message for seller's own listings -->
        <div v-if="(cheapestListing ? otherListings : filteredAndSortedListings).length === 0 && listings.some(l => l.seller_id === authStore.user?.id)"
          class="text-center py-4 text-gray-500">
          <div class="text-lg mb-2">This is your listing</div>
          <div class="text-sm">You cannot purchase your own cards</div>
        </div>

        <!-- Show message when no listings match filters -->
        <div v-else-if="(cheapestListing ? otherListings : filteredAndSortedListings).length === 0 && listings.length > 0"
          class="text-center py-4 text-gray-500">
          No listings match your filters
        </div>

        <!-- Show message when no listings exist -->
        <div v-else-if="listings.length === 0" class="text-center py-8 text-gray-500">
          <div class="text-lg mb-2">No listings available</div>
          <div class="text-sm">Be the first to list this card!</div>
        </div>

      </div>

      <!-- Add Listing Modal -->
      <AddListingModal v-if="showAddListing" :card="displayedCard" @close="showAddListing = false"
        @added="onListingCreated" @error="onListingError" />
    </div>
  </div>
</template>

<script setup>
  import { ref, onMounted, computed, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useAuthStore } from '@/stores/auth'
  import { useCartStore } from '@/stores/cart'
  import { useToast } from 'vue-toastification'
  import api from '@/lib/api'
  import PriceTrendChart from '@/components/PriceTrendChart.vue'
  import PriceComparisonChart from '@/components/PriceComparisonChart.vue'
  import AddListingModal from '@/components/AddListingModal.vue'
  import WishlistButton from '@/components/WishlistButton.vue'
  import TreatmentBadge from '../components/TreatmentBadge.vue'
  import ManaCostDisplay from '../components/ManaCostDisplay.vue'
  import ManaCostInText from '../components/ManaCostInText.vue'
  import CardVersions from '@/components/CardVersions.vue'
  import SetIcon from '@/components/SetIcon.vue'
  import CardListing from '@/components/CardListing.vue'
  import { useCardSeo } from '@/composables/useSeo'


  const route = useRoute()
  const router = useRouter()
  const authStore = useAuthStore()

  // Original reactive data
  const card = ref(null)
  const listings = ref([])
  const priceHistory = ref([])
  const externalPrices = ref({})
  const showAddListing = ref(false)
  const selectedCondition = ref('')
  const sortBy = ref('price')

  // New reactive data for card face selection
  const selectedFaceIndex = ref(0)
  const displayedCard = ref(null)
  const currentImageUrl = ref('')

  // Loading and error states for listing creation
  const creatingListing = ref(false)
  const listingError = ref('')

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

  // Get the cheapest listing (always show, including user's own listings)
  const cheapestListing = computed(() => {
    if (listings.value.length === 0) return null

    const availableListings = listings.value.filter(listing =>
      listing.status === 'active' &&
      listing.quantity > 0
    )

    if (availableListings.length === 0) return null

    return availableListings.reduce((cheapest, current) =>
      current.price < cheapest.price ? current : cheapest
    )
  })

  // Get other listings (excluding the cheapest)
  const otherListings = computed(() => {
    if (!cheapestListing.value) return filteredAndSortedListings.value

    return filteredAndSortedListings.value.filter(
      listing => listing.id !== cheapestListing.value.id
    )
  })

  // New computed properties for card faces
  const hasMultipleFaces = computed(() => {
    return card.value && card.value.card_faces && card.value.card_faces.length > 1
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



  // Enhanced selectCardFace method
  const selectCardFace = (faceIndex) => {
    // Validate input
    if (!card.value || !card.value.card_faces || !Array.isArray(card.value.card_faces)) {
      console.warn('No card faces available')
      return
    }

    // Validate face index
    if (faceIndex < 0 || faceIndex >= card.value.card_faces.length) {
      console.warn('Invalid face index:', faceIndex)
      return
    }

    // Set the selected face index
    selectedFaceIndex.value = faceIndex

    // Get the selected face data
    const selectedFace = card.value.card_faces[faceIndex]

    // Update the displayed card data with the selected face information
    displayedCard.value = {
      // Keep original card properties that don't change
      id: card.value.id,
      scryfall_id: card.value.scryfall_id,
      set_number: card.value.set_number,
      card_number: card.value.card_number,
      rarity: card.value.rarity,
      treatment: card.value.treatment,
      layout: card.value.layout,
      prices: card.value.prices,
      artist: card.value.artist,

      // Override with face-specific data
      name: selectedFace.name || card.value.name,
      mana_cost: selectedFace.mana_cost || card.value.mana_cost || '',
      type_line: selectedFace.type_line || card.value.type_line || '',
      oracle_text: selectedFace.oracle_text || card.value.oracle_text || '',
      flavor_text: selectedFace.flavor_text || card.value.flavor_text || '',
      image_url: selectedFace.image_url || card.value.image_url,
      image_url_small: selectedFace.image_url || card.value.image_url_small,
      image_url_large: selectedFace.image_url || card.value.image_url_large,

      // Face-specific stats (may not exist for all card types)
      power: selectedFace.power !== undefined ? selectedFace.power : card.value.power,
      toughness: selectedFace.toughness !== undefined ? selectedFace.toughness : card.value.toughness,
      loyalty: selectedFace.loyalty !== undefined ? selectedFace.loyalty : card.value.loyalty,

      // Keep the original card_faces array for navigation
      card_faces: card.value.card_faces,

      // Preserve other original properties
      market_price: card.value.market_price,
      set_name: card.value.set_name,
      cmc: selectedFace.cmc || card.value.cmc,
      keywords: selectedFace.keywords || card.value.keywords,
      border_color: card.value.border_color,
      frame_effects: card.value.frame_effects,
      promo_types: card.value.promo_types,
      released_at: card.value.released_at
    }

    // Update the current image source for display
    currentImageUrl.value = selectedFace.image_url || card.value.image_url

    // Optional: Update URL hash or query parameter to preserve face selection on page reload
    if (window.history.replaceState) {
      const url = new URL(window.location)
      url.searchParams.set('face', faceIndex)
      window.history.replaceState({}, '', url)
    }

    console.log('Selected card face:', faceIndex, selectedFace)
  }

  // Helper function to get face names
  const getFaceName = (faceIndex) => {
    if (!card.value?.card_faces?.[faceIndex]) return `Face ${faceIndex + 1}`
    return card.value.card_faces[faceIndex].name || `Face ${faceIndex + 1}`
  }

  // Helper functions
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString()
  }

  const cartStore = useCartStore()
  const toast = useToast()
  const addingToCart = ref(false)
  const addedToCart = ref(new Set()) // Track which listings were added

  const addToCartWithQuantity = async ({ listing, quantity }) => {
    // Check if user is authenticated
    if (!authStore.isAuthenticated) {
      toast.error('Please sign in to add items to cart')
      router.push({ name: 'Auth', query: { redirect: route.fullPath } })
      return
    }

    // Prevent adding seller's own listings
    if (listing.seller_id === authStore.user?.id) {
      toast.error('You cannot purchase your own listings')
      return
    }

    // Check if already in cart
    if (isListingInCart.value(listing)) {
      toast.warning('This item is already in your cart')
      return
    }

    // Check listing availability
    if (listing.quantity <= 0 || listing.status !== 'active') {
      toast.error('This listing is no longer available')
      return
    }

    addingToCart.value = true

    try {
      await cartStore.addItem(listing.id, quantity)
      addedToCart.value.add(listing.id)

      toast.success(`Added ${quantity}x ${listing.cards?.name || 'card'} to cart`, {
        timeout: 3000,
        icon: '🛒'
      })

      // Auto-remove the "added" state after 3 seconds
      setTimeout(() => {
        addedToCart.value.delete(listing.id)
      }, 3000)

    } catch (error) {
      console.error('Error adding to cart:', error)

      if (error.response?.status === 409) {
        toast.warning('This item is already in your cart')
      } else if (error.response?.status === 400) {
        toast.error(error.response.data.error || 'Unable to add item to cart')
      } else {
        toast.error('Failed to add item to cart. Please try again.')
      }
    } finally {
      addingToCart.value = false
    }
  }

  // Helper function to check if a listing was recently added
  const wasRecentlyAdded = (listingId) => {
    return addedToCart.value.has(listingId)
  }

  // Calculate shipping cost based on listing/seller location
  const calculateShippingCost = (listing) => {
    // Free shipping for listings over $50
    if (listing.price >= 50) {
      return 0
    }
    // Standard shipping cost
    return 5.00
  }

  // Function to check if button should be disabled
  const isAddToCartDisabled = (listing) => {
    return addingToCart.value ||
      isListingInCart.value(listing) ||
      listing.seller_id === authStore.user?.id ||
      listing.quantity <= 0 ||
      listing.status !== 'active'
  }


  // Scroll to the all listings section
  const scrollToListings = () => {
    const listingsSection = document.getElementById('all-listings')
    if (listingsSection) {
      listingsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Enhanced listing creation handler
  const handleCreateListing = () => {
    // Reset any previous errors
    listingError.value = ''

    // Check authentication and seller status
    if (!authStore.isAuthenticated) {
      listingError.value = 'Please sign in to create listings'
      return
    }

    if (!authStore.isSeller && !authStore.isApproved) {
      listingError.value = 'You must be an approved seller to create listings'
      return
    }

    // Open the listing modal
    showAddListing.value = true
  }
  //Check if the listing is already in the cart.
  const isListingInCart = computed(() => (listing) => {
    return cartStore.isInCart(listing.id)
  })

  // Handle successful listing creation
  const onListingCreated = async (newListing) => {
    showAddListing.value = false
    listingError.value = ''

    // Refresh the listings to show the new one
    await fetchListings()

    // Show success message (you can integrate with your toast/notification system)
    console.log('Listing created successfully:', newListing)
  }

  // Handle listing creation errors
  const onListingError = (error) => {
    listingError.value = error.message || 'Failed to create listing'
    console.error('Listing creation error:', error)
  }

  // Enhanced card data for SEO
  const cardForSeo = computed(() => {
    if (!card.value || !displayedCard.value) return null

    return {
      ...displayedCard.value,
      lowest_price: cheapestListing.value?.price,
      highest_price: listings.value.length > 0 ? Math.max(...listings.value.map(l => l.price)) : null,
      listing_count: listings.value.length,
      in_stock: listings.value.some(l => l.status === 'active' && l.quantity > 0)
    }
  })

  // Apply SEO meta tags
  useCardSeo(cardForSeo)

  // Watch for changes to the main card data and initialize the displayed card
  watch(card, (newCard) => {
    if (newCard) {
      // Check URL for face parameter
      const faceParam = route.query.face
      const initialFace = faceParam ? parseInt(faceParam) : 0

      // Initialize with the specified face or the main card data
      if (newCard.card_faces && newCard.card_faces.length > 0) {
        const validFaceIndex = Math.max(0, Math.min(initialFace, newCard.card_faces.length - 1))
        selectCardFace(validFaceIndex)
      } else {
        // For single-faced cards, just use the card data directly
        displayedCard.value = { ...newCard }
        currentImageUrl.value = newCard.image_url || newCard.image_url_large
      }
    }
  }, { immediate: true })

  // Watch for route parameter changes to refetch data when navigating between card versions
  watch(() => route.params.id, async (newId, oldId) => {
    if (newId && newId !== oldId) {
      // Reset state
      card.value = null
      listings.value = []
      displayedCard.value = null
      selectedFaceIndex.value = 0
      addedToCart.value.clear()

      // Fetch new card data
      await fetchCard()
      await fetchListings()
      await fetchPriceHistory()
      await fetchExternalPrices()
    }
  })

  onMounted(async () => {
    await fetchCard()
    await fetchListings()
    await fetchPriceHistory()
    await fetchExternalPrices()
  })
</script>