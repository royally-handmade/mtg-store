<!-- frontend/src/views/AdminDashboard.vue - Updated with simple seller approval -->
<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
      <div class="flex space-x-3">
        <span v-if="stats.pendingApplications > 0" class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
          {{ stats.pendingApplications }} Pending Applications
        </span>
        <span v-if="stats.pendingSellers > 0" class="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
          {{ stats.pendingSellers }} Sellers Awaiting Approval
        </span>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-blue-100 rounded-lg">
            <UsersIcon class="h-6 w-6 text-blue-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Users</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.totalUsers }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-green-100 rounded-lg">
            <BuildingStorefrontIcon class="h-6 w-6 text-green-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Active Sellers</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.activeSellers }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-purple-100 rounded-lg">
            <CubeIcon class="h-6 w-6 text-purple-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Listings</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.totalListings }}</p>
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
          <div class="p-2 bg-indigo-100 rounded-lg">
            <CurrencyDollarIcon class="h-6 w-6 text-indigo-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Revenue</p>
            <p class="text-2xl font-bold text-gray-900">${{ stats.totalRevenue }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="bg-white rounded-lg shadow">
      <div class="border-b border-gray-200">
        <nav class="-mb-px flex space-x-8 px-6" aria-label="Tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="[
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'
            ]"
          >
            {{ tab.name }}
          </button>
        </nav>
      </div>

      <div class="p-6">
        <!-- Sellers Management Tab -->
        <div v-if="activeTab === 'sellers'">
          <!-- Pending Sellers Section -->
          <div v-if="pendingSellers.length > 0" class="mb-8 bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h3 class="text-lg font-semibold text-orange-900 mb-4 flex items-center">
              <ClockIcon class="h-5 w-5 mr-2" />
              Sellers Awaiting Approval ({{ pendingSellers.length }})
            </h3>
            <div class="space-y-3">
              <div 
                v-for="seller in pendingSellers" 
                :key="seller.id"
                class="bg-white rounded-lg p-4 flex items-center justify-between shadow-sm"
              >
                <div class="flex-1">
                  <div class="flex items-center space-x-3">
                    <div>
                      <p class="text-sm font-semibold text-gray-900">{{ seller.display_name }}</p>
                      <p class="text-xs text-gray-500">{{ seller.email }}</p>
                    </div>
                  </div>
                  <div class="mt-2 text-xs text-gray-600">
                    <span>Applied: {{ formatDate(seller.created_at) }}</span>
                  </div>
                </div>
                <div class="flex items-center space-x-2">
                  <button
                    @click="approveSeller(seller.id)"
                    :disabled="approvingSellerIds.includes(seller.id)"
                    class="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span v-if="approvingSellerIds.includes(seller.id)">Approving...</span>
                    <span v-else>Approve Seller</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- All Sellers List -->
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-lg font-medium">All Sellers</h2>
            <div class="flex space-x-3">
              <input 
                v-model="sellersFilter.search" 
                @input="debouncedLoadSellers"
                placeholder="Search sellers..."
                class="rounded-md border-gray-300 text-sm" 
              />
              <select 
                v-model="sellersFilter.status" 
                @change="loadSellers"
                class="rounded-md border-gray-300 text-sm"
              >
                <option value="all">All Status</option>
                <option value="approved">Approved</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Seller
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Business
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Performance
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="seller in approvedSellers" :key="seller.id">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div>
                        <div class="text-sm font-medium text-gray-900">
                          {{ seller.display_name }}
                        </div>
                        <div class="text-sm text-gray-500">
                          {{ seller.email }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">
                      {{ seller.seller_settings?.business_name || 'N/A' }}
                    </div>
                    <div class="text-sm text-gray-500">
                      {{ seller.seller_tier || 'standard' }} tier
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div v-if="seller._count_listings[0].count !== 0" class="text-sm text-gray-900">
                      {{ seller._count_listings }} listings
                    </div>
                    <div v-else class="text-sm text-gray-500">
                      No Listings
                    </div>
                    <div v-if="seller._count_orders[0].count !== 0" class="text-sm text-gray-500">
                      {{ seller._count_orders || 0 }} orders
                    </div>
                    <div v-else class="text-sm text-gray-500">
                      No Orders
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span 
                      v-if="seller.suspended"
                      class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800"
                    >
                      Suspended
                    </span>
                    <span 
                      v-else
                      class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800"
                    >
                      Active
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button v-if="!seller.approved" 
                      @click="approveSeller(seller.id)"
                      class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                    >
                      Approve
                    </button>
                    <button v-else-if="seller.approved == true"
                     @click="openSuspendModal(seller)"
                    class="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
                      Suspend
                    </button>
                    <button v-else-if="seller.suspended == true"
                    class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    Re-Instate
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <Pagination
            v-if="sellersPagination.totalPages > 1"
            :current-page="sellersPagination.page"
            :total-pages="sellersPagination.totalPages"
            @page-change="loadSellers"
          />
        </div>

        <!-- Applications Tab (existing code remains) -->
        <div v-if="activeTab === 'applications'">
          <!-- Your existing applications tab content -->
        </div>

        <!-- Orders Tab (existing code remains) -->
        <div v-if="activeTab === 'orders'">
          <!-- Your existing orders tab content -->
        </div>

        <!-- Users Tab (existing code remains) -->
        <div v-if="activeTab === 'users'">
          <!-- Your existing users tab content -->
        </div>
      </div>
    </div>
        <!-- Suspend Seller Modal -->
    <SuspendSellerModal v-if="showSuspendModal" :seller="selectedSeller" @close="closeSuspendModal"
      @suspended="handleSuspend" />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { 
  UsersIcon, 
  BuildingStorefrontIcon, 
  CubeIcon, 
  ClockIcon,
  CurrencyDollarIcon 
} from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import Pagination from '@/components/Pagination.vue'
  import SuspendSellerModal from '@/components/admin/SuspendSellerModal.vue'



// State
const activeTab = ref('sellers')
const stats = ref({
  totalUsers: 0,
  activeSellers: 0,
  totalListings: 0,
  pendingOrders: 0,
  totalRevenue: 0,
  pendingApplications: 0,
  pendingSellers: 0
})

const pendingSellers = ref([])
const approvedSellers = ref([])
const approvingSellerIds = ref([])

const showSuspendModal = ref(false)
  const selectedSeller = ref(null)

const sellersFilter = ref({
  search: '',
  status: 'all'
})

const sellersPagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0
})

