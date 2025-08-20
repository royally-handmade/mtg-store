<template>
  <div class="space-y-6">
    <h1 class="text-3xl font-bold">Admin Dashboard</h1>
    
    <!-- Platform Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <StatCard title="Total Users" :value="platformStats.totalUsers" />
      <StatCard title="Active Sellers" :value="platformStats.activeSellers" />
      <StatCard title="Total Listings" :value="platformStats.totalListings" />
      <StatCard title="Platform Revenue" :value="`$${platformStats.revenue}`" />
    </div>
    
    <!-- Quick Actions -->
    <div class="bg-white rounded-lg shadow p-6">
      <h2 class="text-xl font-bold mb-4">Quick Actions</h2>
      <div class="flex space-x-4">
        <button @click="showCardUpload = true"
          class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Upload Cards CSV
        </button>
        <button @click="exportData"
          class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
          Export Data
        </button>
        <button @click="generateReport"
          class="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
          Generate Report
        </button>
      </div>
    </div>
    
    <!-- Pending Seller Approvals -->
    <div class="bg-white rounded-lg shadow">
      <div class="px-6 py-4 border-b">
        <h2 class="text-xl font-bold">Pending Seller Approvals</h2>
      </div>
      <div class="p-6">
        <div v-for="seller in pendingSellers" :key="seller.id" 
          class="flex justify-between items-center border-b py-4 last:border-b-0">
          <div>
            <div class="font-medium">{{ seller.name }}</div>
            <div class="text-sm text-gray-600">{{ seller.email }}</div>
            <div class="text-xs text-gray-400">Applied: {{ seller.created_at }}</div>
          </div>
          <div class="flex space-x-2">
            <button @click="approveSeller(seller.id)"
              class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
              Approve
            </button>
            <button @click="rejectSeller(seller.id)"
              class="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Platform Settings -->
    <div class="bg-white rounded-lg shadow">
      <div class="px-6 py-4 border-b">
        <h2 class="text-xl font-bold">Platform Settings</h2>
      </div>
      <div class="p-6 space-y-4">
        <div class="flex justify-between items-center">
          <label class="font-medium">Platform Fee (%)</label>
          <input v-model="settings.platformFee" type="number" step="0.1" 
            class="w-20 rounded border-gray-300" />
        </div>
        <div class="flex justify-between items-center">
          <label class="font-medium">Minimum Payout (CAD)</label>
          <input v-model="settings.minPayout" type="number" 
            class="w-24 rounded border-gray-300" />
        </div>
        <button @click="updateSettings" 
          class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Update Settings
        </button>
      </div>
    </div>
    
    <!-- Card Upload Modal -->
    <CardUploadModal v-if="showCardUpload" @close="showCardUpload = false" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/lib/api'
import StatCard from '@/components/StatCard.vue'
import CardUploadModal from '@/components/CardUploadModal.vue'

const platformStats = ref({})
const pendingSellers = ref([])
const settings = ref({
  platformFee: 2.5,
  minPayout: 25
})
const showCardUpload = ref(false)

const fetchAdminData = async () => {
  try {
    const [statsRes, sellersRes, settingsRes] = await Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/pending-sellers'),
      api.get('/admin/settings')
    ])
    
    platformStats.value = statsRes.data
    pendingSellers.value = sellersRes.data
    settings.value = { ...settings.value, ...settingsRes.data }
  } catch (error) {
    console.error('Error fetching admin data:', error)
  }
}

const approveSeller = async (sellerId) => {
  try {
    await api.patch(`/admin/sellers/${sellerId}/approve`)
    await fetchAdminData()
  } catch (error) {
    console.error('Error approving seller:', error)
  }
}

const rejectSeller = async (sellerId) => {
  try {
    await api.patch(`/admin/sellers/${sellerId}/reject`)
    await fetchAdminData()
  } catch (error) {
    console.error('Error rejecting seller:', error)
  }
}

const updateSettings = async () => {
  try {
    await api.put('/admin/settings', settings.value)
  } catch (error) {
    console.error('Error updating settings:', error)
  }
}

const exportData = async () => {
  try {
    const response = await api.get('/admin/export', { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'platform-data.csv')
    document.body.appendChild(link)
    link.click()
    link.remove()
  } catch (error) {
    console.error('Error exporting data:', error)
  }
}

const generateReport = async () => {
  try {
    await api.post('/admin/generate-report')
    // Handle report generation
  } catch (error) {
    console.error('Error generating report:', error)
  }
}

onMounted(fetchAdminData)
</script>
