<!-- frontend/src/views/AdminDashboard.vue - Enhanced with seller approval -->
<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
      <div class="flex space-x-3">
        <span class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
          {{ stats.pendingApplications }} Pending Applications
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
            <p class="text-sm font-medium text-gray-600">Pending Apps</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.pendingApplications }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-indigo-100 rounded-lg">
            <CurrencyDollarIcon class="h-6 w-6 text-indigo-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Platform Revenue</p>
            <p class="text-2xl font-bold text-gray-900">${{ stats.revenue }}</p>
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
              'py-4 px-1 border-b-2 font-medium text-sm flex items-center',
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            <component :is="tab.icon" class="h-5 w-5 mr-2" />
            {{ tab.name }}
            <span v-if="tab.badge" 
              class="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
              {{ tab.badge }}
            </span>
          </button>
        </nav>
      </div>

      <div class="p-6">
        <!-- Seller Applications Tab -->
        <div v-if="activeTab === 'applications'">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-lg font-medium">Seller Applications</h2>
            <div class="flex space-x-3">
              <select v-model="applicationsFilter.status" @change="loadApplications"
                class="rounded-md border-gray-300 text-sm">
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="info_requested">Info Requested</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Applicant
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Business Info
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
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
                <tr v-for="application in applications" :key="application.id">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div>
                        <div class="text-sm font-medium text-gray-900">
                          {{ application.profiles.display_name }}
                        </div>
                        <div class="text-sm text-gray-500">
                          {{ application.profiles.email }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">{{ application.business_name }}</div>
                    <div class="text-sm text-gray-500">{{ application.business_type }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {{ formatDate(application.submitted_at) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span :class="getStatusBadgeClass(application.status)"
                      class="inline-flex px-2 py-1 text-xs font-semibold rounded-full">
                      {{ getStatusText(application.status) }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button @click="viewApplication(application)"
                      class="text-blue-600 hover:text-blue-900">
                      View
                    </button>
                    <button v-if="application.status === 'pending'"
                      @click="approveApplication(application)"
                      class="text-green-600 hover:text-green-900">
                      Approve
                    </button>
                    <button v-if="application.status === 'pending'"
                      @click="requestInfo(application)"
                      class="text-yellow-600 hover:text-yellow-900">
                      Request Info
                    </button>
                    <button v-if="application.status === 'pending'"
                      @click="rejectApplication(application)"
                      class="text-red-600 hover:text-red-900">
                      Reject
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <Pagination
            v-if="applicationsPagination.totalPages > 1"
            :current-page="applicationsPagination.page"
            :total-pages="applicationsPagination.totalPages"
            @page-change="loadApplications"
          />
        </div>

        <!-- Sellers Management Tab -->
        <div v-if="activeTab === 'sellers'">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-lg font-medium">Sellers Management</h2>
            <div class="flex space-x-3">
              <input v-model="sellersFilter.search" @input="debouncedLoadSellers"
                placeholder="Search sellers..."
                class="rounded-md border-gray-300 text-sm" />
              <select v-model="sellersFilter.status" @change="loadSellers"
                class="rounded-md border-gray-300 text-sm">
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
                <tr v-for="seller in sellers" :key="seller.id">
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
                      {{ seller.seller_tier }} tier
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">
                      {{ seller._count_listings }} listings
                    </div>
                    <div class="text-sm text-gray-500">
                      {{ seller._count_orders }} orders
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span v-if="seller.suspended"
                      class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                      Suspended
                    </span>
                    <span v-else
                      class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      Active
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button @click="viewSellerDetails(seller)"
                      class="text-blue-600 hover:text-blue-900">
                      View
                    </button>
                    <button v-if="!seller.suspended"
                      @click="suspendSeller(seller)"
                      class="text-red-600 hover:text-red-900">
                      Suspend
                    </button>
                    <button v-if="seller.suspended"
                      @click="unsuspendSeller(seller)"
                      class="text-green-600 hover:text-green-900">
                      Unsuspend
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

        <!-- Platform Stats Tab -->
        <div v-if="activeTab === 'stats'">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Recent Activity -->
            <div class="bg-gray-50 rounded-lg p-6">
              <h3 class="text-lg font-medium mb-4">Recent Orders</h3>
              <div class="space-y-3">
                <div v-for="order in stats.recentActivity?.orders || []" :key="order.id"
                  class="flex justify-between items-center text-sm">
                  <span>Order #{{ order.id }}</span>
                  <span class="font-medium">${{ order.total_amount }}</span>
                  <span class="text-gray-500">{{ formatDate(order.created_at) }}</span>
                </div>
              </div>
            </div>

            <!-- Recent Listings -->
            <div class="bg-gray-50 rounded-lg p-6">
              <h3 class="text-lg font-medium mb-4">Recent Listings</h3>
              <div class="space-y-3">
                <div v-for="listing in stats.recentActivity?.listings || []" :key="listing.id"
                  class="flex justify-between items-center text-sm">
                  <span>{{ listing.cards?.name || 'Card' }}</span>
                  <span class="font-medium">${{ listing.price }}</span>
                  <span class="text-gray-500">{{ formatDate(listing.created_at) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <ApplicationDetailModal
      v-if="selectedApplication"
      :application="selectedApplication"
      @close="selectedApplication = null"
      @approved="onApplicationProcessed"
      @rejected="onApplicationProcessed"
      @info-requested="onApplicationProcessed"
    />

    <SellerActionModal
      v-if="selectedSeller && actionType"
      :seller="selectedSeller"
      :action-type="actionType"
      @close="closeSellerModal"
      @completed="onSellerActionCompleted"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/lib/api'
import { debounce } from 'lodash'
import {
  UsersIcon,
  BuildingStorefrontIcon,
  CubeIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  ChartBarIcon,
  Cog6ToothIcon
} from '@heroicons/vue/24/outline'

// Components
import ApplicationDetailModal from '@/components/admin/ApplicationDetailModal.vue'
import SellerActionModal from '@/components/admin/SellerActionModal.vue'
import Pagination from '@/components/Pagination.vue'

// Reactive data
const activeTab = ref('applications')
const stats = ref({
  totalUsers: 0,
  activeSellers: 0,
  totalListings: 0,
  pendingApplications: 0,
  revenue: '0.00',
  recentActivity: {
    orders: [],
    listings: []
  }
})

const applications = ref([])
const sellers = ref([])
const selectedApplication = ref(null)
const selectedSeller = ref(null)
const actionType = ref('')

// Filters
const applicationsFilter = ref({
  status: 'all',
  page: 1
})

const sellersFilter = ref({
  status: 'all',
  search: '',
  page: 1
})

// Pagination
const applicationsPagination = ref({
  page: 1,
  totalPages: 1,
  total: 0
})

const sellersPagination = ref({
  page: 1,
  totalPages: 1,
  total: 0
})

const tabs = computed(() => [
  { 
    id: 'applications', 
    name: 'Applications', 
    icon: DocumentTextIcon,
    badge: stats.value.pendingApplications > 0 ? stats.value.pendingApplications : null
  },
  { id: 'sellers', name: 'Sellers', icon: BuildingStorefrontIcon },
  { id: 'stats', name: 'Analytics', icon: ChartBarIcon },
  { id: 'settings', name: 'Settings', icon: Cog6ToothIcon }
])

// Methods
const loadStats = async () => {
  try {
    const response = await api.get('/admin/stats')
    stats.value = response.data
  } catch (error) {
    console.error('Error loading stats:', error)
  }
}

const loadApplications = async (page = 1) => {
  try {
    const params = {
      ...applicationsFilter.value,
      page
    }
    const response = await api.get('/admin/seller-applications', { params })
    applications.value = response.data.applications
    applicationsPagination.value = response.data.pagination
  } catch (error) {
    console.error('Error loading applications:', error)
  }
}

const loadSellers = async (page = 1) => {
  try {
    const params = {
      ...sellersFilter.value,
      page
    }
    const response = await api.get('/admin/sellers', { params })
    sellers.value = response.data.sellers
    sellersPagination.value = response.data.pagination
  } catch (error) {
    console.error('Error loading sellers:', error)
  }
}

const viewApplication = async (application) => {
  try {
    const response = await api.get(`/admin/seller-applications/${application.id}`)
    selectedApplication.value = response.data
  } catch (error) {
    console.error('Error loading application details:', error)
  }
}

const approveApplication = (application) => {
  selectedApplication.value = application
  actionType.value = 'approve'
}

const rejectApplication = (application) => {
  selectedApplication.value = application
  actionType.value = 'reject'
}

const requestInfo = (application) => {
  selectedApplication.value = application
  actionType.value = 'request-info'
}

const suspendSeller = (seller) => {
  selectedSeller.value = seller
  actionType.value = 'suspend'
}

const unsuspendSeller = (seller) => {
  selectedSeller.value = seller
  actionType.value = 'unsuspend'
}

const viewSellerDetails = (seller) => {
  selectedSeller.value = seller
  actionType.value = 'view'
}

const closeSellerModal = () => {
  selectedSeller.value = null
  actionType.value = ''
}

const onApplicationProcessed = () => {
  selectedApplication.value = null
  loadApplications()
  loadStats()
}

const onSellerActionCompleted = () => {
  closeSellerModal()
  loadSellers()
  loadStats()
}

const getStatusBadgeClass = (status) => {
  const classes = {
    'pending': 'bg-yellow-100 text-yellow-800',
    'info_requested': 'bg-blue-100 text-blue-800',
    'approved': 'bg-green-100 text-green-800',
    'rejected': 'bg-red-100 text-red-800'
  }
  return classes[status] || 'bg-gray-100 text-gray-800'
}

const getStatusText = (status) => {
  const texts = {
    'pending': 'Pending',
    'info_requested': 'Info Requested',
    'approved': 'Approved',
    'rejected': 'Rejected'
  }
  return texts[status] || status
}

const formatDate = (date) => {
  return new Date(date).toLocaleDateString()
}

// Debounced search
const debouncedLoadSellers = debounce(() => {
  loadSellers(1)
}, 500)

// Initialize
onMounted(() => {
  loadStats()
  loadApplications()
})
</script>