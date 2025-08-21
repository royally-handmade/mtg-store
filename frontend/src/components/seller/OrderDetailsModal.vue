<!-- frontend/src/components/seller/OrderDetailsModal.vue -->
<template>
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" @click="closeModal">
    <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white" @click.stop>
      <div class="flex justify-between items-center mb-6">
        <h3 class="text-lg font-medium text-gray-900">
          Order Details #{{ order.id.substring(0, 8) }}
        </h3>
        <button @click="closeModal" class="text-gray-400 hover:text-gray-600">
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>

      <div class="space-y-6">
        <!-- Order Status and Actions -->
        <div class="flex justify-between items-start">
          <div>
            <span :class="getStatusBadgeClass(order.status)" 
              class="inline-flex px-3 py-1 text-sm font-semibold rounded-full">
              {{ formatStatus(order.status) }}
            </span>
            <p class="text-sm text-gray-500 mt-1">
              Ordered on {{ formatDate(order.created_at) }}
            </p>
          </div>
          
          <div class="flex space-x-2">
            <button
              v-if="canUpdateStatus"
              @click="showStatusUpdate = !showStatusUpdate"
              class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
            >
              Update Status
            </button>
            <button
              @click="printShippingLabel"
              class="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
            >
              Print Label
            </button>
          </div>
        </div>

        <!-- Status Update Form -->
        <div v-if="showStatusUpdate" class="bg-gray-50 rounded-lg p-4">
          <h4 class="font-medium text-gray-900 mb-3">Update Order Status</h4>
          <form @submit.prevent="updateOrderStatus" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                New Status
              </label>
              <select v-model="statusUpdate.status" required 
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            
            <div v-if="statusUpdate.status === 'shipped'">
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Tracking Number
              </label>
              <input
                type="text"
                v-model="statusUpdate.tracking_number"
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Enter tracking number"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                v-model="statusUpdate.notes"
                rows="2"
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Add any notes about this status update"
              ></textarea>
            </div>
            
            <div class="flex justify-end space-x-2">
              <button
                type="button"
                @click="showStatusUpdate = false"
                class="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="updating"
                class="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {{ updating ? 'Updating...' : 'Update Status' }}
              </button>
            </div>
          </form>
        </div>

        <!-- Customer Information -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 class="font-medium text-gray-900 mb-3">Customer Information</h4>
            <div class="space-y-2 text-sm">
              <div>
                <span class="font-medium text-gray-700">Name:</span>
                <span class="ml-2 text-gray-600">{{ order.buyer?.display_name || 'N/A' }}</span>
              </div>
              <div>
                <span class="font-medium text-gray-700">Email:</span>
                <span class="ml-2 text-gray-600">{{ order.buyer?.email || 'N/A' }}</span>
              </div>
              <div v-if="order.shipping_address">
                <span class="font-medium text-gray-700">Shipping Address:</span>
                <div class="ml-2 text-gray-600">
                  <div>{{ order.shipping_address.street1 }}</div>
                  <div v-if="order.shipping_address.street2">{{ order.shipping_address.street2 }}</div>
                  <div>
                    {{ order.shipping_address.city }}, {{ order.shipping_address.province }} 
                    {{ order.shipping_address.postal_code }}
                  </div>
                  <div>{{ order.shipping_address.country }}</div>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h4 class="font-medium text-gray-900 mb-3">Order Information</h4>
            <div class="space-y-2 text-sm">
              <div>
                <span class="font-medium text-gray-700">Order Date:</span>
                <span class="ml-2 text-gray-600">{{ formatDate(order.created_at) }}</span>
              </div>
              <div v-if="order.shipped_at">
                <span class="font-medium text-gray-700">Shipped Date:</span>
                <span class="ml-2 text-gray-600">{{ formatDate(order.shipped_at) }}</span>
              </div>
              <div v-if="order.tracking_number">
                <span class="font-medium text-gray-700">Tracking:</span>
                <span class="ml-2 text-gray-600">{{ order.tracking_number }}</span>
              </div>
              <div>
                <span class="font-medium text-gray-700">Payment Status:</span>
                <span class="ml-2" :class="getPaymentStatusClass(order.payment_status)">
                  {{ formatPaymentStatus(order.payment_status) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Order Items -->
        <div>
          <h4 class="font-medium text-gray-900 mb-3">Items Ordered</h4>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Card
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Condition
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="item in order.order_items" :key="item.id">
                  <td class="px-4 py-4">
                    <div class="flex items-center">
                      <img 
                        v-if="item.listings?.cards?.image_url"
                        :src="item.listings.cards.image_url" 
                        :alt="item.listings.cards.name"
                        class="h-12 w-8 object-cover rounded mr-3"
                      />
                      <div>
                        <div class="text-sm font-medium text-gray-900">
                          {{ item.listings?.cards?.name || 'Unknown Card' }}
                        </div>
                        <div class="text-sm text-gray-500">
                          {{ item.listings?.cards?.set_name }}
                          <span v-if="item.listings?.foil" class="ml-1 text-yellow-600">(Foil)</span>
                          <span v-if="item.listings?.signed" class="ml-1 text-purple-600">(Signed)</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-4 text-sm text-gray-900">
                    {{ item.listings?.condition || 'N/A' }}
                  </td>
                  <td class="px-4 py-4 text-sm text-gray-900">
                    {{ item.quantity }}
                  </td>
                  <td class="px-4 py-4 text-sm text-gray-900">
                    ${{ item.price?.toFixed(2) }}
                  </td>
                  <td class="px-4 py-4 text-sm font-medium text-gray-900">
                    ${{ (item.price * item.quantity).toFixed(2) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Order Summary -->
        <div class="bg-gray-50 rounded-lg p-4">
          <h4 class="font-medium text-gray-900 mb-3">Order Summary</h4>
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">Subtotal:</span>
              <span class="text-gray-900">${{ order.subtotal?.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">Shipping:</span>
              <span class="text-gray-900">${{ order.shipping_cost?.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">Tax:</span>
              <span class="text-gray-900">${{ order.tax_amount?.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-sm pt-2 border-t border-gray-200">
              <span class="font-medium text-gray-900">Total:</span>
              <span class="font-medium text-gray-900">${{ order.total_amount?.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">Your Earnings (97.5%):</span>
              <span class="font-medium text-green-600">
                ${{ ((order.subtotal || 0) * 0.975).toFixed(2) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Timeline -->
        <div v-if="orderTimeline.length > 0">
          <h4 class="font-medium text-gray-900 mb-3">Order Timeline</h4>
          <div class="flow-root">
            <ul class="-mb-8">
              <li v-for="(event, eventIdx) in orderTimeline" :key="event.id" class="relative pb-8">
                <div v-if="eventIdx !== orderTimeline.length - 1" 
                  class="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"></div>
                <div class="relative flex space-x-3">
                  <div>
                    <span :class="getTimelineIconClass(event.type)"
                      class="h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white">
                      <component :is="getTimelineIcon(event.type)" class="h-5 w-5 text-white" />
                    </span>
                  </div>
                  <div class="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                    <div>
                      <p class="text-sm text-gray-500">
                        {{ event.description }}
                        <span v-if="event.details" class="font-medium text-gray-900">
                          {{ event.details }}
                        </span>
                      </p>
                    </div>
                    <div class="text-right text-sm whitespace-nowrap text-gray-500">
                      {{ formatDateTime(event.timestamp) }}
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <button
            @click="contactCustomer"
            class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Contact Customer
          </button>
          <button
            v-if="canRefund"
            @click="processRefund"
            class="px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
          >
            Process Refund
          </button>
          <button
            @click="closeModal"
            class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { 
  XMarkIcon, 
  ShoppingBagIcon, 
  TruckIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon
} from '@heroicons/vue/24/outline'
import api from '@/lib/api'

const props = defineProps({
  order: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'updated'])

// Reactive data
const showStatusUpdate = ref(false)
const updating = ref(false)
const statusUpdate = ref({
  status: '',
  tracking_number: '',
  notes: ''
})

const orderTimeline = ref([])

// Computed properties
const canUpdateStatus = computed(() => {
  return ['pending', 'processing', 'shipped'].includes(props.order.status)
})

const canRefund = computed(() => {
  return ['delivered'].includes(props.order.status) && props.order.payment_status === 'completed'
})

// Methods
const closeModal = () => {
  emit('close')
}

const updateOrderStatus = async () => {
  updating.value = true
  try {
    await api.patch(`/seller/orders/${props.order.id}/status`, statusUpdate.value)
    
    showStatusUpdate.value = false
    emit('updated')
    
    // Refresh timeline
    await loadOrderTimeline()
    
    alert('Order status updated successfully!')
  } catch (error) {
    console.error('Error updating order status:', error)
    alert('Error updating order status: ' + (error.response?.data?.error || error.message))
  } finally {
    updating.value = false
  }
}

const loadOrderTimeline = async () => {
  try {
    // Generate timeline from order data
    const timeline = []
    
    timeline.push({
      id: 1,
      type: 'created',
      description: 'Order placed',
      timestamp: props.order.created_at
    })
    
    if (props.order.paid_at) {
      timeline.push({
        id: 2,
        type: 'paid',
        description: 'Payment received',
        timestamp: props.order.paid_at
      })
    }
    
    if (props.order.shipped_at) {
      timeline.push({
        id: 3,
        type: 'shipped',
        description: 'Order shipped',
        details: props.order.tracking_number,
        timestamp: props.order.shipped_at
      })
    }
    
    if (props.order.delivered_at) {
      timeline.push({
        id: 4,
        type: 'delivered',
        description: 'Order delivered',
        timestamp: props.order.delivered_at
      })
    }
    
    orderTimeline.value = timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  } catch (error) {
    console.error('Error loading order timeline:', error)
  }
}

const printShippingLabel = () => {
  // This would integrate with shipping label generation
  alert('Shipping label functionality would be implemented here')
}

const contactCustomer = () => {
  // This would open email client or messaging system
  const email = props.order.buyer?.email
  if (email) {
    window.location.href = `mailto:${email}?subject=Regarding Order #${props.order.id.substring(0, 8)}`
  }
}

const processRefund = () => {
  // This would open refund processing modal
  if (confirm('Are you sure you want to process a refund for this order?')) {
    alert('Refund processing functionality would be implemented here')
  }
}

// Formatting methods
const formatDate = (date) => {
  return new Date(date).toLocaleDateString()
}

const formatDateTime = (date) => {
  return new Date(date).toLocaleString()
}

const formatStatus = (status) => {
  const statuses = {
    'pending': 'Pending',
    'processing': 'Processing',
    'shipped': 'Shipped',
    'delivered': 'Delivered',
    'cancelled': 'Cancelled'
  }
  return statuses[status] || status
}

const formatPaymentStatus = (status) => {
  const statuses = {
    'pending': 'Pending',
    'processing': 'Processing',
    'completed': 'Completed',
    'failed': 'Failed',
    'refunded': 'Refunded'
  }
  return statuses[status] || status
}

const getStatusBadgeClass = (status) => {
  const classes = {
    'pending': 'bg-yellow-100 text-yellow-800',
    'processing': 'bg-blue-100 text-blue-800',
    'shipped': 'bg-purple-100 text-purple-800',
    'delivered': 'bg-green-100 text-green-800',
    'cancelled': 'bg-red-100 text-red-800'
  }
  return classes[status] || 'bg-gray-100 text-gray-800'
}

const getPaymentStatusClass = (status) => {
  const classes = {
    'pending': 'text-yellow-600',
    'processing': 'text-blue-600',
    'completed': 'text-green-600',
    'failed': 'text-red-600',
    'refunded': 'text-gray-600'
  }
  return classes[status] || 'text-gray-600'
}

const getTimelineIconClass = (type) => {
  const classes = {
    'created': 'bg-blue-500',
    'paid': 'bg-green-500',
    'shipped': 'bg-purple-500',
    'delivered': 'bg-green-600',
    'cancelled': 'bg-red-500'
  }
  return classes[type] || 'bg-gray-500'
}

const getTimelineIcon = (type) => {
  const icons = {
    'created': ShoppingBagIcon,
    'paid': CheckCircleIcon,
    'shipped': TruckIcon,
    'delivered': CheckCircleIcon,
    'cancelled': XCircleIcon
  }
  return icons[type] || ClockIcon
}

// Initialize
onMounted(() => {
  loadOrderTimeline()
  statusUpdate.value.status = props.order.status
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