<template>
  <div class="min-h-screen bg-gray-50 py-8">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="bg-white rounded-lg shadow-lg overflow-hidden">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h1 class="text-2xl font-bold text-gray-900">Checkout</h1>
          <p class="text-gray-600 mt-1">Complete your purchase securely</p>
        </div>

        <div class="flex flex-col lg:flex-row">
          <!-- Main Checkout Form -->
          <div class="flex-1 px-6 py-6">
            <form @submit.prevent="processOrder" class="space-y-8">
              
              <!-- Step 1: Shipping Address -->
              <div class="space-y-4">
                <div class="flex items-center mb-4">
                  <span class="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white text-sm font-medium mr-3">1</span>
                  <h2 class="text-xl font-semibold text-gray-900">Shipping Address</h2>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div class="sm:col-span-2">
                    <label for="shipping-name" class="block text-sm font-medium text-gray-700">Full Name *</label>
                    <input
                      id="shipping-name"
                      v-model="shippingAddress.name"
                      type="text"
                      required
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="John Doe"
                    />
                  </div>

                  <div class="sm:col-span-2">
                    <label for="shipping-street1" class="block text-sm font-medium text-gray-700">Street Address *</label>
                    <input
                      id="shipping-street1"
                      v-model="shippingAddress.street1"
                      type="text"
                      required
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="123 Main Street"
                    />
                  </div>

                  <div class="sm:col-span-2">
                    <label for="shipping-street2" class="block text-sm font-medium text-gray-700">Apt, Suite, etc. (Optional)</label>
                    <input
                      id="shipping-street2"
                      v-model="shippingAddress.street2"
                      type="text"
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Apartment, suite, unit, etc."
                    />
                  </div>

                  <div>
                    <label for="shipping-city" class="block text-sm font-medium text-gray-700">City *</label>
                    <input
                      id="shipping-city"
                      v-model="shippingAddress.city"
                      type="text"
                      required
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Toronto"
                    />
                  </div>

                  <div>
                    <label for="shipping-province" class="block text-sm font-medium text-gray-700">Province/State *</label>
                    <input
                      id="shipping-province"
                      v-model="shippingAddress.province"
                      type="text"
                      required
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="ON"
                    />
                  </div>

                  <div>
                    <label for="shipping-postal" class="block text-sm font-medium text-gray-700">Postal/Zip Code *</label>
                    <input
                      id="shipping-postal"
                      v-model="shippingAddress.postalCode"
                      type="text"
                      required
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="K1A 0A6"
                    />
                  </div>

                  <div>
                    <label for="shipping-country" class="block text-sm font-medium text-gray-700">Country *</label>
                    <select
                      id="shipping-country"
                      v-model="shippingAddress.country"
                      required
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Country</option>
                      <option value="CA">Canada</option>
                      <option value="US">United States</option>
                      <option value="GB">United Kingdom</option>
                      <option value="AU">Australia</option>
                      <!-- Add more countries as needed -->
                    </select>
                  </div>

                  <div class="sm:col-span-2">
                    <label for="shipping-phone" class="block text-sm font-medium text-gray-700">Phone Number</label>
                    <input
                      id="shipping-phone"
                      v-model="shippingAddress.phone"
                      type="tel"
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>
              </div>

              <!-- Step 2: Billing Address -->
              <div class="space-y-4">
                <div class="flex items-center mb-4">
                  <span class="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white text-sm font-medium mr-3">2</span>
                  <h2 class="text-xl font-semibold text-gray-900">Billing Address</h2>
                </div>

                <div class="flex items-center space-x-3 mb-4">
                  <input
                    id="same-address"
                    v-model="sameAsShipping"
                    @change="toggleSameAsShipping"
                    type="checkbox"
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label for="same-address" class="text-sm text-gray-700">
                    My billing address is the same as my shipping address
                  </label>
                </div>

                <div v-if="!sameAsShipping" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div class="sm:col-span-2">
                    <label for="billing-name" class="block text-sm font-medium text-gray-700">Full Name *</label>
                    <input
                      id="billing-name"
                      v-model="billingAddress.name"
                      type="text"
                      required
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="John Doe"
                    />
                  </div>

                  <div class="sm:col-span-2">
                    <label for="billing-street1" class="block text-sm font-medium text-gray-700">Street Address *</label>
                    <input
                      id="billing-street1"
                      v-model="billingAddress.street1"
                      type="text"
                      required
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="123 Main Street"
                    />
                  </div>

                  <div class="sm:col-span-2">
                    <label for="billing-street2" class="block text-sm font-medium text-gray-700">Apt, Suite, etc. (Optional)</label>
                    <input
                      id="billing-street2"
                      v-model="billingAddress.street2"
                      type="text"
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Apartment, suite, unit, etc."
                    />
                  </div>

                  <div>
                    <label for="billing-city" class="block text-sm font-medium text-gray-700">City *</label>
                    <input
                      id="billing-city"
                      v-model="billingAddress.city"
                      type="text"
                      required
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Toronto"
                    />
                  </div>

                  <div>
                    <label for="billing-province" class="block text-sm font-medium text-gray-700">Province/State *</label>
                    <input
                      id="billing-province"
                      v-model="billingAddress.province"
                      type="text"
                      required
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="ON"
                    />
                  </div>

                  <div>
                    <label for="billing-postal" class="block text-sm font-medium text-gray-700">Postal/Zip Code *</label>
                    <input
                      id="billing-postal"
                      v-model="billingAddress.postalCode"
                      type="text"
                      required
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="K1A 0A6"
                    />
                  </div>

                  <div>
                    <label for="billing-country" class="block text-sm font-medium text-gray-700">Country *</label>
                    <select
                      id="billing-country"
                      v-model="billingAddress.country"
                      required
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Country</option>
                      <option value="CA">Canada</option>
                      <option value="US">United States</option>
                      <option value="GB">United Kingdom</option>
                      <option value="AU">Australia</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Step 3: Payment Information -->
              <div class="space-y-4">
                <div class="flex items-center mb-4">
                  <span class="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white text-sm font-medium mr-3">3</span>
                  <h2 class="text-xl font-semibold text-gray-900">Payment Information</h2>
                </div>

                <div class="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                  <div class="flex">
                    <div class="flex-shrink-0">
                      <svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                      </svg>
                    </div>
                    <div class="ml-3">
                      <h3 class="text-sm font-medium text-blue-800">Secure Payment</h3>
                      <div class="mt-2 text-sm text-blue-700">
                        <p>Your payment is processed securely through Helcim. We accept Visa, Mastercard, American Express, and Discover.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="space-y-4">
                  <div>
                    <label for="card-number" class="block text-sm font-medium text-gray-700">Card Number *</label>
                    <input
                      id="card-number"
                      v-model="paymentInfo.cardNumber"
                      @input="formatCardNumber"
                      type="text"
                      required
                      maxlength="19"
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="1234 5678 9012 3456"
                    />
                    <div v-if="cardType" class="mt-1 text-sm text-gray-500">
                      {{ cardType }} detected
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label for="expiry" class="block text-sm font-medium text-gray-700">Expiry Date *</label>
                      <input
                        id="expiry"
                        v-model="paymentInfo.expiryDate"
                        @input="formatExpiryDate"
                        type="text"
                        required
                        maxlength="5"
                        class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="MM/YY"
                      />
                    </div>

                    <div>
                      <label for="cvc" class="block text-sm font-medium text-gray-700">CVC *</label>
                      <input
                        id="cvc"
                        v-model="paymentInfo.cvc"
                        type="text"
                        required
                        maxlength="4"
                        class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="123"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="cardholder-name" class="block text-sm font-medium text-gray-700">Cardholder Name *</label>
                    <input
                      id="cardholder-name"
                      v-model="paymentInfo.cardholderName"
                      type="text"
                      required
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="John Doe"
                    />
                  </div>
                </div>
              </div>

              <!-- Step 4: Order Confirmation -->
              <div class="space-y-4">
                <div class="flex items-center mb-4">
                  <span class="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white text-sm font-medium mr-3">4</span>
                  <h2 class="text-xl font-semibold text-gray-900">Review & Confirm</h2>
                </div>

                <div class="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <h3 class="font-medium text-gray-900 mb-3">Order Summary</h3>
                  <div v-if="cartStore.items.length > 0" class="space-y-2">
                    <div v-for="item in cartStore.items" :key="item.id" class="flex justify-between items-center text-sm">
                      <div class="flex-1">
                        <span class="font-medium">{{ item.listings?.cards?.name }}</span>
                        <span class="text-gray-500 ml-2">({{ getConditionLabel(item.listings?.condition) }}) x{{ item.quantity }}</span>
                      </div>
                      <span class="font-medium">${{ (item.listings?.price * item.quantity).toFixed(2) }} CAD</span>
                    </div>
                  </div>
                  
                  <div class="mt-4 pt-4 border-t border-gray-200 space-y-2">
                    <div class="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>${{ cartStore.summary.subtotal }} CAD</span>
                    </div>
                    <div class="flex justify-between text-sm">
                      <span>Shipping:</span>
                      <span v-if="shippingCost !== null">${{ shippingCost.toFixed(2) }} CAD</span>
                      <span v-else class="text-gray-500">Calculating...</span>
                    </div>
                    
                    <!-- Shipping breakdown by seller -->
                    <div v-if="shippingDetails.length > 1" class="ml-4 mt-2 space-y-1">
                      <div v-for="shipment in shippingDetails" :key="shipment.seller_id" 
                           class="flex justify-between text-xs text-gray-600">
                        <span class="truncate max-w-[200px]">{{ shipment.seller_name }}:</span>
                        <span>${{ shipment.shipping_cost.toFixed(2) }} ({{ shipment.service_name }})</span>
                      </div>
                    </div>
                    
                    <div class="flex justify-between text-sm">
                      <span>Tax (HST):</span>
                      <span>${{ taxAmount.toFixed(2) }} CAD</span>
                    </div>
                    <div class="flex justify-between font-bold text-lg pt-2 border-t border-gray-200">
                      <span>Total:</span>
                      <span>${{ totalAmount.toFixed(2) }} CAD</span>
                    </div>
                  </div>
                </div>

                <div class="flex items-start space-x-3">
                  <input
                    id="terms-agreement"
                    v-model="agreedToTerms"
                    type="checkbox"
                    required
                    class="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label for="terms-agreement" class="text-sm text-gray-700">
                    I agree to the <a href="/terms" target="_blank" class="text-blue-600 hover:text-blue-500">Terms of Service</a> 
                    and <a href="/privacy" target="_blank" class="text-blue-600 hover:text-blue-500">Privacy Policy</a>
                  </label>
                </div>
              </div>

              <!-- Submit Button -->
              <div class="pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  :disabled="processing || !agreedToTerms"
                  class="w-full bg-green-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  <span v-if="processing" class="flex items-center">
                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing Order...
                  </span>
                  <span v-else>Complete Order - ${{ totalAmount.toFixed(2) }} CAD</span>
                </button>
              </div>
            </form>
          </div>

          <!-- Order Summary Sidebar -->
          <div class="w-full lg:w-96 bg-gray-50 px-6 py-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Your Order</h3>
            
            <div v-if="cartStore.items.length > 0" class="space-y-3 mb-6">
              <div v-for="item in cartStore.items" :key="item.id" class="flex items-center space-x-3 pb-3 border-b border-gray-200 last:border-b-0">
                <img 
                  v-if="item.listings?.cards?.image_url"
                  :src="item.listings.cards.image_url" 
                  :alt="item.listings.cards.name"
                  class="h-16 w-12 object-cover rounded-md flex-shrink-0"
                />
                <div class="flex-1 min-w-0">
                  <h4 class="text-sm font-medium text-gray-900 truncate">
                    {{ item.listings?.cards?.name }}
                  </h4>
                  <p class="text-xs text-gray-500">
                    {{ getConditionLabel(item.listings?.condition) }}
                  </p>
                  <p class="text-xs text-gray-500">
                    Qty: {{ item.quantity }} × ${{ item.listings?.price }}
                  </p>
                </div>
                <div class="text-sm font-medium text-gray-900">
                  ${{ (item.listings?.price * item.quantity).toFixed(2) }}
                </div>
              </div>
            </div>

            <div class="space-y-2 text-sm border-t border-gray-200 pt-4">
              <div class="flex justify-between">
                <span>Subtotal:</span>
                <span>${{ cartStore.summary.subtotal }} CAD</span>
              </div>
              <div class="flex justify-between">
                <span>Shipping:</span>
                <span v-if="shippingCost !== null">${{ shippingCost.toFixed(2) }} CAD</span>
                <span v-else class="text-gray-500">TBD</span>
              </div>
              
              <!-- Shipping breakdown in sidebar -->
              <div v-if="shippingDetails.length > 1" class="ml-4 space-y-1">
                <div v-for="shipment in shippingDetails" :key="shipment.seller_id" 
                     class="flex justify-between text-xs text-gray-600">
                  <span class="truncate max-w-[120px]">{{ shipment.seller_name }}:</span>
                  <span>${{ shipment.shipping_cost.toFixed(2) }}</span>
                </div>
              </div>
              
              <div class="flex justify-between">
                <span>Tax:</span>
                <span>${{ taxAmount.toFixed(2) }} CAD</span>
              </div>
              <div class="flex justify-between font-bold text-base pt-2 border-t border-gray-200">
                <span>Total:</span>
                <span>${{ totalAmount.toFixed(2) }} CAD</span>
              </div>
            </div>

            <!-- Security badges -->
            <div class="mt-6 pt-6 border-t border-gray-200">
              <div class="text-center">
                <p class="text-xs text-gray-500 mb-2">Secured by</p>
                <div class="text-xs text-gray-600 font-medium">🔒 Helcim SSL Encryption</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Error Messages -->
      <div v-if="errorMessage" class="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">
              Payment Error
            </h3>
            <div class="mt-2 text-sm text-red-700">
              {{ errorMessage }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'vue-toastification'
import api from '@/lib/api'

const router = useRouter()
const cartStore = useCartStore()
const authStore = useAuthStore()
const toast = useToast()

// Form data
const shippingAddress = reactive({
  name: '',
  street1: '',
  street2: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'CAN',
  phone: ''
})

const billingAddress = reactive({
  name: '',
  street1: '',
  street2: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'CAN'
})

const paymentInfo = reactive({
  cardNumber: '',
  expiryDate: '',
  cvc: '',
  cardholderName: ''
})

// State
const sameAsShipping = ref(true)
const agreedToTerms = ref(false)
const processing = ref(false)
const errorMessage = ref('')
const shippingCost = ref(null)
const shippingDetails = ref([]) // Store detailed shipping info

// Card type detection
const cardType = computed(() => {
  const number = paymentInfo.cardNumber.replace(/\s/g, '')
  if (/^4/.test(number)) return 'Visa'
  if (/^5[1-5]/.test(number)) return 'Mastercard'
  if (/^3[47]/.test(number)) return 'American Express'
  if (/^6011|^65/.test(number)) return 'Discover'
  return null
})

// Calculate tax amount (13% HST for Canada, adjust as needed)
const taxAmount = computed(() => {
  const subtotal = parseFloat(cartStore.summary.subtotal || 0)
  const shipping = parseFloat(shippingCost.value || 0)
  const taxableAmount = subtotal + shipping
  
  // HST rate based on shipping province/country
  const hstRate = shippingAddress.country === 'CA' ? 0.13 : 0
  return taxableAmount * hstRate
})

// Calculate total amount
const totalAmount = computed(() => {
  const subtotal = parseFloat(cartStore.summary.subtotal || 0)
  const shipping = parseFloat(shippingCost.value || 0)
  const tax = taxAmount.value
  return subtotal + shipping + tax
})

// Helper functions
const getConditionLabel = (condition) => {
  const labels = {
    near_mint: 'Near Mint',
    lightly_played: 'Lightly Played',
    moderately_played: 'Moderately Played',
    heavily_played: 'Heavily Played',
    damaged: 'Damaged'
  }
  return labels[condition] || condition.replace('_', ' ').toUpperCase()
}

const formatCardNumber = () => {
  let value = paymentInfo.cardNumber.replace(/\s/g, '')
  value = value.replace(/(.{4})/g, '$1 ')
  paymentInfo.cardNumber = value.trim()
}

const formatExpiryDate = () => {
  let value = paymentInfo.expiryDate.replace(/\D/g, '')
  if (value.length >= 2) {
    value = value.substring(0, 2) + '/' + value.substring(2, 4)
  }
  paymentInfo.expiryDate = value
}

const toggleSameAsShipping = () => {
  if (sameAsShipping.value) {
    Object.assign(billingAddress, {
      name: shippingAddress.name,
      street1: shippingAddress.street1,
      street2: shippingAddress.street2,
      city: shippingAddress.city,
      province: shippingAddress.province,
      postalCode: shippingAddress.postalCode,
      country: shippingAddress.country
    })
  }
}

const calculateShipping = async () => {
  try {
    // Require minimum address info for shipping calculation
    if (!shippingAddress.country || !shippingAddress.city || !shippingAddress.province) {
      shippingCost.value = null
      return
    }
    
    const response = await api.post('/shipping/calculate', {
        items: cartStore.items.map(item => ({
          listing_id: item.listings?.id || item.id,
          quantity: item.quantity
        })),
        shipping_address: {
          name: shippingAddress.name || 'Customer',
          street1: shippingAddress.street1,
          street2: shippingAddress.street2,
          city: shippingAddress.city,
          province: shippingAddress.province,
          postalCode: shippingAddress.postalCode,
          country: 'CAN',//shippingAddress.country, //TODO: Convert to iso-code-3 from country
          phone: shippingAddress.phone
        }
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.success) {
        shippingCost.value = parseFloat(data.totalCost)
        // Store shipping details for order creation
        shippingDetails.value = data.shipments
      } else {
        throw new Error(data.error || 'Shipping calculation failed')
      }
    } else {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Shipping calculation failed')
    }
  } catch (error) {
    console.error('Error calculating shipping:', error)
    // Use fallback shipping cost based on number of unique sellers
    const uniqueSellers = new Set(cartStore.items.map(item => item.listings?.seller_id)).size
    shippingCost.value = uniqueSellers * 5.99 // $5.99 per seller as fallback
    shippingDetails.value = []
  }
}

const processPaymentAndCreateOrder = async () => {
  try {
    // First, create payment intent without creating order
    const intentResponse = await api.post('/payment/create-intent', {
        items: cartStore.items.map(item => ({
          listing_id: item.listings?.id || item.id,
          quantity: item.quantity,
          price: item.listings?.price
        })),
        amount: totalAmount.value,
        currency: 'CAD',
        billing_address: sameAsShipping.value ? shippingAddress : billingAddress,
        shipping_cost: shippingCost.value,
        tax_amount: taxAmount.value,
        subtotal: parseFloat(cartStore.summary.subtotal),
                card_number: paymentInfo.cardNumber.replace(/\s/g, ''),
        card_expiry: paymentInfo.expiryDate,
        card_cvv: paymentInfo.cvc,
        cardholder_name: paymentInfo.cardholderName,
    })
    
    if (!intentResponse.ok) {
      const error = await intentResponse.json()
      throw new Error(error.error || 'Failed to create payment intent')
    }
    
    const intentData = await intentResponse.json()
    
    // Process payment with card details
    const paymentResponse = await api.post('/order/process-and-create-order', {
        payment_intent_id: intentData.payment_intent.paymentIntentId,
        card_number: paymentInfo.cardNumber.replace(/\s/g, ''),
        expiry_month: paymentInfo.expiryDate.split('/')[0],
        expiry_year: '20' + paymentInfo.expiryDate.split('/')[1],
        cvc: paymentInfo.cvc,
        cardholder_name: paymentInfo.cardholderName,
        // Order data to create only after successful payment
        order_data: {
          items: cartStore.items.map(item => ({
            listing_id: item.listings?.id || item.id,
            quantity: item.quantity
          })),
          shipping_address: shippingAddress,
          billing_address: sameAsShipping.value ? shippingAddress : billingAddress,
          subtotal: parseFloat(cartStore.summary.subtotal),
          shipping_cost: shippingCost.value,
          tax_amount: taxAmount.value,
          total_amount: totalAmount.value,
          shipping_details: shippingDetails.value
        }
    })
    
    if (!paymentResponse.ok) {
      const error = await paymentResponse.json()

      //TODO: save customer id to users table to reference later.
      //TODO: implement save card on file
      throw new Error(error.error || 'Payment failed')
    }
    
    const result = await paymentResponse.json()
    
    if (!result.success) {
      throw new Error(result.error || 'Payment failed')
    }
    
    return result
  } catch (error) {
    console.error('Error processing payment and creating order:', error)
    throw error
  }
}

const processOrder = async () => {
  processing.value = true
  errorMessage.value = ''
  
  try {
    // Validate form data
    if (!validateForm()) {
      return
    }
    
    // Process payment and create order atomically
    const result = await processPaymentAndCreateOrder()
    
    if (result.success) {
      // Clear cart only after successful payment and order creation
      await cartStore.clearCart()
      
      // Show success message
      toast.success('Order placed successfully!')
      
      // Redirect to order confirmation
      router.push(`/orders/${result.order.id}`)
    } else {
      throw new Error(result.error || 'Order processing failed')
    }
  } catch (error) {
    console.error('Order processing error:', error)
    errorMessage.value = error.message || 'An error occurred while processing your order. Please try again.'
  } finally {
    processing.value = false
  }
}

const validateForm = () => {
  // Reset error
  errorMessage.value = ''
  
  // Check required shipping fields
  const requiredShippingFields = ['name', 'street1', 'city', 'province', 'postalCode', 'country']
  for (const field of requiredShippingFields) {
    if (!shippingAddress[field]) {
      errorMessage.value = `Please fill in all required shipping address fields.`
      return false
    }
  }
  
  // Check billing fields if different from shipping
  if (!sameAsShipping.value) {
    const requiredBillingFields = ['name', 'street1', 'city', 'province', 'postalCode', 'country']
    for (const field of requiredBillingFields) {
      if (!billingAddress[field]) {
        errorMessage.value = `Please fill in all required billing address fields.`
        return false
      }
    }
  }
  
  // Validate payment information
  if (!paymentInfo.cardNumber || paymentInfo.cardNumber.replace(/\s/g, '').length < 13) {
    errorMessage.value = 'Please enter a valid card number.'
    return false
  }
  
  if (!paymentInfo.expiryDate || !paymentInfo.expiryDate.match(/^\d{2}\/\d{2}$/)) {
    errorMessage.value = 'Please enter a valid expiry date (MM/YY).'
    return false
  }
  
  if (!paymentInfo.cvc || paymentInfo.cvc.length < 3) {
    errorMessage.value = 'Please enter a valid CVC code.'
    return false
  }
  
  if (!paymentInfo.cardholderName) {
    errorMessage.value = 'Please enter the cardholder name.'
    return false
  }
  
  // Check terms agreement
  if (!agreedToTerms.value) {
    errorMessage.value = 'Please agree to the terms of service and privacy policy.'
    return false
  }
  
  return true
}

// Watch for changes to shipping address to recalculate shipping
watch([() => shippingAddress.country, () => shippingAddress.province, () => shippingAddress.city], () => {
  calculateShipping()
}, { deep: true })

// Watch for same as shipping toggle
watch(sameAsShipping, toggleSameAsShipping)

// Initialize component
onMounted(async () => {
  // Check if user is authenticated
  if (!authStore.isAuthenticated) {
    toast.error('Please sign in to checkout')
    router.push('/auth/signin?redirect=/checkout')
    return
  }
  
  // Check if cart has items
  if (cartStore.items.length === 0) {
    toast.error('Your cart is empty')
    router.push('/cards')
    return
  }
  
  // Fetch cart data
  await cartStore.fetchCart()
  
  // Pre-populate shipping address if user has a saved address
  if (authStore.user?.shipping_address) {
    Object.assign(shippingAddress, authStore.user.shipping_address)
  }
  
  // Calculate initial shipping
  await calculateShipping()
})
</script>

<style scoped>
/* Additional styles for form validation */
.error-border {
  @apply border-red-300 focus:border-red-500 focus:ring-red-500;
}

/* Loading animation */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Card input styling */
input[type="text"]:focus,
input[type="tel"]:focus,
select:focus {
  @apply ring-2 ring-blue-500 border-blue-500;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .min-h-screen {
    min-height: 100vh;
  }
}
</style>