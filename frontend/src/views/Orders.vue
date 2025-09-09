<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold">My Orders</h1>
      <div class="flex space-x-4">
        <select v-model="statusFilter" @change="filterOrders"
          class="rounded border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Orders</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredOrders.length === 0" class="text-center py-12">
      <div class="text-gray-500 text-lg mb-4">
        {{ statusFilter ? `No ${statusFilter} orders found` : 'No orders found' }}
      </div>
      <router-link to="/cards" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
        Start Shopping
      </router-link>
    </div>

    <!-- Orders List -->
    <div v-else class="space-y-6">
      <div v-for="order in filteredOrders.orders" :key="order.id"
        class="bg-white rounded-lg shadow border hover:shadow-md transition-shadow">

        <!-- Order Header -->
        <div class="p-6 border-b border-gray-200">
          <div class="flex justify-between items-start">
            <div>
              <h3 class="text-lg font-semibold text-gray-900">
                Order #{{ order.id.slice(0, 8) }}
              </h3>
              <p class="text-sm text-gray-500 mt-1">
                Placed on {{ formatDate(order.created_at) }}
              </p>
            </div>
            <div class="text-right">
              <div class="text-lg font-bold text-gray-900">
                ${{ order.total_amount }} CAD
              </div>
              <span :class="getStatusColor(order.status)"
                class="inline-flex px-3 py-1 text-xs font-semibold rounded-full mt-2">
                {{ formatStatus(order.status) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Order Items -->
        <div class="p-6">
          <h4 class="font-medium text-gray-900 mb-4">Order Items</h4>
          <div class="space-y-4">
            <div v-for="item in order.order_items" :key="item.id"
              class="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
              <div class="flex flex-col gap-2 p-1">

                <img :src="item.listings?.cards?.image_url" :alt="item.listings?.cards?.name"
                  class="w-16 h-22 object-cover shadow-sm" />
              </div>


              <div class="flex-1">
                <div class="flex gap-3 p-1">
                  <h5 class="font-medium text-gray-900">
                    {{ item.listings?.cards?.name || 'Unknown Card' }}
                  </h5>
                  <span class="px-2 py-1 rounded text-xs font-medium"
                    :class="getConditionColor(item.listings?.condition)">{{ formatCondition(item.listings?.condition)
                    }}</span>
                </div>
                <div class="flex gap-3 p-1">
                  <TreatmentBadge v-if="item.listings?.cards?.treatment" :treatment="item.listings?.cards?.treatment" />
                </div>
                <div class="flex gap-3">
                  <p class="text-sm text-gray-600">
                    Set: {{ item.listings?.cards?.set_number || 'Unknown' }}
                  </p>
                  <p class="text-sm text-gray-600">
                    Card No: {{ item.listings?.cards?.card_number }}
                  </p>
                </div>
                <p class="text-sm text-gray-600 mt-1">
                  Seller: <router-link :to="'/seller/' + item.listings?.seller.id"
                    class="text-blue-600 hover:text-blue-800"> {{ item.listings?.seller.display_name || 'Unknown Seller'
                    }} </router-link>
                </p>
                <div class="flex items-center space-x-4 mt-2">
                  <span class="text-sm text-gray-600">
                    Quantity: {{ item.quantity }}
                  </span>
                  <span class="text-sm font-medium text-gray-900">
                    ${{ item.price }} CAD each
                  </span>
                </div>
              </div>

              <div class="text-right">
                <div class="text-lg font-semibold text-gray-900">
                  ${{ (item.price * item.quantity).toFixed(2) }} CAD
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Order Summary -->
        <div class="px-6 pb-6">
          <div class="bg-gray-50 rounded-lg p-4">
            <div class="flex justify-between text-sm text-gray-600 mb-2">
              <span>Subtotal:</span>
              <span>${{ order.subtotal || calculateSubtotal(order.order_items) }} CAD</span>
            </div>
            <div class="flex justify-between text-sm text-gray-600 mb-2">
              <span>Shipping:</span>
              <span>${{ order.shipping_cost || '5.00' }} CAD</span>
            </div>
            <div class="flex justify-between text-sm text-gray-600 mb-2">
              <span>Tax:</span>
              <span>${{ order.tax_amount || calculateTax(order.subtotal || calculateSubtotal(order.order_items)) }}
                CAD</span>
            </div>
            <div class="border-t border-gray-200 pt-2 mt-2">
              <div class="flex justify-between text-lg font-semibold text-gray-900">
                <span>Total:</span>
                <span>${{ order.total_amount }} CAD</span>
              </div>
            </div>
          </div>
        </div>


        <div class="flex">
          <!-- Shipping Information -->
          <div v-if="order.shipping_address" class="px-6 pb-6 grow">
            <h4 class="font-medium text-gray-900 mb-2">Shipping Address</h4>
            <div class="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
              <div>{{ order.shipping_address.name }}</div>
              <div>{{ order.shipping_address.street1 }}</div>
              <div v-if="order.shipping_address.street2">
                {{ order.shipping_address.street2 }}
              </div>
              <div>
                {{ order.shipping_address.city }},
                {{ order.shipping_address.province }}
                {{ order.shipping_address.postalCode }}
              </div>
              <div>{{ order.shipping_address.country }}</div>
            </div>
          </div>

          <!-- Billing Information -->
          <div v-if="order.billing_address" class="px-6 pb-6 grow">
            <h4 class="font-medium text-gray-900 mb-2">Billing Address</h4>
            <div class="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
              <div>{{ order.billing_address.name }}</div>
              <div>{{ order.billing_address.street1 }}</div>
              <div v-if="order.billing_address.street2">
                {{ order.billing_address.street2 }}
              </div>
              <div>
                {{ order.billing_address.city }},
                {{ order.billing_address.province }}
                {{ order.billing_address.postalCode }}
              </div>
              <div>{{ order.billing_address.country }}</div>
            </div>
          </div>
        </div>
        <!-- Tracking Information -->
        <div v-if="order.tracking_number" class="px-6 pb-6">
          <h4 class="font-medium text-gray-900 mb-2">Tracking Information</h4>
          <div class="text-sm bg-blue-50 p-4 rounded-lg">
            <div class="text-blue-900">
              Tracking Number: <span class="font-mono">{{ order.tracking_number }}</span>
            </div>
          </div>
        </div>

        <!-- Order Actions -->
        <div class="px-6 pb-6 flex justify-between items-center">
          <div class="text-sm text-gray-500">
            Last updated: {{ formatDate(order.updated_at) }}
          </div>
          <div class="flex space-x-3">
            <button v-if="order.status === 'pending'" @click="cancelOrder(order.id)" :disabled="cancelling === order.id"
              class="px-4 py-2 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50">
              {{ cancelling === order.id ? 'Cancelling...' : 'Cancel Order' }}
            </button>

            <button @click="reorderItems(order)"
              class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Reorder Items
            </button>

            <button @click="contactSeller(order.seller)"
              class="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              Contact Seller
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
  import { ref, onMounted, computed } from 'vue'
  import { useRouter } from 'vue-router'
  import api from '@/lib/api'
  import { useCartStore } from '@/stores/cart'
  import { useToast } from 'vue-toastification'
  import TreatmentBadge from '../components/TreatmentBadge.vue'

  const router = useRouter()
  const cartStore = useCartStore()
  const toast = useToast()

  const orders = ref([])
  const loading = ref(true)
  const statusFilter = ref('')
  const cancelling = ref(null)

  const filteredOrders = computed(() => {
    if (!statusFilter.value) return orders.value
    return orders.value.filter(order => order.status === statusFilter.value)
  })

  const fetchOrders = async () => {
    try {
      loading.value = true
      const response = await api.get('/orders')
      orders.value = response.data
    } catch (error) {
      console.error('Error fetching orders:', error)
      toast.error('Failed to load orders')
    } finally {
      loading.value = false
    }
  }

  const filterOrders = () => {
    // Filtering is handled by computed property
  }

  const formatDate = (dateString) => {
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
      cancelled: 'Cancelled'
    }
    return statusMap[status] || status
  }

  const formatCondition = (condition) => {
    if (!condition) return 'Unknown'
    condition = condition.replace('_', ' ')
    return condition.replace(/(^|\s)[a-z]/gi, l => l.toUpperCase())
  }

  const getConditionColor = (condition) => {
    const colors = {
      near_mint: 'bg-green-100 text-green-800',
      nm: 'bg-green-100 text-green-800',
      lightly_played: 'bg-blue-100 text-blue-800',
      moderately_played: 'bg-yellow-100 text-yellow-800',
      heavily_played: 'bg-orange-100 text-orange-800',
      damaged: 'bg-red-100 text-red-800'
    }
    return colors[condition] || 'bg-gray-100 text-gray-800'
  }

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      shipped: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const calculateSubtotal = (orderItems) => {
    if (!orderItems || !Array.isArray(orderItems)) return '0.00'
    return orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)
  }

  const calculateTax = (subtotal) => {
    const subtotalNum = typeof subtotal === 'string' ? parseFloat(subtotal) : subtotal
    return (subtotalNum * 0.13).toFixed(2) // 13% HST
  }

  const cancelOrder = async (orderId) => {
    try {
      cancelling.value = orderId
      await api.post(`/orders/${orderId}/cancel`)
      toast.success('Order cancelled successfully')
      await fetchOrders()
    } catch (error) {
      console.error('Error cancelling order:', error)
      toast.error('Failed to cancel order')
    } finally {
      cancelling.value = null
    }
  }

  const reorderItems = async (order) => {
    try {
      // Add items to cart
      for (const item of order.order_items) {
        if (item.listings && item.listings.status === 'active') {
          await cartStore.addToCart(item.listings.id, item.quantity)
        }
      }
      toast.success('Items added to cart')
      router.push('/cart')
    } catch (error) {
      console.error('Error reordering items:', error)
      toast.error('Some items may no longer be available')
    }
  }

  const contactSeller = (seller) => {
    if (seller && seller.email) {
      window.location.href = `mailto:${seller.email}?subject=Question about my order`
    } else {
      toast.error('Seller contact information not available')
    }
  }

  onMounted(fetchOrders)
</script>