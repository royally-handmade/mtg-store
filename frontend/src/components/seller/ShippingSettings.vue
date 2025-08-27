<template>
  <div class="bg-white shadow rounded-lg">
    <div class="px-6 py-4 border-b border-gray-200">
      <h3 class="text-lg leading-6 font-medium text-gray-900">Shipping Settings</h3>
      <p class="mt-1 text-sm text-gray-500">
        Configure your shipping preferences and rates
      </p>
    </div>

    <form @submit.prevent="saveSettings" class="space-y-6 px-6 py-6">
      <!-- Default Shipping Method -->
      <div>
        <label class="text-base font-medium text-gray-900">Default Shipping Method</label>
        <p class="text-sm leading-5 text-gray-500">Choose how shipping costs are calculated for your listings</p>
        <fieldset class="mt-4">
          <div class="space-y-4">
            <div class="flex items-center">
              <input
                id="dynamic-shipping"
                v-model="settings.default_shipping_method"
                name="shipping-method"
                type="radio"
                value="dynamic"
                class="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label for="dynamic-shipping" class="ml-3">
                <span class="block text-sm font-medium text-gray-700">
                  Dynamic Shipping (Recommended)
                </span>
                <span class="block text-sm text-gray-500">
                  Calculate real shipping rates using EasyPost based on buyer's location
                </span>
              </label>
            </div>
            
            <div class="flex items-center">
              <input
                id="static-shipping"
                v-model="settings.default_shipping_method"
                name="shipping-method"
                type="radio"
                value="static"
                class="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label for="static-shipping" class="ml-3">
                <span class="block text-sm font-medium text-gray-700">
                  Fixed Shipping Rates
                </span>
                <span class="block text-sm text-gray-500">
                  Set your own flat shipping rates (configure below)
                </span>
              </label>
            </div>
          </div>
        </fieldset>
      </div>

      <!-- Static Shipping Rates -->
      <div v-if="settings.default_shipping_method === 'static'" class="space-y-4">
        <h4 class="text-sm font-medium text-gray-900">Fixed Shipping Rates</h4>
        
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label for="domestic-rate" class="block text-sm font-medium text-gray-700">
              Domestic (Canada)
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span class="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                id="domestic-rate"
                v-model="settings.shipping_rates.domestic"
                type="number"
                step="0.01"
                min="0"
                class="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                placeholder="5.99"
              />
              <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span class="text-gray-500 sm:text-sm">CAD</span>
              </div>
            </div>
          </div>

          <div>
            <label for="us-rate" class="block text-sm font-medium text-gray-700">
              United States
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span class="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                id="us-rate"
                v-model="settings.shipping_rates.us"
                type="number"
                step="0.01"
                min="0"
                class="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                placeholder="12.99"
              />
              <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span class="text-gray-500 sm:text-sm">CAD</span>
              </div>
            </div>
          </div>

          <div>
            <label for="international-rate" class="block text-sm font-medium text-gray-700">
              International
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span class="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                id="international-rate"
                v-model="settings.shipping_rates.international"
                type="number"
                step="0.01"
                min="0"
                class="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                placeholder="19.99"
              />
              <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span class="text-gray-500 sm:text-sm">CAD</span>
              </div>
            </div>
          </div>

          <div>
            <label for="expedited-rate" class="block text-sm font-medium text-gray-700">
              Expedited (Optional)
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span class="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                id="expedited-rate"
                v-model="settings.shipping_rates.expedited"
                type="number"
                step="0.01"
                min="0"
                class="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                placeholder="24.99"
              />
              <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span class="text-gray-500 sm:text-sm">CAD</span>
              </div>
            </div>
            <p class="mt-1 text-xs text-gray-500">Leave blank if not offered</p>
          </div>
        </div>
      </div>

      <!-- Shipping Preferences -->
      <div class="space-y-4">
        <h4 class="text-sm font-medium text-gray-900">Shipping Preferences</h4>
        
        <div class="space-y-3">
          <div class="flex items-center">
            <input
              id="tracking-required"
              v-model="settings.preferences.tracking_required"
              type="checkbox"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label for="tracking-required" class="ml-3 block text-sm text-gray-700">
              Always include tracking
            </label>
          </div>

          <div class="flex items-center">
            <input
              id="signature-confirmation"
              v-model="settings.preferences.signature_confirmation"
              type="checkbox"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label for="signature-confirmation" class="ml-3 block text-sm text-gray-700">
              Require signature confirmation for orders over $100
            </label>
          </div>

          <div class="flex items-center">
            <input
              id="insurance"
              v-model="settings.preferences.insurance"
              type="checkbox"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label for="insurance" class="ml-3 block text-sm text-gray-700">
              Add insurance for orders over $50
            </label>
          </div>
        </div>
      </div>

      <!-- Handling Time -->
      <div>
        <label for="handling-time" class="block text-sm font-medium text-gray-700">
          Handling Time
        </label>
        <select
          id="handling-time"
          v-model="settings.handling_time"
          class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
        >
          <option value="1">1 business day</option>
          <option value="2">2 business days</option>
          <option value="3">3 business days</option>
          <option value="5">5 business days</option>
          <option value="7">1 week</option>
        </select>
        <p class="mt-1 text-sm text-gray-500">
          How long it takes you to package and ship items after payment
        </p>
      </div>

      <!-- Packaging Options -->
      <div>
        <label class="text-sm font-medium text-gray-900">Packaging Materials</label>
        <p class="text-sm text-gray-500 mb-3">What packaging do you typically use?</p>
        
        <div class="space-y-2">
          <div class="flex items-center">
            <input
              id="bubble-mailer"
              v-model="settings.packaging"
              type="radio"
              value="bubble_mailer"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <label for="bubble-mailer" class="ml-3 block text-sm text-gray-700">
              Bubble mailer (recommended for cards)
            </label>
          </div>

          <div class="flex items-center">
            <input
              id="cardboard-box"
              v-model="settings.packaging"
              type="radio"
              value="cardboard_box"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <label for="cardboard-box" class="ml-3 block text-sm text-gray-700">
              Small cardboard box
            </label>
          </div>

          <div class="flex items-center">
            <input
              id="envelope"
              v-model="settings.packaging"
              type="radio"
              value="envelope"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <label for="envelope" class="ml-3 block text-sm text-gray-700">
              Standard envelope (single cards only)
            </label>
          </div>
        </div>
      </div>

      <!-- Free Shipping Threshold -->
      <div>
        <label for="free-shipping-threshold" class="block text-sm font-medium text-gray-700">
          Free Shipping Threshold (Optional)
        </label>
        <div class="mt-1 relative rounded-md shadow-sm">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span class="text-gray-500 sm:text-sm">$</span>
          </div>
          <input
            id="free-shipping-threshold"
            v-model="settings.free_shipping_threshold"
            type="number"
            step="0.01"
            min="0"
            class="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
            placeholder="50.00"
          />
          <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span class="text-gray-500 sm:text-sm">CAD</span>
          </div>
        </div>
        <p class="mt-1 text-sm text-gray-500">
          Offer free shipping when order total exceeds this amount (leave blank to disable)
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="flex justify-end pt-6 border-t border-gray-200">
        <button
          type="button"
          @click="resetSettings"
          class="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 mr-3"
        >
          Reset
        </button>
        <button
          type="submit"
          :disabled="saving"
          class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="saving" class="flex items-center">
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Saving...
          </span>
          <span v-else>Save Settings</span>
        </button>
      </div>
    </form>

    <!-- Success/Error Messages -->
    <div v-if="successMessage" class="mx-6 mb-6">
      <div class="rounded-md bg-green-50 p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <p class="text-sm font-medium text-green-800">{{ successMessage }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="errorMessage" class="mx-6 mb-6">
      <div class="rounded-md bg-red-50 p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <p class="text-sm font-medium text-red-800">{{ errorMessage }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'vue-toastification'

