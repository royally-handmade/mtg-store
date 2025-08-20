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
            <img :src="item.listings.cards.image_url" :alt="item.listings.cards.name" 
              class="w-16 h-22 object-cover rounded" />
            
            <div class="flex-1">
              <h3 class="font-semibold text-lg">{{ item.listings.cards.name }}</h3>
              <p class="text-gray-600 text-sm">{{ item.listings.cards.set_number }}</p>
              <p class="text-gray-500 text-sm">Condition: {{ getConditionLabel(item.listings.condition) }}</p>
              <p class="text-gray-500 text-sm">
                Sold by {{ item.listings.profiles.display_name }} 
                <span class="text-yellow-500">★ {{ item.listings.profiles.rating }}</span>
              </p>
              
              <div class="flex items-center justify-between mt-4">
                <div class="flex items-center space-x-3">
                  <button @click="updateQuantity(item.id, item.quantity - 1)"
                    class="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100">
                    <MinusIcon class="h-4 w-4" />
                  </button>
                  <span class="font-medium">{{ item.quantity }}</span>
                  <button @click="updateQuantity(item.id, item.quantity + 1)"
                    class="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100">
                    <PlusIcon class="h-4 w-4" />
                  </button>
                </div>
                
                <div class="text-right">
                  <div class="font-semibold text-lg">${{ (item.listings.price * item.quantity).toFixed(2) }} CAD</div>
                  <button @click="removeItem(item.id)" 
                    class="text-red-600 hover:text-red-800 text-sm">
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Order Summary -->
      <div class="bg-white rounded-lg shadow p-6 h-fit">
        <h2 class="text-xl font-bold mb-4">Order Summary</h2>
        
        <div class="space-y-3 text-sm">
          <div class="flex justify-between">
            <span>Subtotal ({{ cartStore.summary.itemCount }} items):</span>
            <span>${{ cartStore.summary.subtotal }} CAD</span>
          </div>
          <div class="flex justify-between">
            <span>Estimated Shipping:</span>
            <span>${{ cartStore.summary.estimatedShipping }} CAD</span>
          </div>
          <div class="flex justify-between">
            <span>Tax (HST):</span>
            <span>${{ cartStore.summary.tax }} CAD</span>
          </div>
          <div class="border-t pt-3 flex justify-between font-bold text-lg">
            <span>Total:</span>
            <span>${{ cartStore.summary.total }} CAD</span>
          </div>
        </div>

        <div class="mt-6 space-y-3">
          <div class="text-sm text-gray-600">
            <div>{{ cartStore.summary.uniqueSellers }} seller(s)</div>
            <div>Ships to Canada</div>
          </div>
          
          <button v-if="authStore.isAuthenticated" @click="proceedToCheckout" 
            class="w-full btn-primary">
            Proceed to Checkout
          </button>
          <router-link v-else to="/auth" 
            class="w-full btn-primary block text-center">
            Sign In to Checkout
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ShoppingCartIcon, MinusIcon, PlusIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useToast } from 'vue-toastification'

const router = useRouter()
const authStore = useAuthStore()
const cartStore = useCartStore()
const toast = useToast()

const getConditionLabel = (condition) => {
  const labels = {
    nm: 'Near Mint',
    lp: 'Lightly Played', 
    mp: 'Moderately Played',
    hp: 'Heavily Played',
    dmg: 'Damaged'
  }
  return labels[condition] || condition
}

const updateQuantity = async (itemId, newQuantity) => {
  try {
    await cartStore.updateQuantity(itemId, newQuantity)
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

onMounted(() => {
  cartStore.fetchCart()
})
</script>