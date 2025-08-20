<template>
  <div class="space-y-6">
    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
        <select v-model="form.payment_method" required class="input-field">
          <option value="">Select payment method</option>
          <option value="paypal">PayPal</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="stripe">Stripe Direct</option>
        </select>
      </div>

      <div v-if="form.payment_method === 'paypal'">
        <label class="block text-sm font-medium text-gray-700 mb-1">PayPal Email</label>
        <input v-model="form.paypal_email" type="email" required 
          class="input-field" placeholder="your@paypal.com" />
      </div>

      <div v-else-if="form.payment_method === 'bank_transfer'" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
          <input v-model="form.bank_name" type="text" required class="input-field" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
          <input v-model="form.account_number" type="text" required class="input-field" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Routing Number</label>
          <input v-model="form.routing_number" type="text" required class="input-field" />
        </div>
      </div>

      <div v-else-if="form.payment_method === 'stripe'">
        <label class="block text-sm font-medium text-gray-700 mb-1">Stripe Account ID</label>
        <input v-model="form.stripe_account_id" type="text" required 
          class="input-field" placeholder="acct_..." />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Minimum Payout Amount (CAD)</label>
        <input v-model="form.minimum_payout" type="number" step="0.01" min="25" 
          class="input-field" placeholder="25.00" />
        <p class="text-xs text-gray-500 mt-1">Minimum $25.00 CAD</p>
      </div>

      <button type="submit" :disabled="loading" 
        class="btn-primary disabled:opacity-50">
        {{ loading ? 'Updating...' : 'Update Payout Settings' }}
      </button>
    </form>

    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 class="font-medium text-blue-900 mb-2">Payout Information</h3>
      <ul class="text-sm text-blue-800 space-y-1">
        <li>• Payouts are processed weekly on Fridays</li>
        <li>• Platform fee: 2.5% per transaction</li>
        <li>• Minimum payout threshold: $25.00 CAD</li>
        <li>• Processing time: 3-5 business days</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useToast } from 'vue-toastification'

const props = defineProps({
  settings: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update'])
const toast = useToast()

const loading = ref(false)
const form = ref({
  payment_method: '',
  paypal_email: '',
  bank_name: '',
  account_number: '',
  routing_number: '',
  stripe_account_id: '',
  minimum_payout: 25.00
})

const handleSubmit = async () => {
  loading.value = true
  try {
    const paymentDetails = {}
    
    switch (form.value.payment_method) {
      case 'paypal':
        paymentDetails.email = form.value.paypal_email
        break
      case 'bank_transfer':
        paymentDetails.bank_name = form.value.bank_name
        paymentDetails.account_number = form.value.account_number
        paymentDetails.routing_number = form.value.routing_number
        break
      case 'stripe':
        paymentDetails.account_id = form.value.stripe_account_id
        break
    }

    const settings = {
      payment_method: form.value.payment_method,
      payment_details: paymentDetails,
      minimum_payout: form.value.minimum_payout
    }

    emit('update', settings)
    toast.success('Payout settings updated successfully!')
  } catch (error) {
    toast.error('Error updating payout settings')
  } finally {
    loading.value = false
  }
}

watch(() => props.settings, (newSettings) => {
  if (newSettings && newSettings.payment_method) {
    form.value.payment_method = newSettings.payment_method
    form.value.minimum_payout = newSettings.minimum_payout || 25.00
    
    if (newSettings.payment_details) {
      const details = newSettings.payment_details
      form.value.paypal_email = details.email || ''
      form.value.bank_name = details.bank_name || ''
      form.value.account_number = details.account_number || ''
      form.value.routing_number = details.routing_number || ''
      form.value.stripe_account_id = details.account_id || ''
    }
  }
}, { immediate: true })
</script>