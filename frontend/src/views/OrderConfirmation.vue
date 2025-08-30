<template>
  <div class="min-h-screen bg-gray-50 py-8">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      
      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-md p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">Order Not Found</h3>
            <div class="mt-2 text-sm text-red-700">
              {{ error }}
            </div>
            <div class="mt-4">
              <router-link to="/orders" 
                class="text-sm bg-red-100 text-red-800 px-3 py-1 rounded-md hover:bg-red-200">
                View All Orders
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- Order Confirmation -->
      <div v-else-if="order" class="space-y-6">
        
        <!-- Success Header -->
        <div class="bg-green-50 border border-green-200 rounded-lg p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="h-8 w-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="ml-4">
              <h1 class="text-2xl font-bold text-green-900">Order Confirmed!</h1>
              <p class="text-green-700 mt-1">Thank you for your purchase. We've received your order and are processing it now.</p>
            </div>
          </div>
        </div>

        <!-- Order Details Card -->
        <div class="bg-white shadow rounded-lg overflow-hidden">
          
          <!-- Header -->
          <div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div class="flex justify-between items-center">
              <div>
                <h2 class="text-xl font-semibold text-gray-900">Order #{{ order.order_number }}</h2>
                <p class="text-sm text-gray-600 mt-1">Placed on {{ formatDate(order.created_at) }}</p>
              </div>
              <div class="text-right">
                <span :class="getStatusColor(order.status)" 
                  class="inline-flex px-3 py-1 text-sm font-semibold rounded-full">
                  {{ formatStatus(order.status) }}
                </span>
                <div class="text-sm text-gray-500 mt-1">
                  Payment: {{ formatPaymentStatus(order.payment_status) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Order Items -->
          <div class="px-6 py-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Items Ordered</h3>
            
            <div v-if="order.order_items && order.order_items.length > 0" class="space-y-4">
              <div v-for="item in order.order_items" :key="item.id" 
                class="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                
                <!-- Card Image -->
                <div class="flex-shrink-0">
                  <img 
                    v-if="item.listings?.cards?.image_url"
                    :src="item.listings.cards.image_url" 
                    :alt="item.listings.cards.name"
                    class="h-20 w-16 object-cover rounded-md shadow-sm"
                  />
                  <div v-else class="h-20 w-16 bg-gray-200 rounded-md flex items-center justify-center">
                    <svg class="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>

                <!-- Card Details -->
                <div class="flex-1 min-w-0">
                  <h4 class="text-lg font-medium text-gray-900">
                    {{ item.listings?.cards?.name || 'Card Name' }}
                  </h4>
                  <div class="flex items-center space-x-4 mt-1">
                    <p class="text-sm text-gray-600">
                      Set: {{ item.listings?.cards?.set_name || 'Unknown Set' }}
                    </p>
                    <span :class="getConditionColor(item.listings?.condition)" 
                      class="inline-flex px-2 py-1 text-xs font-semibold rounded-full">
                      {{ formatCondition(item.listings?.condition) }}
                    </span>
                  </div>
                  <p class="text-sm text-gray-500 mt-1">
                    Sold by: {{ item.listings?.profiles?.display_name || 'Unknown Seller' }}
                  </p>
                </div>

                <!-- Quantity and Price -->
                <div class="text-right flex-shrink-0">
                  <div class="text-sm text-gray-600">Qty: {{ item.quantity }}</div>
                  <div class="text-sm text-gray-600">Price: ${{ item.price_at_time?.toFixed(2) || '0.00' }}</div>
                  <div class="text-lg font-semibold text-gray-900 mt-1">
                    ${{ ((item.price_at_time || 0) * item.quantity).toFixed(2) }} CAD
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="text-center py-8 text-gray-500">
              No items found for this order
            </div>
          </div>

          <!-- Order Summary -->
          <div class="px-6 py-6 border-t border-gray-200 bg-gray-50">
            <div class="max-w-md ml-auto">
              <div class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600">Subtotal:</span>
                  <span class="text-gray-900">${{ order.subtotal?.toFixed(2) || '0.00' }} CAD</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600">Shipping:</span>
                  <span class="text-gray-900">${{ order.shipping_cost?.toFixed(2) || '0.00' }} CAD</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600">Tax (HST):</span>
                  <span class="text-gray-900">${{ order.tax_amount?.toFixed(2) || '0.00' }} CAD</span>
                </div>
                <div class="border-t border-gray-200 pt-2">
                  <div class="flex justify-between text-lg font-semibold">
                    <span class="text-gray-900">Total:</span>
                    <span class="text-gray-900">${{ order.total_amount?.toFixed(2) || '0.00' }} CAD</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Shipping & Billing Information -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <!-- Shipping Address -->
          <div class="bg-white shadow rounded-lg p-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Shipping Address</h3>
            <div v-if="order.shipping_address" class="text-sm text-gray-600 space-y-1">
              <div class="font-medium text-gray-900">{{ order.shipping_address.name }}</div>
              <div>{{ order.shipping_address.street1 }}</div>
              <div v-if="order.shipping_address.street2">{{ order.shipping_address.street2 }}</div>
              <div>
                {{ order.shipping_address.city }}, {{ order.shipping_address.province }} 
                {{ order.shipping_address.postalCode }}
              </div>
              <div>{{ order.shipping_address.country }}</div>
              <div v-if="order.shipping_address.phone" class="pt-2">
                Phone: {{ order.shipping_address.phone }}
              </div>
            </div>
            <div v-else class="text-gray-500">No shipping address on file</div>
          </div>

          <!-- Payment Information -->
          <div class="bg-white shadow rounded-lg p-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Payment Information</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600">Payment Method:</span>
                <span class="text-gray-900">{{ order.payment_method || 'Credit Card' }}</span>
              </div>
              <div v-if="order.card_last_four" class="flex justify-between">
                <span class="text-gray-600">Card:</span>
                <span class="text-gray-900">****{{ order.card_last_four }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Transaction ID:</span>
                <span class="text-gray-900 font-mono text-xs">{{ order.helcim_transaction_id || 'N/A' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Payment Status:</span>
                <span :class="getPaymentStatusColor(order.payment_status)" 
                  class="inline-flex px-2 py-1 text-xs font-semibold rounded-full">
                  {{ formatPaymentStatus(order.payment_status) }}
                </span>
              </div>
              <div v-if="order.paid_at" class="flex justify-between">
                <span class="text-gray-600">Paid At:</span>
                <span class="text-gray-900">{{ formatDate(order.paid_at) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tracking Information -->
        <div v-if="order.tracking_number || showTrackingSection" class="bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Tracking Information</h3>
          
          <div v-if="order.tracking_number" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2M4 13h2m-2 0v5a2 2 0 002 2h2M4 13v-5a2 2 0 012-2h2" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm font-medium text-blue-800">Your order has shipped!</p>
                <p class="text-sm text-blue-700 mt-1">
                  Tracking Number: <span class="font-mono">{{ order.tracking_number }}</span>
                </p>
                <p class="text-sm text-blue-600 mt-1">
                  Estimated delivery: 3-7 business days
                </p>
              </div>
            </div>
          </div>
          
          <div v-else class="text-gray-500 text-sm">
            <p>Tracking information will be provided once your order ships.</p>
            <p class="mt-1">We'll send you an email notification with tracking details.</p>
          </div>
        </div>

        <!-- Next Steps -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 class="text-lg font-medium text-blue-900 mb-3">What Happens Next?</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="text-center">
              <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span class="text-blue-600 font-semibold">1</span>
              </div>
              <h4 class="font-medium text-blue-900">Processing</h4>
              <p class="text-sm text-blue-700 mt-1">We're preparing your cards for shipment</p>
            </div>
            <div class="text-center">
              <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span class="text-blue-600 font-semibold">2</span>
              </div>
              <h4 class="font-medium text-blue-900">Shipping</h4>
              <p class="text-sm text-blue-700 mt-1">Your order will ship with tracking</p>
            </div>
            <div class="text-center">
              <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span class="text-blue-600 font-semibold">3</span>
              </div>
              <h4 class="font-medium text-blue-900">Delivery</h4>
              <p class="text-sm text-blue-700 mt-1">Enjoy your new cards!</p>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-col sm:flex-row justify-center items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <router-link to="/orders" 
            class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">
            View All Orders
          </router-link>
          <router-link to="/cards" 
            class="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium">
            Continue Shopping
          </router-link>
          <button @click="contactSupport"
            class="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium">
            Contact Support
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'vue-toastification'
import api from '@/lib/api'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

// State
const order = ref(null)
const loading = ref(true)
const error = ref('')
const showTrackingSection = ref(true)

// Fetch order details
const fetchOrder = async () => {
  try {
    loading.value = true
    error.value = ''
    
    const orderId = route.params.id
    if (!orderId) {
      throw new Error('Order ID is required')
    }

    const response = await api.get(`/orders/${orderId}`, {
    })

    if (response.status != 200) {
      if (response.status === 404) {
        throw new Error('Order not found. Please check your order ID.')
      } else if (response.status === 403) {
        throw new Error('You do not have permission to view this order.')
      }
      throw new Error('Failed to load order details.')
    }

    const data = await response.data
    order.value = data.order || data

  } catch (err) {
    console.error('Error fetching order:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

// Helper functions
const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatStatus = (status) => {
  const statusMap = {
    pending: 'Pending',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    refunded: 'Refunded'
  }
  return statusMap[status] || status?.charAt(0).toUpperCase() + status?.slice(1) || 'Unknown'
}

const formatPaymentStatus = (status) => {
  const statusMap = {
    pending: 'Pending',
    completed: 'Completed',
    failed: 'Failed',
    refunded: 'Refunded'
  }
  return statusMap[status] || status?.charAt(0).toUpperCase() + status?.slice(1) || 'Unknown'
}

const formatCondition = (condition) => {
  const conditionMap = {
    nm: 'Near Mint',
    near_mint: 'Near Mint',
    lp: 'Lightly Played',
    lightly_played: 'Lightly Played',
    mp: 'Moderately Played',
    moderately_played: 'Moderately Played',
    hp: 'Heavily Played',
    heavily_played: 'Heavily Played',
    dmg: 'Damaged',
    damaged: 'Damaged'
  }
  return conditionMap[condition] || condition?.charAt(0).toUpperCase() + condition?.slice(1) || 'Unknown'
}

const getStatusColor = (status) => {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    refunded: 'bg-gray-100 text-gray-800'
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}

const getPaymentStatusColor = (status) => {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    refunded: 'bg-gray-100 text-gray-800'
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}

const getConditionColor = (condition) => {
  const colors = {
    nm: 'bg-green-100 text-green-800',
    near_mint: 'bg-green-100 text-green-800',
    lp: 'bg-blue-100 text-blue-800',
    lightly_played: 'bg-blue-100 text-blue-800',
    mp: 'bg-yellow-100 text-yellow-800',
    moderately_played: 'bg-yellow-100 text-yellow-800',
    hp: 'bg-orange-100 text-orange-800',
    heavily_played: 'bg-orange-100 text-orange-800',
    dmg: 'bg-red-100 text-red-800',
    damaged: 'bg-red-100 text-red-800'
  }
  return colors[condition] || 'bg-gray-100 text-gray-800'
}

const contactSupport = () => {
  const subject = `Support Request - Order #${order.value?.id?.slice(0, 8) || 'Unknown'}`
  const body = `Hello,\n\nI need help with my order:\nOrder ID: ${order.value?.id || 'Unknown'}\nOrder Date: ${order.value?.created_at ? formatDate(order.value.created_at) : 'Unknown'}\n\nPlease describe your issue:\n\n`
  
  window.location.href = `mailto:support@mtgmarketplace.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

// Initialize component
onMounted(async () => {
  // Check if user is authenticated
  if (!authStore.isAuthenticated) {
    toast.error('Please sign in to view your order')
    router.push('/auth/signin')
    return
  }
  
  await fetchOrder()
})
</script>

<style scoped>
/* Custom styles for better presentation */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>