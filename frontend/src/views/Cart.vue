<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold">Shopping Cart</h1>
      <button v-if="cartStore.items.length > 0" @click="clearCart" 
        class="text-red-600 hover:text-red-800 text-sm">
        Clear Cart
      </button>
    </div>

    <div v-if="cartStore.loading" class="text-center py-8">
      <div class="text-gray-500">Loading cart...</div>
    </div>

    <div v-else-if="cartStore.items.length === 0" class="text-center py-12">
      <ShoppingCartIcon class="h-24 w-24 mx-auto text-gray-300 mb-4" />
      <h2 class="text-xl font-semibold text-gray-500 mb-2">Your cart is empty</h2>
      <p class="text-gray-400 mb-6">Add some cards to get started!</p>
      <router-link to="/cards" class="btn-primary">
        Browse Cards
      </router-link>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Cart Items -->
      <div class="lg:col-span-2 space-y-4">
        <div v-for="item in cartStore.items" :key="item.id" 
          class="bg-white rounded-lg shadow p-6">
          <div class="flex items-start space-x-4">
            <router-link :to="`/card/${item.listings.cards.id}`">
              <img :src="item.listings.cards.image_url" :alt="item.listings.cards.name" 
                class="w-16 h-22 object-cover rounded hover:opacity-75 transition-opacity cursor-pointer" />
            </router-link>
            
            <div class="flex-1">
              <router-link :to="`/card/${item.listings.cards.id}`" 
                class="hover:text-blue-600 transition-colors">
                <h3 class="font-semibold text-lg">{{ item.listings.cards.name }}</h3>
              </router-link>
              <p class="text-gray-600 text-sm">{{ item.listings.cards.set_number }}</p>
              
              <!-- Enhanced listing details -->
              <div class="flex items-center gap-2 mt-1">
                <span class="px-2 py-1 rounded text-xs font-medium"
                  :class="getConditionColor(item.listings.condition)">
                  {{ getConditionLabel(item.listings.condition) }}
                </span>
                <span v-if="item.listings.foil" 
                  class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                  FOIL
                </span>
                <span v-if="item.listings.signed" 
                  class="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                  SIGNED
                </span>
              </div>

              <!-- Seller and shipping information -->
              <div class="mt-2 space-y-1">
                <div class="flex items-center text-sm text-gray-600">
                  <span class="font-medium">Sold by:</span>
                  <router-link 
                    :to="`/seller/${item.listings.seller_id}`"
                    class="ml-1 text-blue-600 hover:text-blue-800 font-medium">
                    {{ item.listings.profiles.display_name }}
                  </router-link>
                  <span class="text-yellow-500 ml-1">
                    ★ {{ item.listings.profiles.rating || 'New' }}
                  </span>
                </div>
                
                <div class="flex items-center text-sm text-gray-600">
                  <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Ships from {{ getShippingLocation(item.listings.profiles) }}</span>
                </div>

                <!-- Estimated shipping time -->
                <div v-if="getEstimatedShipping(item.listings.profiles)" 
                  class="flex items-center text-sm text-gray-500">
                  <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{{ getEstimatedShipping(item.listings.profiles) }}</span>
                </div>
              </div>
              
              <div class="flex items-center justify-between mt-4">
                <div class="flex items-center space-x-2">
                  <button @click="updateQuantity(item.id, item.quantity - 1)"
                    class="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100">
                    <MinusIcon class="h-4 w-4" />
                  </button>
                  <span class="px-3 py-1 bg-gray-100 rounded">{{ item.quantity }}</span>
                  <button @click="updateQuantity(item.id, item.quantity + 1)"
                    :disabled="item.quantity >= item.listings.quantity"
                    :class="[
                      'w-8 h-8 rounded-full border flex items-center justify-center',
                      item.quantity >= item.listings.quantity
                        ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'border-gray-300 hover:bg-gray-100'
                    ]">
                    <PlusIcon class="h-4 w-4" />
                  </button>
                  <span v-if="item.quantity >= item.listings.quantity" 
                    class="text-xs text-gray-500 ml-2">
                    (Max available)
                  </span>
                </div>
                <button @click="removeItem(item.id)" 
                  class="text-red-600 hover:text-red-800">
                  <TrashIcon class="h-5 w-5" />
                </button>
              </div>
            </div>

            <div class="text-right">
              <div class="text-lg font-semibold">
                ${{ (parseFloat(item.listings.price) * item.quantity).toFixed(2) }} CAD
              </div>
              <div class="text-sm text-gray-600">
                ${{ item.listings.price }} each
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Order Summary -->
      <div class="lg:col-span-1">
        <div class="bg-white rounded-lg shadow p-6 sticky top-6">
          <h2 class="text-xl font-bold mb-4">Order Summary</h2>
          
          <div class="space-y-3 text-sm">
            <div class="flex justify-between">
              <span>Items ({{ cartStore.summary.itemCount }}):</span>
              <span>${{ cartStore.summary.subtotal }} CAD</span>
            </div>
            
            <div class="flex justify-between">
              <span>Shipping:</span>
              <span>
                {{ cartStore.summary.estimatedShipping === '0.00' ? 'TBD' : `$${cartStore.summary.estimatedShipping} CAD` }}
              </span>
            </div>
            
            <div class="flex justify-between">
              <span>Tax (HST):</span>
              <span>${{ cartStore.summary.tax }} CAD</span>
            </div>
            
            <div class="border-t pt-3 flex justify-between font-bold text-lg">
              <span>Total:</span>
              <span>${{ cartStore.summary.total }} CAD</span>
            </div>

            <!-- Seller breakdown -->
            <div v-if="cartStore.summary.uniqueSellers > 1" class="mt-4 pt-3 border-t">
              <div class="text-xs text-gray-600 mb-2">
                <svg class="inline h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Items from {{ cartStore.summary.uniqueSellers }} different sellers
              </div>
              <div class="text-xs text-gray-500">
                Shipping costs calculated at checkout
              </div>
            </div>
          </div>
          
          <button @click="proceedToCheckout" 
            :disabled="cartStore.items.length === 0"
            class="w-full mt-6 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            Proceed to Checkout
          </button>

          <button @click="continueShopping" 
            class="w-full mt-3 border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors">
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '@/stores/cart'
import { useToast } from 'vue-toastification'
import { 
  ShoppingCartIcon, 
  MinusIcon, 
  PlusIcon, 
  TrashIcon 
} from '@heroicons/vue/24/outline'

