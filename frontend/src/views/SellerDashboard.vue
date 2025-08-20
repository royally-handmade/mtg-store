<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold">Seller Dashboard</h1>
      <div class="flex space-x-4">
        <router-link to="/seller/add-listing" 
          class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Add New Listing
        </router-link>
        <button @click="showBulkUpload = true"
          class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
          Bulk Upload
        </button>
      </div>
    </div>
    
    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <StatCard title="Active Listings" :value="stats.activeListings" />
      <StatCard title="Total Sales" :value="`$${stats.totalSales}`" />
      <StatCard title="Pending Orders" :value="stats.pendingOrders" />
      <StatCard title="Rating" :value="`${stats.rating} ★`" />
    </div>
    
    <!-- Recent Orders -->
    <div class="bg-white rounded-lg shadow">
      <div class="px-6 py-4 border-b">
        <h2 class="text-xl font-bold">Recent Orders</h2>
      </div>
      <div class="p-6">
        <OrdersTable :orders="recentOrders" @update-status="updateOrderStatus" />
      </div>
    </div>
    
    <!-- My Listings -->
    <div class="bg-white rounded-lg shadow">
      <div class="px-6 py-4 border-b">
        <h2 class="text-xl font-bold">My Listings</h2>
      </div>
      <div class="p-6">
        <ListingsTable :listings="myListings" @edit="editListing" @delete="deleteListing" />
      </div>
    </div>
    
    <!-- Payout Settings -->
    <div class="bg-white rounded-lg shadow">
      <div class="px-6 py-4 border-b">
        <h2 class="text-xl font-bold">Payout Settings</h2>
      </div>
      <div class="p-6">
        <PayoutSettings :settings="payoutSettings" @update="updatePayoutSettings" />
      </div>
    </div>
    
    <!-- Bulk Upload Modal -->
    <BulkUploadModal v-if="showBulkUpload" @close="showBulkUpload = false" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/lib/api'
import StatCard from '@/components/StatCard.vue'
import OrdersTable from '@/components/OrdersTable.vue'
import ListingsTable from '@/components/ListingsTable.vue'
import PayoutSettings from '@/components/PayoutSettings.vue'
import BulkUploadModal from '@/components/BulkUploadModal.vue'

const stats = ref({})
const recentOrders = ref([])
const myListings = ref([])
const payoutSettings = ref({})
const showBulkUpload = ref(false)

const fetchDashboardData = async () => {
  try {
    const [statsRes, ordersRes, listingsRes, payoutRes] = await Promise.all([
      api.get('/seller/stats'),
      api.get('/seller/orders'),
      api.get('/seller/listings'),
      api.get('/seller/payout-settings')
    ])
    
    stats.value = statsRes.data
    recentOrders.value = ordersRes.data
    myListings.value = listingsRes.data
    payoutSettings.value = payoutRes.data
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
  }
}

const updateOrderStatus = async (orderId, status) => {
  try {
    await api.patch(`/orders/${orderId}`, { status })
    await fetchDashboardData()
  } catch (error) {
    console.error('Error updating order status:', error)
  }
}

const editListing = (listing) => {
  // Edit listing logic
  console.log('Edit listing:', listing)
}

const deleteListing = async (listingId) => {
  try {
    await api.delete(`/listings/${listingId}`)
    await fetchDashboardData()
  } catch (error) {
    console.error('Error deleting listing:', error)
  }
}

const updatePayoutSettings = async (settings) => {
  try {
    await api.put('/seller/payout-settings', settings)
    payoutSettings.value = settings
  } catch (error) {
    console.error('Error updating payout settings:', error)
  }
}

onMounted(fetchDashboardData)
</script>