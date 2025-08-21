<!-- frontend/src/components/admin/SellerActionModal.vue -->
<template>
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" @click="closeModal">
    <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-lg bg-white" @click.stop>
      <div class="flex justify-between items-center mb-6">
        <h3 class="text-xl font-semibold text-gray-900">
          {{ getModalTitle() }}
        </h3>
        <button @click="closeModal" class="text-gray-400 hover:text-gray-600">
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>

      <!-- Seller Information Header -->
      <div class="bg-gray-50 rounded-lg p-4 mb-6">
        <div class="flex items-center space-x-4">
          <div v-if="seller.avatar_url" class="flex-shrink-0">
            <img :src="seller.avatar_url" :alt="seller.display_name" 
              class="h-12 w-12 rounded-full object-cover">
          </div>
          <div v-else class="flex-shrink-0">
            <div class="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center">
              <UserIcon class="h-6 w-6 text-gray-600" />
            </div>
          </div>
          <div class="flex-1">
            <h4 class="font-medium text-gray-900">{{ seller.display_name }}</h4>
            <p class="text-sm text-gray-600">{{ seller.email }}</p>
            <div class="flex items-center space-x-4 mt-1">
              <span class="text-xs text-gray-500">
                {{ seller.seller_settings?.business_name || 'No business name' }}
              </span>
              <span :class="getSellerStatusClass(seller)" class="text-xs px-2 py-1 rounded-full">
                {{ seller.suspended ? 'Suspended' : 'Active' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Content -->
      <div class="space-y-6">
        <!-- View Details -->
        <div v-if="actionType === 'view'">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Seller Statistics -->
            <div>
              <h4 class="text-lg font-medium text-gray-900 mb-4">Performance</h4>
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">Active Listings:</span>
                  <span class="text-sm font-medium">{{ seller._count_listings || 0 }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">Total Orders:</span>
                  <span class="text-sm font-medium">{{ seller._count_orders || 0 }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">Average Rating:</span>
                  <span class="text-sm font-medium">
                    {{ seller._avg_rating ? seller._avg_rating.toFixed(1) : 'N/A' }}/5
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">Seller Tier:</span>
                  <span class="text-sm font-medium capitalize">{{ seller.seller_tier || 'Standard' }}</span>
                </div>
              </div>
            </div>

            <!-- Account Information -->
            <div>
              <h4 class="text-lg font-medium text-gray-900 mb-4">Account Info</h4>
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">Member Since:</span>
                  <span class="text-sm font-medium">{{ formatDate(seller.created_at) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">Last Login:</span>
                  <span class="text-sm font-medium">
                    {{ seller.last_login_at ? formatDateTime(seller.last_login_at) : 'Never' }}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">Status:</span>
                  <span :class="getSellerStatusClass(seller)" class="text-sm px-2 py-1 rounded-full">
                    {{ seller.suspended ? 'Suspended' : 'Active' }}
                  </span>
                </div>
                <div v-if="seller.suspended && seller.suspended_until" class="flex justify-between">
                  <span class="text-sm text-gray-600">Suspended Until:</span>
                  <span class="text-sm font-medium">{{ formatDateTime(seller.suspended_until) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Business Information -->
          <div v-if="seller.seller_settings">
            <h4 class="text-lg font-medium text-gray-900 mb-4">Business Information</h4>
            <div class="bg-gray-50 rounded-lg p-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span class="font-medium text-gray-700">Business Name:</span>
                  <span class="ml-2 text-gray-900">{{ seller.seller_settings.business_name || 'N/A' }}</span>
                </div>
                <div>
                  <span class="font-medium text-gray-700">Business Type:</span>
                  <span class="ml-2 text-gray-900 capitalize">{{ seller.seller_settings.business_type || 'N/A' }}</span>
                </div>
                <div>
                  <span class="font-medium text-gray-700">Payout Method:</span>
                  <span class="ml-2 text-gray-900 capitalize">
                    {{ seller.seller_settings.payout_method?.replace('_', ' ') || 'Not set' }}
                  </span>
                </div>
                <div>
                  <span class="font-medium text-gray-700">Auto Payout:</span>
                  <span class="ml-2 text-gray-900">{{ seller.seller_settings.auto_payout ? 'Enabled' : 'Disabled' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Recent Activity -->
          <div v-if="recentActivity.length > 0">
            <h4 class="text-lg font-medium text-gray-900 mb-4">Recent Activity</h4>
            <div class="bg-gray-50 rounded-lg p-4">
              <div class="space-y-2">
                <div v-for="activity in recentActivity" :key="activity.id" 
                  class="flex justify-between items-center text-sm">
                  <span class="text-gray-900">{{ activity.description }}</span>
                  <span class="text-gray-500">{{ formatDateTime(activity.created_at) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Suspend Seller -->
        <div v-if="actionType === 'suspend'">
          <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div class="flex">
              <ExclamationTriangleIcon class="h-5 w-5 text-red-400 mt-0.5" />
              <div class="ml-3">
                <h3 class="text-sm font-medium text-red-800">Suspend Seller Account</h3>
                <div class="mt-2 text-sm text-red-700">
                  <p>This action will suspend the seller's account and deactivate all their listings. The seller will not be able to create new listings or process orders.</p>
                </div>
              </div>
            </div>
          </div>

          <form @submit.prevent="suspendSeller" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Suspension Reason *
              </label>
              <select v-model="suspensionForm.reason" required
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500">
                <option value="">Select a reason</option>
                <option value="policy_violation">Policy Violation</option>
                <option value="fraud_suspicion">Fraud Suspicion</option>
                <option value="customer_complaints">Customer Complaints</option>
                <option value="quality_issues">Quality Issues</option>
                <option value="non_compliance">Non-Compliance</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Suspension Duration
              </label>
              <select v-model="suspensionForm.duration_days"
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500">
                <option value="">Indefinite</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes
              </label>
              <textarea v-model="suspensionForm.notes" rows="4"
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                placeholder="Provide details about the suspension reason..."></textarea>
            </div>

            <div class="flex justify-end space-x-3">
              <button type="button" @click="closeModal"
                class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" :disabled="processing"
                class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
                {{ processing ? 'Suspending...' : 'Suspend Seller' }}
              </button>
            </div>
          </form>
        </div>

        <!-- Unsuspend Seller -->
        <div v-if="actionType === 'unsuspend'">
          <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div class="flex">
              <CheckCircleIcon class="h-5 w-5 text-green-400 mt-0.5" />
              <div class="ml-3">
                <h3 class="text-sm font-medium text-green-800">Unsuspend Seller Account</h3>
                <div class="mt-2 text-sm text-green-700">
                  <p>This action will reactivate the seller's account and restore their ability to create listings and process orders.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Suspension Details -->
          <div v-if="seller.suspension_reason" class="bg-gray-50 rounded-lg p-4 mb-4">
            <h4 class="font-medium text-gray-900 mb-2">Current Suspension</h4>
            <div class="text-sm text-gray-600">
              <p><strong>Reason:</strong> {{ seller.suspension_reason }}</p>
              <p v-if="seller.suspended_until">
                <strong>Until:</strong> {{ formatDateTime(seller.suspended_until) }}
              </p>
            </div>
          </div>

          <form @submit.prevent="unsuspendSeller" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Unsuspension Notes
              </label>
              <textarea v-model="unsuspensionForm.notes" rows="3"
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                placeholder="Add notes about why the suspension is being lifted..."></textarea>
            </div>

            <div class="flex justify-end space-x-3">
              <button type="button" @click="closeModal"
                class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" :disabled="processing"
                class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50">
                {{ processing ? 'Unsuspending...' : 'Unsuspend Seller' }}
              </button>
            </div>
          </form>
        </div>

        <!-- Update Seller Tier -->
        <div v-if="actionType === 'update_tier'">
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div class="flex">
              <InformationCircleIcon class="h-5 w-5 text-blue-400 mt-0.5" />
              <div class="ml-3">
                <h3 class="text-sm font-medium text-blue-800">Update Seller Tier</h3>
                <div class="mt-2 text-sm text-blue-700">
                  <p>Change the seller's tier to adjust their listing limits, commission rates, and available features.</p>
                </div>
              </div>
            </div>
          </div>

          <form @submit.prevent="updateSellerTier" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Current Tier: <span class="font-medium capitalize">{{ seller.seller_tier || 'Standard' }}</span>
              </label>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                New Tier *
              </label>
              <select v-model="tierUpdateForm.new_tier" required
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Reason for Change
              </label>
              <textarea v-model="tierUpdateForm.reason" rows="3"
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Explain why the tier is being changed..."></textarea>
            </div>

            <div class="flex justify-end space-x-3">
              <button type="button" @click="closeModal"
                class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" :disabled="processing"
                class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                {{ processing ? 'Updating...' : 'Update Tier' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import {
  XMarkIcon,
  UserIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon
} from '@heroicons/vue/24/outline'
import api from '@/lib/api'

const props = defineProps({
  seller: {
    type: Object,
    required: true
  },
  actionType: {
    type: String,
    required: true,
    validator: (value) => ['view', 'suspend', 'unsuspend', 'update_tier'].includes(value)
  }
})

const emit = defineEmits(['close', 'completed'])

// Reactive data
const processing = ref(false)
const recentActivity = ref([])

const suspensionForm = ref({
  reason: '',
  duration_days: '',
  notes: ''
})

const unsuspensionForm = ref({
  notes: ''
})

const tierUpdateForm = ref({
  new_tier: props.seller.seller_tier || 'standard',
  reason: ''
})

// Methods
const closeModal = () => {
  emit('close')
}

const loadRecentActivity = async () => {
  try {
    // This would load recent seller activity from an API
    // For now, we'll simulate some activity
    recentActivity.value = [
      {
        id: 1,
        description: 'Created new listing',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
      },
      {
        id: 2,
        description: 'Order shipped',
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
      },
      {
        id: 3,
        description: 'Payout processed',
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
      }
    ]
  } catch (error) {
    console.error('Error loading recent activity:', error)
  }
}

const suspendSeller = async () => {
  processing.value = true
  try {
    await api.post(`/admin/sellers/${props.seller.id}/suspend`, suspensionForm.value)
    emit('completed')
    closeModal()
  } catch (error) {
    console.error('Error suspending seller:', error)
    alert('Error suspending seller: ' + (error.response?.data?.error || error.message))
  } finally {
    processing.value = false
  }
}

const unsuspendSeller = async () => {
  processing.value = true
  try {
    await api.post(`/admin/sellers/${props.seller.id}/unsuspend`, unsuspensionForm.value)
    emit('completed')
    closeModal()
  } catch (error) {
    console.error('Error unsuspending seller:', error)
    alert('Error unsuspending seller: ' + (error.response?.data?.error || error.message))
  } finally {
    processing.value = false
  }
}

const updateSellerTier = async () => {
  processing.value = true
  try {
    await api.patch(`/admin/sellers/${props.seller.id}/tier`, tierUpdateForm.value)
    emit('completed')
    closeModal()
  } catch (error) {
    console.error('Error updating seller tier:', error)
    alert('Error updating seller tier: ' + (error.response?.data?.error || error.message))
  } finally {
    processing.value = false
  }
}

// Formatting methods
const formatDate = (date) => {
  return new Date(date).toLocaleDateString()
}

const formatDateTime = (date) => {
  return new Date(date).toLocaleString()
}

const getModalTitle = () => {
  const titles = {
    'view': 'Seller Details',
    'suspend': 'Suspend Seller',
    'unsuspend': 'Unsuspend Seller',
    'update_tier': 'Update Seller Tier'
  }
  return titles[props.actionType] || 'Seller Action'
}

const getSellerStatusClass = (seller) => {
  if (seller.suspended) {
    return 'bg-red-100 text-red-800 font-medium'
  }
  return 'bg-green-100 text-green-800 font-medium'
}

// Initialize
onMounted(() => {
  if (props.actionType === 'view') {
    loadRecentActivity()
  }
})
</script>

<style scoped>
/* Custom scrollbar for modal */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>