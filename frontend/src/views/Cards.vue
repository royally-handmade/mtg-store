<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold">Browse Cards</h1>
      <div class="flex space-x-4">
        <select v-model="filters.set" class="rounded border-gray-300">
          <option value="">All Sets</option>
          <option v-for="set in sets" :key="set" :value="set">{{ set }}</option>
        </select>
        <select v-model="filters.rarity" class="rounded border-gray-300">
          <option value="">All Rarities</option>
          <option value="common">Common</option>
          <option value="uncommon">Uncommon</option>
          <option value="rare">Rare</option>
          <option value="mythic">Mythic Rare</option>
        </select>
      </div>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <CardPreview v-for="card in paginatedCards" :key="card.id" :card="card" />
    </div>
    
    <Pagination 
      :current-page="currentPage" 
      :total-pages="totalPages" 
      @page-change="currentPage = $event" 
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '@/lib/api'
import CardPreview from '@/components/CardPreview.vue'
import Pagination from '@/components/Pagination.vue'

const cards = ref([])
const sets = ref([])
const currentPage = ref(1)
const itemsPerPage = 20
const loading = ref(false)

const filters = ref({
  set: '',
  rarity: '',
  search: ''
})

const filteredCards = computed(() => {
  let filtered = cards.value
  
  if (filters.value.set) {
    filtered = filtered.filter(card => card.set_number === filters.value.set)
  }
  
  if (filters.value.rarity) {
    filtered = filtered.filter(card => card.rarity === filters.value.rarity)
  }
  
  if (filters.value.search) {
    filtered = filtered.filter(card => 
      card.name.toLowerCase().includes(filters.value.search.toLowerCase())
    )
  }
  
  return filtered
})

const paginatedCards = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredCards.value.slice(start, end)
})

const totalPages = computed(() => 
  Math.ceil(filteredCards.value.length / itemsPerPage)
)

const fetchCards = async () => {
  loading.value = true
  try {
    const response = await api.get('/cards')
    cards.value = response.data

    cards.value.sort((a,b) => a-b)
    
    // Extract unique sets
    sets.value = [...new Set(cards.value.map(card => card.set_number))]
  } catch (error) {
    console.error('Error fetching cards:', error)
  } finally {
    loading.value = false
  }
}

watch(filters, () => {
  currentPage.value = 1
}, { deep: true })

onMounted(fetchCards)
</script>
