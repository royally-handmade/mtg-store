<!-- frontend/src/components/admin/SuspendSellerModal.vue -->
<template>
  <div class="fixed inset-0 z-50 overflow-y-auto" @click.self="$emit('close')">
    <div class="flex min-h-screen items-center justify-center p-4">
      <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" @click="$emit('close')"></div>
      
      <div class="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-semibold text-gray-900">Suspend Seller</h3>
          <button @click="$emit('close')" class="text-gray-400 hover:text-gray-500">
            <XMarkIcon class="h-6 w-6" />
          </button>
        </div>

        <!-- Seller Info -->
        <div class="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div class="flex items-start">
            <ExclamationTriangleIcon class="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
            <div class="flex-1">
              <p class="text-sm font-medium text-yellow-800">
                You are about to suspend: <strong>{{ seller.display_name }}</strong>
              </p>
              <p class="text-xs text-yellow-700 mt-1">
                {{ seller.email }}
              </p>
              <p class="text-xs text-yellow-700 mt-2">
                This will deactivate all their listings and prevent them from creating new ones or processing orders.
              </p>
            </div>
          </div>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="space-y-5">
          <!-- Reason Dropdown -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Suspension Reason <span class="text-red-500">*</span>
            </label>
            <select 
              v-model="form.selectedReason" 
              required
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
              @change="onReasonChange"
            >
              <option value="">Select a reason</option>
              <option value="fraudulent_activity">Fraudulent Activity</option>
              <option value="counterfeit_cards">Selling Counterfeit Cards</option>
              <option value="repeated_customer_complaints">Repeated Customer Complaints</option>
              <option value="poor_card_condition">Misrepresenting Card Condition</option>
              <option value="non_shipment">Failure to Ship Orders</option>
              <option value="policy_violation">Policy Violation</option>
              <option value="payment_issues">Payment/Chargeback Issues</option>
              <option value="inappropriate_communication">Inappropriate Communication</option>
              <option value="manipulation_reviews">Review/Rating Manipulation</option>
              <option value="terms_of_service">Terms of Service Violation</option>
              <option value="other">Other (Custom Reason)</option>
            </select>
          </div>

          <!-- Custom Reason Input (shown when "Other" is selected) -->
          <div v-if="form.selectedReason === 'other'">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Custom Reason <span class="text-red-500">*</span>
            </label>
            <input 
              v-model="form.customReason" 
              type="text"
              required
              placeholder="Enter custom suspension reason..."
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
            />
          </div>

          <!-- Duration -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Suspension Duration
            </label>
            <select 
              v-model="form.duration_days"
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
            >
              <option value="">Indefinite (Until Manually Unsuspended)</option>
              <option value="1">1 Day</option>
              <option value="3">3 Days</option>
              <option value="7">7 Days (1 Week)</option>
              <option value="14">14 Days (2 Weeks)</option>
              <option value="30">30 Days (1 Month)</option>
              <option value="60">60 Days (2 Months)</option>
              <option value="90">90 Days (3 Months)</option>
            </select>
            <p class="mt-1 text-xs text-gray-500">
              <span v-if="form.duration_days">
                Seller will be automatically unsuspended on {{ calculateEndDate() }}
              </span>
              <span v-else>
                Seller will remain suspended until you manually unsuspend them
              </span>
            </p>
          </div>

          <!-- Additional Notes -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea 
              v-model="form.notes" 
              rows="4"
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
              placeholder="Add any additional details or context about this suspension..."
            ></textarea>
          </div>

          <!-- Action Buttons -->
          <div class="flex justify-end space-x-3 pt-4 border-t">
            <button 
              type="button" 
              @click="$emit('close')"
              class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              :disabled="isSubmitting || !isFormValid"
              class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="isSubmitting">Suspending...</span>
              <span v-else>Suspend Seller</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  seller: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'suspended'])

const form = ref({
  selectedReason: '',
  customReason: '',
  duration_days: '',
  notes: ''
})

const isSubmitting = ref(false)

// Computed
const isFormValid = computed(() => {
  if (!form.value.selectedReason) return false
  if (form.value.selectedReason === 'other' && !form.value.customReason.trim()) return false
  return true
})

const finalReason = computed(() => {
  if (form.value.selectedReason === 'other') {
    return form.value.customReason
  }
  // Convert snake_case to readable format
  return form.value.selectedReason
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
})

// Methods
const onReasonChange = () => {
  // Clear custom reason when switching away from "other"
  if (form.value.selectedReason !== 'other') {
    form.value.customReason = ''
  }
}

const calculateEndDate = () => {
  if (!form.value.duration_days) return ''
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + parseInt(form.value.duration_days))
  return endDate.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

const handleSubmit = async () => {
  if (!isFormValid.value || isSubmitting.value) return

  const confirmMessage = form.value.duration_days
    ? `Are you sure you want to suspend ${props.seller.display_name} for ${form.value.duration_days} day(s)?`
    : `Are you sure you want to suspend ${props.seller.display_name} indefinitely?`

  if (!confirm(confirmMessage)) return

  isSubmitting.value = true

  try {
    const payload = {
      reason: finalReason.value,
      duration_days: form.value.duration_days ? parseInt(form.value.duration_days) : null,
      notes: form.value.notes || null
    }

    emit('suspended', payload)
  } catch (error) {
    console.error('Error in suspend form:', error)
    isSubmitting.value = false
  }
}
</script>