const authStore = useAuthStore()
const toast = useToast()

// Component state
const saving = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

// Settings data
const settings = reactive({
  default_shipping_method: 'dynamic',
  shipping_rates: {
    domestic: '',
    us: '',
    international: '',
    expedited: ''
  },
  preferences: {
    tracking_required: false,
    signature_confirmation: false,
    insurance: false
  },
  handling_time: '2',
  packaging: 'bubble_mailer',
  free_shipping_threshold: ''
})

const originalSettings = reactive({})

// Load current settings
const loadSettings = async () => {
  try {
    const response = await fetch('/api/seller/shipping-settings', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      Object.assign(settings, data)
      Object.assign(originalSettings, data)
    }
  } catch (error) {
    console.error('Error loading shipping settings:', error)
  }
}

// Save settings
const saveSettings = async () => {
  saving.value = true
  successMessage.value = ''
  errorMessage.value = ''

  try {
    const response = await fetch('/api/seller/shipping-settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify(settings)
    })

    if (response.ok) {
      successMessage.value = 'Shipping settings saved successfully!'
      Object.assign(originalSettings, settings)
      
      setTimeout(() => {
        successMessage.value = ''
      }, 5000)
    } else {
      const error = await response.json()
      errorMessage.value = error.error || 'Failed to save shipping settings'
    }
  } catch (error) {
    console.error('Error saving shipping settings:', error)
    errorMessage.value = 'An error occurred while saving settings'
  } finally {
    saving.value = false
  }
}

// Reset settings to original values
const resetSettings = () => {
  Object.assign(settings, originalSettings)
  successMessage.value = ''
  errorMessage.value = ''
}

onMounted(() => {
  loadSettings()
})
</script>