const tabs = [
  { id: 'sellers', name: 'Sellers' },
  { id: 'applications', name: 'Applications' },
  { id: 'orders', name: 'Orders' },
  { id: 'users', name: 'Users' }
]

// Methods
const loadStats = async () => {
  try {
    const response = await api.get('/admin/stats')
    stats.value = response.data
  } catch (error) {
    console.error('Error loading stats:', error)
  }
}

const loadPendingSellers = async () => {
  try {
    const response = await api.get('/admin/pending-sellers')
    pendingSellers.value = response.data
    stats.value.pendingSellers = response.data.length
  } catch (error) {
    console.error('Error loading pending sellers:', error)
  }
}

const loadSellers = async (page = 1) => {
  try {
    const params = {
      page,
      limit: sellersPagination.value.limit,
      status: sellersFilter.value.status === 'all' ? 'approved' : sellersFilter.value.status,
      search: sellersFilter.value.search
    }

    const response = await api.get('/seller/sellers', { params })
    approvedSellers.value = response.data.sellers
    sellersPagination.value = response.data.pagination
  } catch (error) {
    console.error('Error loading sellers:', error)
  }
}

const approveSeller = async (sellerId) => {
  if (approvingSellerIds.value.includes(sellerId)) return
  
  if (!confirm('Are you sure you want to approve this seller? They will be able to create listings immediately.')) {
    return
  }

  try {
    approvingSellerIds.value.push(sellerId)
    
    await api.patch(`/admin/sellers/${sellerId}/approve`)
    
    // Remove from pending list
    pendingSellers.value = pendingSellers.value.filter(s => s.id !== sellerId)
    stats.value.pendingSellers = pendingSellers.value.length
    stats.value.activeSellers += 1
    
    // Reload approved sellers list
    await loadSellers(sellersPagination.value.page)
    
    alert('Seller approved successfully!')
  } catch (error) {
    console.error('Error approving seller:', error)
    alert('Failed to approve seller. Please try again.')
  } finally {
    approvingSellerIds.value = approvingSellerIds.value.filter(id => id !== sellerId)
  }
}

  const openSuspendModal = (seller) => {
    selectedSeller.value = seller
    showSuspendModal.value = true
  }

  const closeSuspendModal = () => {
    showSuspendModal.value = false
    selectedSeller.value = null
  }

  const handleSuspend = async (suspensionData) => {
    try {
      await api.post(`/seller/sellers/${selectedSeller.value.id}/suspend`, suspensionData)

      closeSuspendModal()

      // Reload sellers list
      await loadSellers(sellersPagination.value.page)

      alert('Seller suspended successfully!')
    } catch (error) {
      console.error('Error suspending seller:', error)
      alert(error.response?.data?.error || 'Failed to suspend seller. Please try again.')
    }
  }

const unsuspendSeller = async (sellerId) => {
    if (!confirm('Are you sure you want to unsuspend this seller? They will be able to create listings and process orders again.')) {
      return
    }

    try {
      await api.post(`/seller/sellers/${sellerId}/unsuspend`)

      // Reload sellers list
      await loadSellers(sellersPagination.value.page)

      alert('Seller unsuspended successfully!')
    } catch (error) {
      console.error('Error unsuspending seller:', error)
      alert('Failed to unsuspend seller. Please try again.')
    }
  }

const formatDate = (date) => {
  return new Date(date).toLocaleDateString()
}

let debounceTimeout
const debouncedLoadSellers = () => {
  clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    loadSellers(1)
  }, 300)
}

// Lifecycle
onMounted(async () => {
  await loadStats()
  await loadPendingSellers()
  await loadSellers()
})
</script>