<!-- frontend/src/components/seller/SellerSettings.vue -->
<template>
  <div class="space-y-6">
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-6">Payout Settings</h3>
      
      <form @submit.prevent="updateSettings" class="space-y-6">
        <!-- Payout Method -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Payout Method
          </label>
          <div class="space-y-3">
            <label class="flex items-center">
              <input
                type="radio"
                v-model="settings.payout_method"
                value="bank_transfer"
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span class="ml-3 text-sm text-gray-900">Bank Transfer (ACH)</span>
            </label>
            <label class="flex items-center">
              <input
                type="radio"
                v-model="settings.payout_method"
                value="paypal"
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span class="ml-3 text-sm text-gray-900">PayPal</span>
            </label>
          </div>
        </div>

        <!-- Bank Transfer Details -->
        <div v-if="settings.payout_method === 'bank_transfer'" class="space-y-4">
          <h4 class="font-medium text-gray-900">Bank Account Details</h4>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Account Holder Name *
              </label>
              <input
                type="text"
                v-model="settings.bank_details.accountHolder"
                required
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Full name on account"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Bank Name *
              </label>
              <input
                type="text"
                v-model="settings.bank_details.bankName"
                required
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="TD Bank, RBC, etc."
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Account Number *
              </label>
              <input
                type="password"
                v-model="settings.bank_details.accountNumber"
                required
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Account number"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Routing Number *
              </label>
              <input
                type="text"
                v-model="settings.bank_details.routingNumber"
                required
                pattern="[0-9]{5,9}"
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Transit number"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Account Type
              </label>
              <select
                v-model="settings.bank_details.accountType"
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                v-model="settings.bank_details.phone"
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
          
          <div class="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div class="flex">
              <InformationCircleIcon class="h-5 w-5 text-blue-400 mt-0.5" />
              <div class="ml-3">
                <h3 class="text-sm font-medium text-blue-800">
                  Bank Account Security
                </h3>
                <div class="mt-2 text-sm text-blue-700">
                  <p>Your bank account information is encrypted and securely stored. We use this information only for processing your seller payouts.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- PayPal Details -->
        <div v-if="settings.payout_method === 'paypal'" class="space-y-4">
          <h4 class="font-medium text-gray-900">PayPal Details</h4>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              PayPal Email Address *
            </label>
            <input
              type="email"
              v-model="settings.paypal_email"
              required
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="your-paypal@email.com"
            />
          </div>
          
          <div class="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div class="flex">
              <InformationCircleIcon class="h-5 w-5 text-yellow-400 mt-0.5" />
              <div class="ml-3">
                <h3 class="text-sm font-medium text-yellow-800">
                  PayPal Payouts
                </h3>
                <div class="mt-2 text-sm text-yellow-700">
                  <p>PayPal payouts typically arrive within 1-2 business days. Make sure the email address matches your PayPal account.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Payout Preferences -->
        <div class="space-y-4">
          <h4 class="font-medium text-gray-900">Payout Preferences</h4>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Minimum Payout Threshold
            </label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span class="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                v-model.number="settings.payout_threshold"
                min="25"
                step="5"
                class="w-full pl-7 pr-12 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span class="text-gray-500 sm:text-sm">CAD</span>
              </div>
            </div>
            <p class="mt-1 text-sm text-gray-500">
              Minimum $25 CAD. Higher thresholds reduce processing frequency.
            </p>
          </div>
          
          <div class="flex items-center">
            <input
              type="checkbox"
              v-model="settings.auto_payout"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label class="ml-2 block text-sm text-gray-900">
              Enable automatic payouts
            </label>
          </div>
          <p class="text-sm text-gray-500 ml-6">
            Automatically process payouts when your earnings reach the threshold. 
            Payouts are processed weekly on Mondays.
          </p>
        </div>

        <!-- Current Settings Display -->
        <div v-if="originalSettings" class="bg-gray-50 rounded-md p-4">
          <h4 class="font-medium text-gray-900 mb-3">Current Settings</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span class="font-medium text-gray-700">Payout Method:</span>
              <span class="ml-2 text-gray-600">
                {{ originalSettings.payout_method === 'bank_transfer' ? 'Bank Transfer' : 'PayPal' }}
              </span>
            </div>
            <div>
              <span class="font-medium text-gray-700">Threshold:</span>
              <span class="ml-2 text-gray-600">${{ originalSettings.payout_threshold }} CAD</span>
            </div>
            <div>
              <span class="font-medium text-gray-700">Auto Payout:</span>
              <span class="ml-2 text-gray-600">
                {{ originalSettings.auto_payout ? 'Enabled' : 'Disabled' }}
              </span>
            </div>
            <div v-if="originalSettings.payout_method === 'bank_transfer' && originalSettings.bank_details">
              <span class="font-medium text-gray-700">Bank:</span>
              <span class="ml-2 text-gray-600">{{ originalSettings.bank_details.bankName }}</span>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            @click="resetSettings"
            class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Reset
          </button>
          <button
            type="submit"
            :disabled="saving || !isValid"
            class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="saving">Saving...</span>
            <span v-else>Save Settings</span>
          </button>
        </div>
      </form>
    </div>

    <!-- Payout History -->
    <div class="bg-white rounded-lg shadow p-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium text-gray-900">Recent Payouts</h3>
        <button
          @click="loadPayoutHistory"
          class="text-sm text-blue-600 hover:text-blue-500"
        >
          View All
        </button>
      </div>
      
      <div v-if="payoutHistory.length > 0" class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Method
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="payout in payoutHistory.slice(0, 5)" :key="payout.id">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ formatDate(payout.created_at) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${{ payout.amount.toFixed(2) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ formatPayoutMethod(payout.payout_method) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="getStatusBadgeClass(payout.status)" 
                  class="inline-flex px-2 py-1 text-xs font-semibold rounded-full">
                  {{ formatStatus(payout.status) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div v-else class="text-center py-8">
        <CurrencyDollarIcon class="mx-auto h-12 w-12 text-gray-400" />
        <h3 class="mt-2 text-sm font-medium text-gray-900">No payouts yet</h3>
        <p class="mt-1 text-sm text-gray-500">
          Your payouts will appear here once you start making sales.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { InformationCircleIcon, CurrencyDollarIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'

const emit = defineEmits(['updated'])

// Reactive data
const settings = ref({
  payout_method: 'bank_transfer',
  payout_threshold: 25,
  auto_payout: false,
  bank_details: {
    accountHolder: '',
    bankName: '',
    accountNumber: '',
    routingNumber: '',
    accountType: 'checking',
    phone: ''
  },
  paypal_email: ''
})

const originalSettings = ref(null)
const payoutHistory = ref([])
const saving = ref(false)

// Computed properties
const isValid = computed(() => {
  if (!settings.value.payout_method) return false
  
  if (settings.value.payout_method === 'bank_transfer') {
    const bank = settings.value.bank_details
    return bank.accountHolder && bank.bankName && bank.accountNumber && bank.routingNumber
  }
  
  if (settings.value.payout_method === 'paypal') {
    return settings.value.paypal_email && isValidEmail(settings.value.paypal_email)
  }
  
  return false
})

// Methods
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const loadSettings = async () => {
  try {
    const response = await api.get('/payment/seller-settings')
    if (response.data) {
      originalSettings.value = { ...response.data }
      
      // Populate form with existing settings
      Object.assign(settings.value, {
        payout_method: response.data.payout_method || 'bank_transfer',
        payout_threshold: response.data.payout_threshold || 25,
        auto_payout: response.data.auto_payout || false,
        paypal_email: response.data.paypal_email || ''
      })
      
      // Handle bank details safely
      if (response.data.bank_details) {
        Object.assign(settings.value.bank_details, response.data.bank_details)
      }
    }
  } catch (error) {
    console.error('Error loading settings:', error)
  }
}

const loadPayoutHistory = async () => {
  try {
    const response = await api.get('/payment/seller-payouts?limit=10')
    payoutHistory.value = response.data.payouts || []
  } catch (error) {
    console.error('Error loading payout history:', error)
  }
}

const updateSettings = async () => {
  saving.value = true
  try {
    const payload = {
      payout_method: settings.value.payout_method,
      payout_threshold: settings.value.payout_threshold,
      auto_payout: settings.value.auto_payout
    }
    
    if (settings.value.payout_method === 'bank_transfer') {
      payload.bank_details = settings.value.bank_details
    } else if (settings.value.payout_method === 'paypal') {
      payload.paypal_email = settings.value.paypal_email
    }
    
    await api.patch('/payment/seller-settings', payload)
    
    // Reload settings to get updated data
    await loadSettings()
    
    emit('updated')
    
    // Show success message
    alert('Settings updated successfully!')
  } catch (error) {
    console.error('Error updating settings:', error)
    alert('Error updating settings: ' + (error.response?.data?.error || error.message))
  } finally {
    saving.value = false
  }
}

const resetSettings = () => {
  if (originalSettings.value) {
    // Reset to original values
    Object.assign(settings.value, {
      payout_method: originalSettings.value.payout_method || 'bank_transfer',
      payout_threshold: originalSettings.value.payout_threshold || 25,
      auto_payout: originalSettings.value.auto_payout || false,
      paypal_email: originalSettings.value.paypal_email || ''
    })
    
    if (originalSettings.value.bank_details) {
      Object.assign(settings.value.bank_details, originalSettings.value.bank_details)
    }
  }
}

const formatDate = (date) => {
  return new Date(date).toLocaleDateString()
}

const formatPayoutMethod = (method) => {
  const methods = {
    'bank_transfer': 'Bank Transfer',
    'paypal': 'PayPal'
  }
  return methods[method] || method
}

const formatStatus = (status) => {
  const statuses = {
    'pending': 'Pending',
    'processing': 'Processing',
    'completed': 'Completed',
    'failed': 'Failed',
    'cancelled': 'Cancelled'
  }
  return statuses[status] || status
}

const getStatusBadgeClass = (status) => {
  const classes = {
    'pending': 'bg-yellow-100 text-yellow-800',
    'processing': 'bg-blue-100 text-blue-800',
    'completed': 'bg-green-100 text-green-800',
    'failed': 'bg-red-100 text-red-800',
    'cancelled': 'bg-gray-100 text-gray-800'
  }
  return classes[status] || 'bg-gray-100 text-gray-800'
}

// Initialize
onMounted(() => {
  loadSettings()
  loadPayoutHistory()
})
</script>