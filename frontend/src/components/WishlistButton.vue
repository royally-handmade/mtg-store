<template>
  <div class="wishlist-button-container">
    <!-- Main Wishlist Toggle Button -->
    <button 
      @click="toggleWishlist" 
      :class="[
        'wishlist-button flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200',
        isInWishlist 
          ? 'bg-red-100 text-red-600 border-red-300 hover:bg-red-200' 
          : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200',
        'border'
      ]"
      :disabled="loading"
    >
      <HeartIcon 
        :class="[
          'h-5 w-5 transition-all duration-200',
          isInWishlist ? 'fill-current text-red-500' : 'text-gray-500'
        ]" 
      />
      <span v-if="showText">
        {{ isInWishlist ? 'Remove from Wishlist' : 'Add to Wishlist' }}
      </span>
      <div v-if="loading" class="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
    </button>

    <!-- Price Alert Section (shown when in wishlist) -->
    <div v-if="isInWishlist && showPriceAlert" 
      class="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        💰 Price Alert (Optional)
      </label>
      <div class="flex space-x-2">
        <div class="flex-1">
          <input 
            v-model.number="maxPrice" 
            type="number" 
            step="0.01" 
            min="0" 
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
            placeholder="Max price (CAD)"
          />
        </div>
        <button 
          @click="savePriceAlert" 
          :disabled="alertLoading"
          class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {{ alertLoading ? 'Saving...' : 'Set Alert' }}
        </button>
      </div>
      <p class="text-xs text-gray-500 mt-1">
        Get notified when this card drops below your price
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { HeartIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth'
import { useWishlistStore } from '@/stores/wishlist'
import { useWishlistInit } from '@/composables/useWishlistInit'
import { useToast } from 'vue-toastification'

const props = defineProps({
  cardId: {
    type: String,
    required: true
  },
  showText: {
    type: Boolean,
    default: true
  },
  showPriceAlert: {
    type: Boolean,
    default: true
  }
})

const authStore = useAuthStore()
const toast = useToast()

// Use the initialization composable instead of manual fetching
const { wishlistStore } = useWishlistInit()

const loading = ref(false)
const alertLoading = ref(false)
const maxPrice = ref('')

const isInWishlist = computed(() => {
  return wishlistStore.isInWishlist(props.cardId)
})

const currentWishlistItem = computed(() => {
  return wishlistStore.items.find(item => item.card_id === props.cardId)
})

const toggleWishlist = async () => {
  if (!authStore.isAuthenticated) {
    toast.error('Please sign in to use the wishlist')
    return
  }

  loading.value = true
  try {
    if (isInWishlist.value) {
      await wishlistStore.removeFromWishlist(props.cardId)
      toast.success('Removed from wishlist')
      maxPrice.value = ''
    } else {
      await wishlistStore.addToWishlist(props.cardId)
      toast.success('Added to wishlist')
    }
  } catch (error) {
    toast.error(error.message || 'Error updating wishlist')
  } finally {
    loading.value = false
  }
}

const savePriceAlert = async () => {
  if (!maxPrice.value || maxPrice.value <= 0) {
    toast.error('Please enter a valid price')
    return
  }

  alertLoading.value = true
  try {
    await wishlistStore.updateWishlistItem(props.cardId, {
      max_price: maxPrice.value
    })
    toast.success('Price alert set!')
  } catch (error) {
    toast.error('Error setting price alert')
  } finally {
    alertLoading.value = false
  }
}

// Load existing price alert when component mounts
watch(() => currentWishlistItem.value, (item) => {
  if (item && item.max_price) {
    maxPrice.value = item.max_price
  }
}, { immediate: true })
</script>