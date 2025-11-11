<template>
  <div
    :class="[
      'bg-white rounded-lg border transition-colors',
      isCheapest ? 'shadow-md border-green-300 ring-2 ring-green-200' : 'border-gray-200 hover:bg-gray-50'
    ]"
  >
    <div class="p-3 md:p-4">
<div class="grid md:grid-cols-2 gap-2">
  <div class="md:col-span-3/4">
<!-- Header: Price and Condition -->
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="flex-1">
          <div v-if="isCheapest" class="text-xs font-medium text-green-700 mb-1">
            Best Price
          </div>
          <div class="flex items-baseline gap-2 flex-wrap">
            <div :class="[
              'font-bold',
              isCheapest ? 'text-2xl md:text-3xl text-green-600' : 'text-lg md:text-xl text-green-600'
            ]">
              ${{ listing.price.toFixed(2) }}
            </div>
            <div v-if="shippingCost > 0" class="text-xs text-gray-500">
              + ${{ shippingCost.toFixed(2) }} shipping
            </div>
          </div>
        </div>

        <!-- Condition Badge -->

      </div>

      <!-- Attributes Row -->
      <div class="flex items-center gap-1.5 mb-3 flex-wrap">
                <span
          class="px-2 py-0.5 rounded text-xs font-medium shrink-0"
          :class="getConditionColor(listing.condition)"
        >
          {{ formatCondition(listing.condition) }}
        </span>
        <span
          v-if="listing.language && listing.language !== 'en'"
          class="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium"
        >
          {{ listing.language.toUpperCase() }}
        </span>
      </div>

      <!-- Seller Info -->
      <div class="flex items-center gap-1 text-xs text-gray-600 mb-3 flex-wrap">
        <span>Sold by</span>
        <router-link
          :to="`/seller/${listing.seller_id}`"
          class="font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          {{ listing.profiles?.display_name || 'Unknown Seller' }}
        </router-link>
        <span class="text-yellow-500">
          ★ {{ listing.profiles?.rating || 'New' }}
        </span>
        <span class="text-gray-400">•</span>
        <span>{{ listing.quantity }} available</span>
        <span v-if="listing.profiles?.shipping_address?.country" class="text-gray-400 hidden sm:inline">•</span>
        <span v-if="listing.profiles?.shipping_address?.country" class="hidden sm:inline">
          Ships from {{ listing.profiles.shipping_address.country }}
        </span>
      </div>
  </div>
<div :class="['md:col-span-1 self-center', !isCheapest ? 'md:px-20' : 'px-2']">
<!-- Quantity Selector and Add to Cart -->
      <div class="flex items-stretch gap-2">
        <!-- Quantity Selector -->
        <div class="flex items-center border border-gray-300 rounded-lg overflow-hidden">
          <button
            @click="decrementQuantity"
            :disabled="quantity <= 1"
            class="px-2 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Decrease quantity"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
            </svg>
          </button>
          <input
            v-model.number="quantity"
            type="number"
            min="1"
            :max="listing.quantity"
            class="w-12 text-center text-sm font-medium border-0 focus:outline-none focus:ring-0"
            @blur="validateQuantity"
          />
          <button
            @click="incrementQuantity"
            :disabled="quantity >= listing.quantity"
            class="px-2 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Increase quantity"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <!-- Add to Cart Button -->
        <button
          @click="handleAddToCart"
          :disabled="disabled"
          :class="buttonClass"
          class="flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg v-if="addingToCart" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
            </path>
          </svg>
          <svg v-else-if="wasRecentlyAdded" class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd" />
          </svg>
          <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13h10m-10 0l-1.5 6m1.5-6h10m0 0l1.5 6" />
          </svg>
          {{ buttonText }}
        </button>
      </div>


      <!-- Sign in prompt -->
      <div v-if="!isAuthenticated" class="text-xs text-center text-gray-500 mt-2">
        <router-link to="/auth" class="text-blue-600 hover:text-blue-800 underline">
          Sign in to purchase
        </router-link>
      </div>
</div>

</div>

      

      

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  listing: {
    type: Object,
    required: true
  },
  isCheapest: {
    type: Boolean,
    default: false
  },
  addingToCart: {
    type: Boolean,
    default: false
  },
  wasRecentlyAdded: {
    type: Boolean,
    default: false
  },
  isInCart: {
    type: Boolean,
    default: false
  },
  isAuthenticated: {
    type: Boolean,
    default: false
  },
  isOwnListing: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  shippingCost: {
    type: Number,
    default: 5.00
  }
})

const emit = defineEmits(['add-to-cart'])

const quantity = ref(1)

const totalPrice = computed(() => {
  return (props.listing.price * quantity.value) + props.shippingCost
})

const buttonClass = computed(() => {
  if (props.addingToCart) {
    return 'bg-gray-400 text-white cursor-not-allowed'
  }

  if (props.wasRecentlyAdded) {
    return 'bg-green-600 text-white'
  }

  if (props.isInCart) {
    return 'bg-blue-600 text-white cursor-not-allowed'
  }

  if (props.isOwnListing) {
    return 'bg-gray-300 text-gray-500 cursor-not-allowed'
  }

  if (props.listing.quantity <= 0 || props.listing.status !== 'active') {
    return 'bg-gray-300 text-gray-500 cursor-not-allowed'
  }

  return 'bg-blue-600 text-white hover:bg-blue-700'
})

const buttonText = computed(() => {
  if (props.addingToCart) return 'Adding...'
  if (props.wasRecentlyAdded) return 'Added!'
  if (props.isInCart) return 'In Cart'
  if (props.isOwnListing) return 'Your Listing'
  if (props.listing.quantity <= 0 || props.listing.status !== 'active') return 'Unavailable'
  return 'Add to Cart'
})

function incrementQuantity() {
  if (quantity.value < props.listing.quantity) {
    quantity.value++
  }
}

function decrementQuantity() {
  if (quantity.value > 1) {
    quantity.value--
  }
}

function validateQuantity() {
  if (quantity.value < 1) {
    quantity.value = 1
  } else if (quantity.value > props.listing.quantity) {
    quantity.value = props.listing.quantity
  }
}

function handleAddToCart() {
  emit('add-to-cart', { listing: props.listing, quantity: quantity.value })
}

function getConditionColor(condition) {
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

function formatCondition(condition) {
  return condition.replace('_', ' ').toUpperCase()
}

function timeAgo(dateString) {
  const now = new Date()
  const date = new Date(dateString)
  const diffInHours = Math.floor((now - date) / (1000 * 60 * 60))

  if (diffInHours < 1) return 'less than an hour ago'
  if (diffInHours < 24) return `${diffInHours} hours ago`
  if (diffInHours < 168) return `${Math.floor(diffInHours / 24)} days ago`
  return `${Math.floor(diffInHours / 168)} weeks ago`
}

// Reset quantity when listing changes
watch(() => props.listing.id, () => {
  quantity.value = 1
})
</script>
