<template>
  <div class="space-y-12">
    <!-- Hero Section -->
    <section class="text-center py-12 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg">
      <div class="max-w-4xl mx-auto px-6">
        <h1 class="text-5xl font-bold mb-6">MTG Marketplace</h1>
        <p class="text-xl mb-8">Buy and sell Magic: The Gathering cards with confidence</p>
        <div class="flex justify-center space-x-4">
          <router-link to="/cards" class="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
            Browse Cards
          </router-link>
          <router-link v-if="!authStore.isAuthenticated" to="/auth" 
            class="border-2 border-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors">
            Get Started
          </router-link>
        </div>
      </div>
    </section>

    <!-- Featured Cards -->
    <section>
      <div class="flex justify-between items-center mb-8">
        <h2 class="text-3xl font-bold">Featured Cards</h2>
        <router-link to="/cards" class="text-blue-600 hover:text-blue-800">
          View All →
        </router-link>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <CardPreview v-for="card in featuredCards" :key="card.id" :card="card" />
      </div>
    </section>

    <!-- Statistics 
    <section class="bg-gray-50 rounded-lg p-8">
      <h2 class="text-3xl font-bold text-center mb-8">Platform Statistics</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="text-center">
          <div class="text-3xl font-bold text-blue-600">{{ stats.totalCards }}+</div>
          <div class="text-gray-600">Cards Available</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-green-600">{{ stats.totalSellers }}+</div>
          <div class="text-gray-600">Trusted Sellers</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-purple-600">{{ stats.totalSales }}+</div>
          <div class="text-gray-600">Successful Sales</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-red-600">${{ stats.totalValue }}+</div>
          <div class="text-gray-600">Cards Traded</div>
        </div>
      </div>
    </section>-->

    <!-- How It Works -->
    <section>
      <h2 class="text-3xl font-bold text-center mb-12">How It Works</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div class="text-center">
          <div class="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <MagnifyingGlassIcon class="h-8 w-8 text-blue-600" />
          </div>
          <h3 class="text-xl font-semibold mb-2">Browse & Search</h3>
          <p class="text-gray-600">Find the exact cards you need with our powerful search and filtering tools.</p>
        </div>
        <div class="text-center">
          <div class="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingCartIcon class="h-8 w-8 text-green-600" />
          </div>
          <h3 class="text-xl font-semibold mb-2">Buy Safely</h3>
          <p class="text-gray-600">Purchase from verified sellers with secure payment processing and buyer protection.</p>
        </div>
        <div class="text-center">
          <div class="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <TruckIcon class="h-8 w-8 text-purple-600" />
          </div>
          <h3 class="text-xl font-semibold mb-2">Fast Shipping</h3>
          <p class="text-gray-600">Get your cards quickly with tracked shipping and real-time updates.</p>
        </div>
      </div>
    </section>

    <!-- Recent Activity -->
    <section v-if="recentSales.length > 0">
      <h2 class="text-3xl font-bold mb-8">Recent Sales</h2>
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <div class="divide-y divide-gray-200">
          <div v-for="sale in recentSales" :key="sale.id" 
            class="p-4 flex items-center justify-between hover:bg-gray-50">
            <div class="flex items-center space-x-4">
              <img :src="sale.card_image" :alt="sale.card_name" class="w-12 h-16 object-cover rounded" />
              <div>
                <div class="font-medium">{{ sale.card_name }}</div>
                <div class="text-sm text-gray-600">{{ sale.condition }} - {{ sale.set_name }}</div>
              </div>
            </div>
            <div class="text-right">
              <div class="font-semibold">${{ sale.price }} CAD</div>
              <div class="text-sm text-gray-500">{{ formatTimeAgo(sale.sold_at) }}</div>
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
       api.get('/cards?limit=8'),
     ])

     featuredCards.value = cardsRes.data
}

  // try {
  //   const [cardsRes, salesRes, statsRes] = await Promise.all([
  //     api.get('/cards?limit=8'),
  //     api.get('/recent-sales?limit=10'),
  //     api.get('/stats')
  //   ])
    
  //   featuredCards.value = cardsRes.data
  //   recentSales.value = salesRes.data || []
  //   stats.value = statsRes.data
  //} 


  catch (error) {
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