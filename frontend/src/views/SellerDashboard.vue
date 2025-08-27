<!-- frontend/src/views/SellerDashboard.vue -->
<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold text-gray-900">Seller Dashboard</h1>
      <div class="flex space-x-3">
        <router-link to="/seller/listings/new" 
          class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center">
          <PlusIcon class="h-5 w-5 mr-2" />
          Add Listing
        </router-link>
        <button @click="showBulkUpload = true"
          class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center">
          <DocumentPlusIcon class="h-5 w-5 mr-2" />
          Bulk Upload
        </button>
      </div>
    </div>

    <!-- Application Status Banner -->
    <div v-if="applicationStatus && applicationStatus.status !== 'approved'" 
      class="rounded-lg p-4" :class="getStatusBannerClass(applicationStatus.status)">
      <div class="flex items-center">
        <InformationCircleIcon class="h-5 w-5 mr-3" />
        <div>
          <h3 class="font-medium">
            {{ getStatusTitle(applicationStatus.status) }}
          </h3>
          <p class="text-sm mt-1">
            {{ getStatusMessage(applicationStatus.status) }}
          </p>
          <div v-if="applicationStatus.admin_message" class="mt-2 text-sm">
            <strong>Admin Message:</strong> {{ applicationStatus.admin_message }}
          </div>
        </div>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-blue-100 rounded-lg">
            <CubeIcon class="h-6 w-6 text-blue-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Active Listings</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.activeListings }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-yellow-100 rounded-lg">
            <ClockIcon class="h-6 w-6 text-yellow-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Pending Orders</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.pendingOrders }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-green-100 rounded-lg">
            <CurrencyDollarIcon class="h-6 w-6 text-green-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Sales</p>
            <p class="text-2xl font-bold text-gray-900">${{ stats.totalSales }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-purple-100 rounded-lg">
            <StarIcon class="h-6 w-6 text-purple-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Rating</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.averageRating }}/5</p>
            <p class="text-xs text-gray-500">({{ stats.reviewCount }} reviews)</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Tabs -->
    <div class="bg-white rounded-lg shadow">
      <div class="border-b border-gray-200">
        <nav class="-mb-px flex space-x-8 px-6">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="[
              'py-4 px-1 border-b-2 font-medium text-sm',
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            {{ tab.name }}
          </button>
        </nav>
      </div>

      <div class="p-6">
        <!-- Listings Tab -->
        <div v-if="activeTab === 'listings'">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-lg font-medium">My Listings</h2>
            <div class="flex space-x-3">
              <select v-model="listingsFilter.status" @change="loadListings"
                class="rounded-md border-gray-300 text-sm">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="sold">Sold</option>
                <option value="inactive">Inactive</option>
              </select>
              <input v-model="listingsFilter.search" @input="debouncedLoadListings"
                placeholder="Search listings..."
                class="rounded-md border-gray-300 text-sm" />
            </div>
          </div>

          <ListingsTable 
            :listings="listings"
            :loading="loadingListings"
            @edit="editListing"
            @delete="deleteListing"
            @toggle-status="toggleListingStatus"
          />

          <Pagination
            v-if="listingsPagination.totalPages > 1"
            :current-page="listingsPagination.page"
            :total-pages="listingsPagination.totalPages"
            @page-change="loadListings"
          />
        </div>

        <!-- Orders Tab -->
        <div v-if="activeTab === 'orders'">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-lg font-medium">Orders</h2>
            <div class="flex space-x-3">
              <select v-model="ordersFilter.status" @change="loadOrders"
                class="rounded-md border-gray-300 text-sm">
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
              </select>
              <input type="date" v-model="ordersFilter.startDate" @change="loadOrders"
                class="rounded-md border-gray-300 text-sm" />
              <input type="date" v-model="ordersFilter.endDate" @change="loadOrders"
                class="rounded-md border-gray-300 text-sm" />
            </div>
          </div>

          <OrdersTable 
            :orders="orders"
            :loading="loadingOrders"
            @update-status="updateOrderStatus"
            @view-details="viewOrderDetails"
          />

          <Pagination
            v-if="ordersPagination.totalPages > 1"
            :current-page="ordersPagination.page"
            :total-pages="ordersPagination.totalPages"
            @page-change="loadOrders"
          />
        </div>

        <!-- Analytics Tab -->
        <div v-if="activeTab === 'analytics'">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Sales Chart -->
            <div class="bg-gray-50 rounded-lg p-6">
              <h3 class="text-lg font-medium mb-4">Monthly Sales</h3>
              <SalesChart :data="stats.monthlySales" />
            </div>

            <!-- Popular Cards -->
            <div class="bg-gray-50 rounded-lg p-6">
              <h3 class="text-lg font-medium mb-4">Top Selling Cards</h3>
              <div class="space-y-3">
                <div v-for="card in topCards" :key="card.id"
                  class="flex justify-between items-center">
                  <div class="flex items-center space-x-3">
                    <img :src="card.image_url" :alt="card.name" 
                      class="w-8 h-11 object-cover rounded" />
                    <div>
                      <p class="font-medium text-sm">{{ card.name }}</p>
                      <p class="text-xs text-gray-500">{{ card.set_name }}</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="font-medium text-sm">{{ card.sales_count }} sold</p>
                    <p class="text-xs text-gray-500">${{ card.total_revenue }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Settings Tab -->
        <div v-if="activeTab === 'settings'">
          <SellerSettings @updated="loadStats" />
        </div>
        
      </div>
    </div>

    <!-- Modals -->
    <BulkUploadModal 
      v-if="showBulkUpload"
      @close="showBulkUpload = false"
      @uploaded="onBulkUploadComplete"
    />

    <OrderDetailsModal
      v-if="selectedOrder"
      :order="selectedOrder"
      @close="selectedOrder = null"
      @updated="loadOrders"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/lib/api'
import { debounce } from 'lodash'
import {
  PlusIcon,
  DocumentPlusIcon,
  InformationCircleIcon,
  CubeIcon,
  ClockIcon,
  CurrencyDollarIcon,
  StarIcon
} from '@heroicons/vue/24/outline'

// Components
import ListingsTable from '@/components/seller/ListingsTable.vue'
import OrdersTable from '@/components/seller/OrdersTable.vue'
import SalesChart from '@/components/seller/SalesChart.vue'
import SellerSettings from '@/components/seller/SellerSettings.vue'
import BulkUploadModal from '@/components/seller/BulkUploadModal.vue'
import OrderDetailsModal from '@/components/seller/OrderDetailsModal.vue'
import Pagination from '@/components/Pagination.vue'

const authStore = useAuthStore()

// Reactive data
const activeTab = ref('listings')
const applicationStatus = ref(null)
const stats = ref({
  activeListings: 0,
  pendingOrders: 0,
  totalSales: '0.00',
  averageRating: '0.0',
  reviewCount: 0,
  monthlySales: {}
})

const listings = ref([])
const orders = ref([])
const topCards = ref([])
const selectedOrder = ref(null)

const loadingListings = ref(false)
const loadingOrders = ref(false)
const showBulkUpload = ref(false)

// Filters
const listingsFilter = ref({
  status: 'all',
  search: '',
  page: 1
})

const ordersFilter = ref({
  status: 'all',
  startDate: '',
  endDate: '',
  page: 1
})

// Pagination
const listingsPagination = ref({
  page: 1,
  totalPages: 1,
  total: 0
})

const ordersPagination = ref({
  page: 1,
  totalPages: 1,
  total: 0
})

const tabs = [
  { id: 'listings', name: 'Listings' },
  { id: 'orders', name: 'Orders' },
  { id: 'analytics', name: 'Analytics' },
  { id: 'settings', name: 'Settings' }
]

// Methods
const loadApplicationStatus = async () => {
  try {
    const response = await api.get('/seller/application-status')
    applicationStatus.value = response.data
  } catch (error) {
    console.error('Error loading application status:', error)
  }
}

const loadStats = async () => {
  try {
    const response = await api.get('/seller/stats')
    stats.value = response.data
  } catch (error) {
    console.error('Error loading stats:', error)
  }
}

const loadListings = async (page = 1) => {
  loadingListings.value = true
  try {
    const params = {
      ...listingsFilter.value,
      page
    }
    const response = await api.get('/seller/listings', { params })
    listings.value = response.data.listings
    listingsPagination.value = response.data.pagination
  } catch (error) {
    console.error('Error loading listings:', error)
  } finally {
    loadingListings.value = false
  }
}

const loadOrders = async (page = 1) => {
  loadingOrders.value = true
  try {
    const params = {
      ...ordersFilter.value,
      page
    }
    const response = await api.get('/seller/orders', { params })
    orders.value = response.data.orders
    ordersPagination.value = response.data.pagination
  } catch (error) {
    console.error('Error loading orders:', error)
  } finally {
    loadingOrders.value = false
  }
}

const loadTopCards = async () => {
  try {
    const response = await api.get('/seller/analytics/top-cards')
    topCards.value = response.data
  } catch (error) {
    console.error('Error loading top cards:', error)
  }
}

const editListing = (listing) => {
  // Navigate to edit listing page
  window.location.href = `/seller/listings/${listing.id}/edit`
}

const deleteListing = async (listing) => {
  if (!confirm(`Are you sure you want to delete the listing for "${listing.cards.name}"?`)) {
    return
  }

  try {
    await api.delete(`/seller/listings/${listing.id}`)
    await loadListings()
    await loadStats()
    
    // Show success message
    console.log('Listing deleted successfully')
  } catch (error) {
    console.error('Error deleting listing:', error)
    alert('Error deleting listing: ' + error.response?.data?.error)
  }
}

const toggleListingStatus = async (listing) => {
  const newStatus = listing.status === 'active' ? 'inactive' : 'active'
  
  try {
    await api.patch(`/seller/listings/${listing.id}`, {
      status: newStatus
    })
    await loadListings()
    console.log(`Listing ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
  } catch (error) {
    console.error('Error updating listing status:', error)
  }
}

const updateOrderStatus = async (orderId, newStatus, trackingNumber = '', notes = '') => {
  try {
    await api.patch(`/seller/orders/${orderId}/status`, {
      status: newStatus,
      tracking_number: trackingNumber,
      notes: notes
    })
    await loadOrders()
    await loadStats()
    console.log('Order status updated successfully')
  } catch (error) {
    console.error('Error updating order status:', error)
    alert('Error updating order status: ' + error.response?.data?.error)
  }
}

const viewOrderDetails = (order) => {
  selectedOrder.value = order
}

const onBulkUploadComplete = async (result) => {
  showBulkUpload.value = false
  await loadListings()
  await loadStats()
  
  if (result.errors.length > 0) {
    alert(`Upload completed with ${result.errors.length} errors. Check the console for details.`)
    console.log('Upload errors:', result.errors)
  } else {
    alert(`Successfully uploaded ${result.inserted} listings!`)
  }
}

const getStatusBannerClass = (status) => {
  const classes = {
    'pending': 'bg-yellow-50 border border-yellow-200 text-yellow-800',
    'info_requested': 'bg-blue-50 border border-blue-200 text-blue-800',
    'rejected': 'bg-red-50 border border-red-200 text-red-800'
  }
  return classes[status] || 'bg-gray-50 border border-gray-200 text-gray-800'
}

const getStatusTitle = (status) => {
  const titles = {
    'pending': 'Application Under Review',
    'info_requested': 'Additional Information Required',
    'rejected': 'Application Not Approved'
  }
  return titles[status] || 'Application Status'
}

const getStatusMessage = (status) => {
  const messages = {
    'pending': 'Your seller application is currently being reviewed by our team. You will receive an email once a decision has been made.',
    'info_requested': 'We need additional information to process your application. Please review the requirements below and submit the requested documents.',
    'rejected': 'Your seller application was not approved at this time. You may reapply after addressing the concerns mentioned below.'
  }
  return messages[status] || 'Please check your application status.'
}

// Debounced search
const debouncedLoadListings = debounce(() => {
  loadListings(1)
}, 500)

// Watch for tab changes
watch(activeTab, (newTab) => {
  if (newTab === 'listings' && listings.value.length === 0) {
    loadListings()
  } else if (newTab === 'orders' && orders.value.length === 0) {
    loadOrders()
  } else if (newTab === 'analytics' && topCards.value.length === 0) {
    loadTopCards()
  }
})

// Initialize
onMounted(() => {
  loadApplicationStatus()
  loadStats()
  loadListings()
})
</script>

<style scoped>
/* Additional styling for seller dashboard */
.tab-content {
  min-height: 400px;
}

.stats-card {
  transition: transform 0.2s ease-in-out;
}

.stats-card:hover {
  transform: translateY(-2px);
}
</style>