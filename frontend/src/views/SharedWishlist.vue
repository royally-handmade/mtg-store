<template>
  <div class="space-y-6">
    <div class="text-center py-8">
      <h1 class="text-3xl font-bold mb-4">Shared Wishlist</h1>
      <p class="text-gray-600">{{ itemCount }} cards • Total value: ${{ totalValue }} CAD</p>
    </div>

    <div v-if="loading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>

    <div v-else-if="error" class="text-center py-12">
      <p class="text-red-600">{{ error }}</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <CardPreview v-for="card in cards" :key="card.id" :card="card" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/lib/api'
import CardPreview from '@/components/CardPreview.vue'

const route = useRoute()
const loading = ref(true)
const error = ref('')
const cards = ref([])

const itemCount = computed(() => cards.value.length)
const totalValue = computed(() => {
  return cards.value.reduce((sum, card) => {
    return sum + (parseFloat(card.market_price || 0))
  }, 0).toFixed(2)
})

onMounted(async () => {
  try {
    const sharedId = route.params.id
    const cardIds = JSON.parse(atob(sharedId))
    
    // Fetch card details for each ID
    const cardPromises = cardIds.map(id => api.get(`/cards/${id}`))
    const responses = await Promise.all(cardPromises)
    cards.value = responses.map(response => response.data)
  } catch (err) {
    error.value = 'Invalid or expired shared wishlist link'
  } finally {
    loading.value = false
  }
})
</script>
