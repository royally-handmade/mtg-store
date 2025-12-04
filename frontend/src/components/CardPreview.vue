<template>
  <div class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer relative"
    @click="$router.push(`/card/${card.id}`)">

    <!-- Wishlist Button Overlay -->
    <div class="absolute top-2 right-2 z-10">
      <WishlistButton :card-id="card.id" :show-text="false" :show-price-alert="false" @click.stop />
    </div>

    <div class="overflow-hidden rounded-t-lg">
      <img :src="card.image_url" :alt="card.name"
        class="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
    </div>
    <div class="p-4">

      <h3 class="font-semibold text-lg mb-1 truncate">{{ card.name }}</h3>
      <p class="text-sm text-gray-600 font-semibold">{{ card.set_number.toUpperCase() }} • <span
          :class="getRarityClass(card.rarity)"
          class="inline-flex px-1.5 py-0.5 text-xs font-semibold rounded uppercase">
          {{ card.rarity.replace('_', ' ') }}
        </span> • #{{ card.card_number }}</p>

      <div class="flex justify-between items-center">
        <span v-if="card.market_price" class="text-lg font-mono font-semibold text-green-800 mt-1 mb-2">
          ${{ card.market_price }} CAD
        </span>
        <!-- <button
          @click.stop="quickAddToCart"
          :disabled="addingToCart"
          class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {{ addingToCart ? 'Adding...' : 'Quick Add' }}
        </button>-->
      </div>
      <div class="flex flex-wrap gap-1">
        <!-- Card Treatment (foil, etched, etc.) -->
        <TreatmentBadge v-if="card.treatment && card.treatment !== 'foil'" :treatment="card.treatment" condensed
          size="xs" />

        <!-- Border Treatment (borderless) -->
        <TreatmentBadge v-if="card.border_color === 'borderless'" treatment="borderless" condensed size="xs" />

        <!-- Frame Effects (showcase, extended-art, etc.) -->
        <TreatmentBadge v-if="card.frame_effects" :treatment="card.frame_effects" condensed size="xs" />

        <!-- Promo Types -->
        <TreatmentBadge v-if="card.promo_types && card.promo_types !== 'universesbeyond'" :treatment="card.promo_types"
          condensed size="xs" />
      </div>
    </div>
  </div>
</template>

<script setup>
  import { ref } from 'vue'
  import { useCartStore } from '@/stores/cart'
  import { useToast } from 'vue-toastification'
  import WishlistButton from '@/components/WishlistButton.vue'
  import api from '@/lib/api'
  import TreatmentBadge from './TreatmentBadge.vue'
  import { setMapStoreSuffix } from 'pinia'

  const props = defineProps({
    card: {
      type: Object,
      required: true
    }
  })

  const cartStore = useCartStore()
  const toast = useToast()
  const addingToCart = ref(false)

  const getRarityClass = (rarity) => {
    const rarityClasses = {
      common: 'bg-gray-100 text-black',
      uncommon: 'bg-slate-300 text-slate-800',
      rare: 'bg-amber-200 text-amber-900',
      mythic: 'bg-orange-200 text-orange-900',
      mythic_rare: 'bg-red-100 text-red-800',
      special: 'bg-purple-100 text-purple-800'
    }
    return rarityClasses[rarity] || 'bg-gray-100 text-gray-800'
  }

  const quickAddToCart = async () => {
    addingToCart.value = true
    try {
      // Find cheapest available listing
      const response = await api.get(`/cards/${props.card.id}/listings`)
      const listings = response.data

      if (listings.length === 0) {
        toast.error('No listings available for this card')
        return
      }

      const cheapestListing = listings[0] // Already sorted by price
      await cartStore.addItem(cheapestListing.id, 1)
      toast.success('Added to cart')
    } catch (error) {
      toast.error('Error adding to cart')
    } finally {
      addingToCart.value = false
    }
  }
</script>