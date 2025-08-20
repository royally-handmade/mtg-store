<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-bold">My Wishlist</h1>
        <p class="text-gray-600 mt-1">
          {{ wishlistStore.itemCount }} items • Total value: ${{ wishlistStore.totalValue }} CAD
        </p>
      </div>
      <div class="flex space-x-3">
        <button 
          v-if="wishlistStore.itemCount > 0"
          @click="showShareModal = true"
          class="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ShareIcon class="h-5 w-5" />
          <span>Share</span>
        </button>
        <button 
          v-if="wishlistStore.itemCount > 0"
          @click="addAllToCart"
          :disabled="addingToCart"
          class="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <ShoppingCartIcon class="h-5 w-5" />
          <span>{{ addingToCart ? 'Adding...' : 'Add All to Cart' }}</span>
        </button>
        <button 
          v-if="wishlistStore.itemCount > 0"
          @click="showClearConfirm = true"
          class="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <TrashIcon class="h-5 w-5" />
          <span>Clear All</span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="wishlistStore.loading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="wishlistStore.itemCount === 0" class="text-center py-12">
      <HeartIcon class="h-16 w-16 text-gray-300 mx-auto mb-4" />
      <h2 class="text-xl font-semibold text-gray-900 mb-2">Your wishlist is empty</h2>
      <p class="text-gray-600 mb-6">Start adding cards you want to your wishlist!</p>
      <router-link 
        to="/cards" 
        class="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <MagnifyingGlassIcon class="h-5 w-5 mr-2" />
        Browse Cards
      </router-link>
    </div>

    <!-- Wishlist Items -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <div 
        v-for="item in wishlistStore.items" 
        :key="item.id"
        class="bg-white rounded-lg shadow border hover:shadow-lg transition-shadow"
      >
        <!-- Card Image -->
        <div class="overflow-hidden rounded-t-lg relative">
          <img 
            :src="item.cards.image_url" 
            :alt="item.cards.name"
            class="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
            @click="$router.push(`/card/${item.card_id}`)"
          />
          <!-- Wishlist Actions Overlay -->
          <div class="absolute top-2 right-2 flex space-x-1">
            <button
              @click="removeFromWishlist(item.card_id)"
              class="p-2 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-70 transition-all"
              title="Remove from wishlist"
            >
              <HeartIcon class="h-4 w-4 fill-current text-red-500" />
            </button>
          </div>
        </div>

        <!-- Card Info -->
        <div class="p-4">
          <h3 class="font-semibold text-lg mb-1 truncate cursor-pointer hover:text-blue-600"
            @click="$router.push(`/card/${item.card_id}`)">
            {{ item.cards.name }}
          </h3>
          <p class="text-sm text-gray-600 mb-2">
            {{ item.cards.set_number }} • {{ item.cards.rarity }}
          </p>
          
          <!-- Market Price -->
          <div class="flex justify-between items-center mb-3">
            <span class="text-lg font-bold text-green-600">
              ${{ item.cards.market_price || '0.00' }} CAD
            </span>
            <span v-if="item.max_price" class="text-sm text-blue-600">
              Alert: ${{ item.max_price }}
            </span>
          </div>

          <!-- Price Alert Status -->
          <div v-if="item.max_price" class="mb-3">
            <div v-if="isPriceAlertTriggered(item)" 
              class="flex items-center space-x-1 text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
              <CheckCircleIcon class="h-4 w-4" />
              <span>Price Alert!</span>
            </div>
            <div v-else class="flex items-center space-x-1 text-sm text-gray-500">
              <ClockIcon class="h-4 w-4" />
              <span>Watching price</span>
            </div>
          </div>

          <!-- Added Date -->
          <p class="text-xs text-gray-400 mb-3">
            Added {{ formatDate(item.created_at) }}
          </p>

          <!-- Actions -->
          <div class="space-y-2">
            <button
              @click="addToCart(item.card_id)"
              :disabled="addingItem === item.card_id"
              class="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <ShoppingCartIcon class="h-4 w-4" />
              <span>{{ addingItem === item.card_id ? 'Adding...' : 'Add to Cart' }}</span>
            </button>
            
            <button
              @click="editPriceAlert(item)"
              class="w-full flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <BellIcon class="h-4 w-4" />
              <span>{{ item.max_price ? 'Edit Alert' : 'Set Price Alert' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Share Modal -->
    <ShareWishlistModal 
      v-if="showShareModal"
      :wishlist-items="wishlistStore.items"
      @close="showShareModal = false"
    />

    <!-- Clear Confirmation Modal -->
    <ConfirmModal
      v-if="showClearConfirm"
      title="Clear Wishlist"
      message="Are you sure you want to remove all items from your wishlist? This action cannot be undone."
      confirm-text="Clear All"
      confirm-class="bg-red-600 hover:bg-red-700"
      @confirm="clearWishlist"
      @cancel="showClearConfirm = false"
    />

    <!-- Price Alert Modal -->
    <PriceAlertModal
      v-if="showPriceAlertModal"
      :card="selectedCard"
      :current-max-price="selectedCard?.max_price"
      @save="savePriceAlert"
      @close="showPriceAlertModal = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWishlistStore } from '@/stores/wishlist'
import { useCartStore } from '@/stores/cart'
import { useToast } from 'vue-toastification'
import { 
  HeartIcon, 
  ShareIcon, 
  ShoppingCartIcon, 
  TrashIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ClockIcon,
  BellIcon
} from '@heroicons/vue/24/outline'

import ShareWishlistModal from '@/components/ShareWishlistModal.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import PriceAlertModal from '@/components/PriceAlertModal.vue'

const router = useRouter()
const wishlistStore = useWishlistStore()
const cartStore = useCartStore()
const toast = useToast()

const showShareModal = ref(false)
const showClearConfirm = ref(false)
const showPriceAlertModal = ref(false)
const addingToCart = ref(false)
const addingItem = ref(null)
const selectedCard = ref(null)

const removeFromWishlist = async (cardId) => {
  try {
    await wishlistStore.removeFromWishlist(cardId)
    toast.success('Removed from wishlist')
  } catch (error) {
    toast.error('Error removing from wishlist')
  }
}

const addToCart = async (cardId) => {
  addingItem.value = cardId
  try {
    await wishlistStore.addItemToCart(cardId)
    toast.success('Added to cart')
  } catch (error) {
    toast.error(error.message || 'Error adding to cart')
  } finally {
    addingItem.value = null
  }
}

const addAllToCart = async () => {
  addingToCart.value = true
  try {
    const result = await wishlistStore.addAllToCart()
    
    if (result.successCount > 0) {
      toast.success(`Added ${result.successCount} items to cart`)
    }
    
    if (result.failCount > 0) {
      toast.warning(`${result.failCount} items could not be added (may be unavailable)`)
    }
    
    if (result.successCount > 0) {
      router.push('/cart')
    }
  } catch (error) {
    toast.error('Error adding items to cart')
  } finally {
    addingToCart.value = false
  }
}

const clearWishlist = async () => {
  try {
    await wishlistStore.clearWishlist()
    toast.success('Wishlist cleared')
    showClearConfirm.value = false
  } catch (error) {
    toast.error('Error clearing wishlist')
  }
}

const editPriceAlert = (item) => {
  selectedCard.value = item
  showPriceAlertModal.value = true
}

const savePriceAlert = async (maxPrice) => {
  try {
    await wishlistStore.updateWishlistItem(selectedCard.value.card_id, {
      max_price: maxPrice
    })
    toast.success('Price alert updated!')
    showPriceAlertModal.value = false
  } catch (error) {
    toast.error('Error updating price alert')
  }
}

const isPriceAlertTriggered = (item) => {
  if (!item.max_price || !item.cards.market_price) return false
  return parseFloat(item.cards.market_price) <= parseFloat(item.max_price)
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

onMounted(async () => {
  try {
    await wishlistStore.fetchWishlist()
  } catch (error) {
    toast.error('Error loading wishlist')
  }
})
</script>