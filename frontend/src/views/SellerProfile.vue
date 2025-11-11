<template>
  <div class="max-w-6xl mx-auto px-4 py-8">
    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center items-center min-h-96">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <h2 class="text-xl font-semibold text-red-800 mb-2">Error Loading Seller Profile</h2>
      <p class="text-red-600">{{ error }}</p>
    </div>

    <!-- Seller Profile -->
    <div v-else-if="sellerData" class="space-y-6">
      <!-- Header Section -->
      <div class="bg-white rounded-lg shadow-md p-6">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-3xl font-bold text-gray-900">{{ sellerData.seller.display_name }}</h1>
          <div class="text-right">
            <div class="text-sm text-gray-600">Member Since</div>
            <div class="text-lg font-medium">{{ formatDate(sellerData.seller.created_at) }}</div>
          </div>
        </div>

        <div class="flex items-center gap-2 text-gray-700">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
          </svg>
          <span>{{ sellerData.seller.location }}</span>
        </div>
      </div>

      <!-- Stats Section -->
      <div class="bg-white rounded-lg shadow-md p-6">
        <h2 class="text-xl font-bold text-gray-900 mb-4">Seller Statistics</h2>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Positive Rating -->
          <div class="text-center p-4 bg-green-50 rounded-lg">
            <div class="text-4xl font-bold text-green-600">{{ sellerData.stats.positive_percentage }}%</div>
            <div class="text-sm text-gray-600 mt-1">Positive Rating</div>
            <div class="text-xs text-gray-500 mt-1">{{ sellerData.stats.total_reviews }} ratings</div>
          </div>

          <!-- Completed Sales -->
          <div class="text-center p-4 bg-blue-50 rounded-lg">
            <div class="text-4xl font-bold text-blue-600">{{ sellerData.stats.completed_sales }}</div>
            <div class="text-sm text-gray-600 mt-1">Completed Sales</div>
          </div>

          <!-- Active Listings -->
          <div class="text-center p-4 bg-purple-50 rounded-lg">
            <div class="text-4xl font-bold text-purple-600">{{ sellerData.stats.active_listings }}</div>
            <div class="text-sm text-gray-600 mt-1">Active Listings</div>
          </div>
        </div>

        <!-- Rating Breakdown -->
        <div class="mt-6 border-t pt-6">
          <h3 class="font-semibold text-gray-900 mb-3">Rating Breakdown</h3>
          <div class="space-y-2">
            <div v-for="rating in [5, 4, 3, 2, 1]" :key="rating" class="flex items-center gap-3">
              <div class="flex items-center gap-1 w-24">
                <span class="text-sm font-medium text-gray-700">{{ rating }}</span>
                <svg class="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
              <div class="flex-1 bg-gray-200 rounded-full h-3">
                <div
                  class="bg-yellow-500 h-3 rounded-full transition-all"
                  :style="{ width: getRatingPercentage(rating) + '%' }"
                ></div>
              </div>
              <span class="text-sm text-gray-600 w-12 text-right">{{ sellerData.stats.rating_breakdown[rating] || 0 }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Reviews -->
      <div v-if="sellerData.recent_reviews.length > 0" class="bg-white rounded-lg shadow-md p-6">
        <h2 class="text-xl font-bold text-gray-900 mb-4">Recent Reviews</h2>
        <div class="space-y-4">
          <div v-for="review in sellerData.recent_reviews" :key="review.created_at" class="border-b pb-4 last:border-b-0">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <div class="flex">
                  <svg v-for="star in 5" :key="star" class="w-4 h-4" :class="star <= review.rating ? 'text-yellow-500' : 'text-gray-300'" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                <span class="text-sm font-medium text-gray-700">{{ review.reviewer?.display_name || 'Anonymous' }}</span>
              </div>
              <span class="text-xs text-gray-500">{{ formatDate(review.created_at) }}</span>
            </div>
            <p v-if="review.comment" class="text-sm text-gray-700">{{ review.comment }}</p>
          </div>
        </div>
      </div>

      <!-- Active Listings -->
      <div class="bg-white rounded-lg shadow-md p-6">
        <h2 class="text-xl font-bold text-gray-900 mb-4">Active Listings</h2>

        <div v-if="sellerData.listings.length === 0" class="text-center py-8 text-gray-500">
          This seller currently has no active listings.
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <router-link
            v-for="listing in sellerData.listings"
            :key="listing.id"
            :to="`/card/${listing.cards.id}`"
            class="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            <div class="flex gap-3">
              <img
                v-if="listing.cards.image_url_small"
                :src="listing.cards.image_url_small"
                :alt="listing.cards.name"
                class="w-16 h-22 object-cover rounded"
              />
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-gray-900 truncate">{{ listing.cards.name }}</h3>
                <p class="text-xs text-gray-600 mt-1">{{ listing.cards.set_name }}</p>
                <div class="flex items-center gap-2 mt-2 flex-wrap">
                  <span class="text-lg font-bold text-green-600">${{ listing.price }}</span>
                  <span class="text-xs px-2 py-0.5 rounded" :class="getConditionColor(listing.condition)">
                    {{ listing.condition.replace('_', ' ').toUpperCase() }}
                  </span>
                  <span v-if="listing.foil" class="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">
                    FOIL
                  </span>
                </div>
                <p class="text-xs text-gray-500 mt-1">Qty: {{ listing.quantity }}</p>
              </div>
            </div>
          </router-link>
        </div>

        <div v-if="sellerData.listings.length === 20" class="mt-4 text-center">
          <p class="text-sm text-gray-600">Showing 20 most recent listings</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/lib/api'

const route = useRoute()
const loading = ref(true)
const error = ref(null)
const sellerData = ref(null)

const fetchSellerProfile = async () => {
  try {
    loading.value = true
    error.value = null

    const response = await api.get(`/users/seller/${route.params.id}`)
    sellerData.value = response.data
  } catch (err) {
    console.error('Error fetching seller profile:', err)
    error.value = err.response?.data?.error || 'Failed to load seller profile'
  } finally {
    loading.value = false
  }
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

const getRatingPercentage = (rating) => {
  if (!sellerData.value || sellerData.value.stats.total_reviews === 0) return 0

  const count = sellerData.value.stats.rating_breakdown[rating] || 0
  return (count / sellerData.value.stats.total_reviews) * 100
}

const getConditionColor = (condition) => {
  const colors = {
    near_mint: 'bg-green-100 text-green-800',
    lightly_played: 'bg-blue-100 text-blue-800',
    moderately_played: 'bg-yellow-100 text-yellow-800',
    heavily_played: 'bg-orange-100 text-orange-800',
    damaged: 'bg-red-100 text-red-800'
  }
  return colors[condition] || 'bg-gray-100 text-gray-800'
}

onMounted(async () => {
  await fetchSellerProfile()
})
</script>
