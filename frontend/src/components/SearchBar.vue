<template>
  <div class="relative flex-1 max-w-md">
    <input 
      v-model="searchQuery"
      @input="handleSearch"
      @focus="showResults = true"
      @blur="handleBlur"
      @keydown.escape="closeResults"
      @keydown.enter="handleEnterKey"
      @keydown="handleKeyNavigation"
      type="text" 
      placeholder="Search cards..." 
      class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
    <MagnifyingGlassIcon class="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
    
    <!-- Search Results Dropdown -->
    <div v-if="showResults && (searchResults.length > 0 || searchQuery.length > 0)" 
      class="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border z-50 max-h-96 overflow-y-auto">
      
      <div v-if="loading" class="p-4 text-center text-gray-500">
        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
        <span class="mt-2 block">Searching...</span>
      </div>
      
      <div v-else-if="searchResults.length === 0 && searchQuery.length > 0" 
        class="p-4 text-center text-gray-500">
        <XCircleIcon class="h-8 w-8 mx-auto mb-2 text-gray-300" />
        No cards found for "{{ searchQuery }}"
      </div>
      
      <div v-else>
        <!-- Recent Searches -->
        <div v-if="searchQuery.length === 0 && recentSearches.length > 0" class="border-b border-gray-100">
          <div class="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
            Recent Searches
          </div>
          <button 
            v-for="search in recentSearches" 
            :key="search"
            @click="searchQuery = search; handleSearch()"
            class="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm text-gray-700 flex items-center"
          >
            <ClockIcon class="h-4 w-4 mr-2 text-gray-400" />
            {{ search }}
          </button>
        </div>
        
        <!-- Search Results -->
        <div v-for="(card, index) in searchResults" :key="card.id">
          <router-link 
            :to="`/card/${card.id}`"
            @click="closeResults"
            :class="index === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'"
            class="flex items-center space-x-3 p-3 border-b last:border-b-0 transition-colors"
          >
            <img :src="card.image_url" :alt="card.name" 
              class="w-10 h-14 object-cover rounded shadow-sm" 
              loading="lazy" />
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm truncate" v-html="highlightMatch(card.name)"></div>
              <div class="text-xs text-gray-600">{{ card.set_number }} • {{ formatRarity(card.rarity) }}</div>
              <div v-if="card.market_price" class="text-xs text-green-600 font-medium">
                ${{ card.market_price }} CAD
              </div>
            </div>
            <div class="text-right">
              <div class="text-xs text-gray-400">{{ card.type_line }}</div>
            </div>
          </router-link>
        </div>
        
        <!-- View All Results -->
        <div v-if="searchResults.length >= 10" class="border-t border-gray-100">
          <router-link 
            :to="`/search?q=${encodeURIComponent(searchQuery)}`"
            @click="closeResults"
            class="block w-full text-center py-3 text-blue-600 hover:bg-blue-50 text-sm font-medium"
          >
            View all results for "{{ searchQuery }}"
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  MagnifyingGlassIcon, 
  XCircleIcon, 
  ClockIcon 
} from '@heroicons/vue/24/outline'
import api from '@/lib/api'

const router = useRouter()

const props = defineProps({
  debounceMs: {
    type: Number,
    default: 300
  }
})

const emit = defineEmits(['search-error'])

const searchQuery = ref('')
const searchResults = ref([])
const showResults = ref(false)
const loading = ref(false)
const selectedIndex = ref(-1)
const recentSearches = ref([])

let debounceTimer = null

// Load recent searches from localStorage
onMounted(() => {
  const saved = localStorage.getItem('mtg-recent-searches')
  if (saved) {
    try {
      recentSearches.value = JSON.parse(saved)
    } catch (e) {
      console.warn('Failed to parse recent searches:', e)
    }
  }
})

const handleSearch = async () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  debounceTimer = setTimeout(async () => {
    const query = searchQuery.value.trim()
    
    if (query.length === 0) {
      searchResults.value = []
      return
    }

    if (query.length < 2) {
      return
    }

    loading.value = true
    selectedIndex.value = -1

    try {
      // Try enhanced search suggestions first
      let response
      try {
        response = await api.get('/search/suggestions', {
          params: { q: query, limit: 10 }
        })
        // Convert to expected format if needed
        if (response.data && Array.isArray(response.data) && response.data[0]?.type) {
          searchResults.value = response.data.filter(item => item.type === 'card').map(item => ({
            id: item.id || Math.random().toString(36),
            name: item.display || item.value,
            image_url: item.image,
            set_number: item.set,
            type_line: item.type_line || '',
            rarity: item.rarity || '',
            market_price: item.market_price || null
          }))
        } else {
          searchResults.value = response.data
        }
      } catch (enhancedError) {
        // Fallback to existing cards search
        response = await api.get('/cards', {
          params: { search: query, limit: 10 }
        })
        searchResults.value = response.data || []
      }
      
      // Add to recent searches if not already there
      if (query.length >= 2 && !recentSearches.value.includes(query)) {
        recentSearches.value.unshift(query)
        recentSearches.value = recentSearches.value.slice(0, 5)
        
        try {
          localStorage.setItem('mtg-recent-searches', JSON.stringify(recentSearches.value))
        } catch (e) {
          console.warn('Failed to save recent searches:', e)
        }
      }
      
    } catch (error) {
      console.error('Search error:', error)
      searchResults.value = []
      emit('search-error', error.message)
    } finally {
      loading.value = false
    }
  }, props.debounceMs)
}

const closeResults = () => {
  setTimeout(() => {
    showResults.value = false
    selectedIndex.value = -1
  }, 150)
}

const handleBlur = () => {
  closeResults()
}

const handleEnterKey = () => {
  if (selectedIndex.value >= 0 && searchResults.value[selectedIndex.value]) {
    const card = searchResults.value[selectedIndex.value]
    router.push(`/card/${card.id}`)
    closeResults()
  } else if (searchQuery.value.trim()) {
    router.push(`/search?q=${encodeURIComponent(searchQuery.value.trim())}`)
    closeResults()
  }
}

const handleKeyNavigation = (event) => {
  if (!showResults.value || searchResults.value.length === 0) return
  
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      selectedIndex.value = Math.min(selectedIndex.value + 1, searchResults.value.length - 1)
      break
    case 'ArrowUp':
      event.preventDefault()
      selectedIndex.value = Math.max(selectedIndex.value - 1, -1)
      break
  }
}

const highlightMatch = (text) => {
  if (!searchQuery.value) return text
  const regex = new RegExp(`(${searchQuery.value})`, 'gi')
  return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>')
}

const formatRarity = (rarity) => {
  const rarityMap = {
    'common': 'Common',
    'uncommon': 'Uncommon', 
    'rare': 'Rare',
    'mythic': 'Mythic Rare'
  }
  return rarityMap[rarity] || rarity
}

// Clear results when search query is empty
watch(searchQuery, (newValue) => {
  if (newValue.trim().length === 0) {
    searchResults.value = []
    selectedIndex.value = -1
  }
})
</script>

<style scoped>
mark {
  background-color: #fef08a;
  padding: 0;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>