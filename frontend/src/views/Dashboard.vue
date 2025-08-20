<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold">Dashboard</h1>
      <div class="text-sm text-gray-600">
        Welcome back, {{ authStore.profile?.display_name || authStore.user?.email }}
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <StatCard title="Wishlist Items" :value="stats.wishlistCount" icon="heart" />
      <StatCard title="Cart Items" :value="stats.cartCount" icon="shopping-cart" />
      <StatCard title="Orders" :value="stats.orderCount" icon="truck" />
      <StatCard title="Saved" :value="`${stats.savedAmount}`" icon="currency-dollar" />
    </div>

    <!-- Recent Orders -->
    <div class="card">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold">Recent Orders</h2>
        <router-link to="/orders" class="text-blue-600 hover:text-blue-800">
          View All →
        </router-link>
      </div>
      
      <div v-if="recentOrders.length === 0" class="text-center py-8 text-gray-500">
        <TruckIcon class="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>No orders yet</p>
        <router-link to="/cards" class="text-blue-600 hover:text-blue-800">
          Start shopping →
        </router-link>
      </div>
      
      <div v-else class="space-y-4">
        <div v-for="order in recentOrders" :key="order.id" 
          class="border rounded-lg p-4 hover:bg-gray-50">
          <div class="flex justify-between items-start">
            <div>
              <div class="font-medium">Order #{{ order.id.slice(0, 8) }}</div>
              <div class="text-sm text-gray-600">
                {{ order.order_items?.length || 0 }} items • ${{ order.total_amount }} CAD
              </div>
              <div class="text-xs text-gray-400">
                {{ formatDate(order.created_at) }}
              </div>
            </div>
            <span :class="getStatusColor(order.status)" 
              class="px-2 py-1 rounded-full text-xs font-medium">
              {{ order.status }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Wishlist Preview -->
    <div class="card">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold">Wishlist</h2>
        <router-link to="/wishlist" class="text-blue-600 hover:text-blue-800">
          View All →
        </router-link>
      </div>
      
      <div v-if="wishlistItems.length === 0" class="text-center py-8 text-gray-500">
        <HeartIcon class="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>Your wishlist is empty</p>
        <router-link to="/cards" class="text-blue-600 hover:text-blue-800">
          Browse cards →
        </router-link>
      </div>
      
      <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div v-for="item in wishlistItems.slice(0, 6)" :key="item.id"
          class="flex items-center space-x-3 p-3 border rounded hover:bg-gray-50">
          <img :src="item.cards.image_url" :alt="item.cards.name" 
            class="w-12 h-16 object-cover rounded" />
          <div class="flex-1 min-w-0">
            <div class="font-medium text-sm truncate">{{ item.cards.name }}</div>
            <div class="text-xs text-gray-600">{{ item.cards.set_number }}</div>
            <div v-if="item.max_price" class="text-xs text-green-600">
              Max: ${{ item.max_price }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Account Actions -->
    <div class="card">
      <h2 class="text-xl font-bold mb-6">Quick Actions</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <router-link to="/deck-builder" 
          class="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-blue-500 hover:bg-blue-50">
          <div class="text-2xl mb-2">🃏</div>
          <div class="font-medium">Build a Deck</div>
          <div class="text-sm text-gray-600">Upload decklist and find cards</div>
        </router-link>
        
        <router-link v-if="!authStore.isSeller" to="/become-seller" 
          class="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-green-500 hover:bg-green-50">
          <div class="text-2xl mb-2">💰</div>
          <div class="font-medium">Become a Seller</div>
          <div class="text-sm text-gray-600">Start selling your cards</div>
        </router-link>
        
        <router-link to="/profile" 
          class="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-purple-500 hover:bg-purple-50">
          <div class="text-2xl mb-2">⚙️</div>
          <div class="font-medium">Account Settings</div>
          <div class="text-sm text-gray-600">Update your profile</div>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { TruckIcon, HeartIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import StatCard from '@/components/StatCard.vue'

const authStore = useAuthStore()

const stats = ref({
  wishlistCount: 0,
  cartCount: 0,
  orderCount: 0,
  savedAmount: 0
})

const recentOrders = ref([])
const wishlistItems = ref([])

const fetchDashboardData = async () => {
  try {
    const [ordersRes, wishlistRes, cartRes] = await Promise.all([
      api.get('/orders/my-orders?limit=5'),
      api.get('/wishlist?limit=6'),
      api.get('/cart/summary')
    ])
    
    recentOrders.value = ordersRes.data
    wishlistItems.value = wishlistRes.data || []
    
    stats.value = {
      wishlistCount: wishlistItems.value.length,
      cartCount: cartRes.data.itemCount || 0,
      orderCount: recentOrders.value.length,
      savedAmount: cartRes.data.total || '0.00'
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
  }
}

const formatDate = (date) => {
  return new Date(date).toLocaleDateString()
}

const getStatusColor = (status) => {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800'
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}

onMounted(fetchDashboardData)
</script>