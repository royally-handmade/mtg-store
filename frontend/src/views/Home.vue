<template>
  <div class="space-y-8 sm:space-y-12">
    <!-- Hero Section -->
    <section class="text-center py-8 sm:py-12 lg:py-16 bg-gradient-to-r from-red-600 to-violet-600 text-white rounded-lg">
      <div class="max-w-4xl mx-auto px-4 sm:px-6">
        <h1 class="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6">
          MTG Marketplace
        </h1>
        <p class="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 max-w-2xl mx-auto">
          Buy and sell Magic: The Gathering cards with confidence
        </p>
        <div class="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4">
          <router-link 
            to="/cards" 
            class="w-full sm:w-auto bg-white text-red-600 px-6 sm:px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors text-center min-w-[200px]"
          >
            Browse Cards
          </router-link>
          <router-link 
            v-if="!authStore.isAuthenticated" 
            to="/auth" 
            class="w-full sm:w-auto border-2 border-white px-6 sm:px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-red-600 transition-colors text-center min-w-[200px]"
          >
            Get Started
          </router-link>
        </div>
      </div>
    </section>

    <!-- Featured Cards -->
    <section>
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
        <h2 class="text-2xl sm:text-3xl font-bold">Featured Cards</h2>
        <router-link 
          to="/cards" 
          class="text-red-600 hover:text-red-800 font-medium transition-colors"
        >
          View All →
        </router-link>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        <CardPreview v-for="card in featuredCards" :key="card.id" :card="card" />
      </div>
    </section>

    <!-- Statistics Section (Optional - currently commented out) -->
    <!-- 
    <section class="bg-gray-50 rounded-lg p-6 sm:p-8">
      <h2 class="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8">Platform Statistics</h2>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div class="text-center">
          <div class="text-2xl sm:text-3xl font-bold text-red-600">{{ stats.totalCards }}+</div>
          <div class="text-sm sm:text-base text-gray-600 mt-1">Cards Available</div>
        </div>
        <div class="text-center">
          <div class="text-2xl sm:text-3xl font-bold text-green-600">{{ stats.totalSellers }}+</div>
          <div class="text-sm sm:text-base text-gray-600 mt-1">Trusted Sellers</div>
        </div>
        <div class="text-center">
          <div class="text-2xl sm:text-3xl font-bold text-purple-600">{{ stats.totalSales }}+</div>
          <div class="text-sm sm:text-base text-gray-600 mt-1">Successful Sales</div>
        </div>
        <div class="text-center">
          <div class="text-2xl sm:text-3xl font-bold text-red-600">${{ stats.totalValue }}+</div>
          <div class="text-sm sm:text-base text-gray-600 mt-1">Cards Traded</div>
        </div>
      </div>
    </section>
    -->

    <!-- How It Works -->
    <section>
      <h2 class="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">How It Works</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        <div class="text-center px-4">
          <div class="bg-red-100 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <MagnifyingGlassIcon class="h-7 w-7 sm:h-8 sm:w-8 text-red-600" />
          </div>
          <h3 class="text-lg sm:text-xl font-semibold mb-2">Browse & Search</h3>
          <p class="text-sm sm:text-base text-gray-600 leading-relaxed">
            Find the exact cards you need with our powerful search and filtering tools.
          </p>
        </div>
        <div class="text-center px-4">
          <div class="bg-green-100 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingCartIcon class="h-7 w-7 sm:h-8 sm:w-8 text-green-600" />
          </div>
          <h3 class="text-lg sm:text-xl font-semibold mb-2">Buy Safely</h3>
          <p class="text-sm sm:text-base text-gray-600 leading-relaxed">
            Purchase from verified sellers with secure payment processing and buyer protection.
          </p>
        </div>
        <div class="text-center px-4">
          <div class="bg-purple-100 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <TruckIcon class="h-7 w-7 sm:h-8 sm:w-8 text-purple-600" />
          </div>
          <h3 class="text-lg sm:text-xl font-semibold mb-2">Fast Shipping</h3>
          <p class="text-sm sm:text-base text-gray-600 leading-relaxed">
            Get your cards quickly with tracked shipping and real-time updates.
          </p>
        </div>
      </div>
    </section>

    <!-- Recent Activity -->
    <section v-if="recentSales.length > 0">
      <h2 class="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">Recent Sales</h2>
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <div class="divide-y divide-gray-200">
          <div 
            v-for="sale in recentSales" 
            :key="sale.id" 
            class="p-3 sm:p-4 hover:bg-gray-50 transition-colors"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <img 
                  :src="sale.card_image" 
                  :alt="sale.card_name" 
                  class="w-10 h-14 sm:w-12 sm:h-16 object-cover rounded flex-shrink-0" 
                />
                <div class="min-w-0 flex-1">
                  <div class="font-medium text-sm sm:text-base truncate">{{ sale.card_name }}</div>
                  <div class="text-xs sm:text-sm text-gray-600 truncate">
                    {{ sale.condition }} - {{ sale.set_name }}
                  </div>
                </div>
              </div>
              <div class="text-right flex-shrink-0">
                <div class="font-semibold text-sm sm:text-base">${{ sale.price }} CAD</div>
                <div class="text-xs sm:text-sm text-gray-500">{{ formatTimeAgo(sale.sold_at) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { MagnifyingGlassIcon, ShoppingCartIcon, TruckIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import CardPreview from '@/components/CardPreview.vue'
import { useSeo } from '@/composables/useSeo'

// Set SEO meta tags for the home page
useSeo({
  title: 'Coastal Storm Games',
  description: 'Your premier trading card marketplace in the stormy pacific northwest. Build and buy your decklist, create alerts for cards on your buy-list, and get insights compared to other TCG marketplaces.',
  keywords: 'MTG marketplace, Magic The Gathering, buy MTG cards, sell MTG cards, MTG singles, trading cards, snapcaster'
})

const authStore = useAuthStore()

const featuredCards = ref([])
const recentSales = ref([])
const stats = ref({
  totalCards: 0,
  totalSellers: 0,
  totalSales: 0,
  totalValue: 0
})

const fetchHomeData = async () => {
  try {
    const [cardsRes] = await Promise.all([
      api.get('/cards?limit=12'),
    ])

    featuredCards.value = cardsRes.data
  } catch (error) {
    console.error('Error fetching home data:', error)
  }
}

const formatTimeAgo = (date) => {
  const now = new Date()
  const saleDate = new Date(date)
  const diffInHours = Math.floor((now - saleDate) / (1000 * 60 * 60))
  
  if (diffInHours < 1) return 'Just now'
  if (diffInHours < 24) return `${diffInHours}h ago`
  return `${Math.floor(diffInHours / 24)}d ago`
}

onMounted(fetchHomeData)
</script>