const router = useRouter()
const cartStore = useCartStore()
const toast = useToast()

// Helper functions
const getConditionLabel = (condition) => {
  const labels = {
    near_mint: 'Near Mint',
    nm: 'Near Mint',
    lightly_played: 'Lightly Played',
    moderately_played: 'Moderately Played',
    heavily_played: 'Heavily Played',
    damaged: 'Damaged'
  }
  return labels[condition] || condition.replace('_', ' ').toUpperCase()
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

const getShippingLocation = (profile) => {
  if (profile?.shipping_address?.country) {
    if (profile.shipping_address.country === 'CA') return 'Canada'
    if (profile.shipping_address.country === 'US') return 'United States'
    return profile.shipping_address.country
  }
  return 'Canada' // Default
}

const getEstimatedShipping = (profile) => {
  const location = getShippingLocation(profile)
  if (location === 'Canada') return 'Estimated 2-5 business days'
  if (location === 'United States') return 'Estimated 5-10 business days'
  return 'Estimated 7-14 business days'
}

// Actions
const updateQuantity = async (itemId, newQuantity) => {
  try {
    await cartStore.updateQuantity(itemId, newQuantity)
    if (newQuantity === 0) {
      toast.success('Item removed from cart')
    }
  } catch (error) {
    toast.error('Error updating quantity')
  }
}

const removeItem = async (itemId) => {
  try {
    await cartStore.removeItem(itemId)
    toast.success('Item removed from cart')
  } catch (error) {
    toast.error('Error removing item')
  }
}

const clearCart = async () => {
  if (confirm('Are you sure you want to clear your cart?')) {
    try {
      await cartStore.clearCart()
      toast.success('Cart cleared')
    } catch (error) {
      toast.error('Error clearing cart')
    }
  }
}

const proceedToCheckout = () => {
  router.push('/checkout')
}

const continueShopping = () => {
  router.push('/cards')
}

onMounted(() => {
  cartStore.fetchCart()
})
</script>