<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold">Bulk Add to Wishlist</h2>
        <button @click="$emit('close')" class="text-gray-500 hover:text-gray-700">
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>

      <div class="space-y-6">
        <!-- Method Selection -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            How would you like to add cards?
          </label>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              @click="method = 'search'"
              :class="method === 'search' ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'"
              class="p-4 border rounded-lg text-left transition-all"
            >
              <div class="font-medium">Search & Add</div>
              <div class="text-sm text-gray-600">Search for cards one by one</div>
            </button>
            <button 
              @click="method = 'list'"
              :class="method === 'list' ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'"
              class="p-4 border rounded-lg text-left transition-all"
            >
              <div class="font-medium">Paste List</div>
              <div class="text-sm text-gray-600">Paste a list of card names</div>
            </button>
          </div>
        </div>

        <!-- Search Method -->
        <div v-if="method === 'search'" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Search for cards
            </label>
            <div class="relative">
              <input 
                v-model="searchQuery"
                @input="debouncedSearch"
                type="text" 
                placeholder="Search card names..."
                class="input-field pr-10"
              />
              <MagnifyingGlassIcon class="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>

          <!-- Search Results -->
          <div v-if="searchResults.length > 0" class="max-h-60 overflow-y-auto border rounded-lg">
            <div v-for="card in searchResults" :key="card.id"
              class="p-3 hover:bg-gray-50 border-b last:border-b-0 cursor-pointer"
              @click="addToSelectedCards(card)">
              <div class="flex items-center space-x-3">
                <img :src="card.image_url" :alt="card.name" class="w-8 h-11 object-cover rounded" />
                <div class="flex-1">
                  <div class="font-medium">{{ card.name }}</div>
                  <div class="text-sm text-gray-600">{{ card.set_number }} • {{ card.rarity }}</div>
                </div>
                <div class="text-sm text-green-600 font-medium">
                  ${{ card.market_price || '0.00' }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- List Method -->
        <div v-if="method === 'list'" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Paste card names (one per line)
            </label>
            <textarea 
              v-model="cardList"
              rows="8"
              class="input-field"
              placeholder="Lightning Bolt
Counterspell
Black Lotus
..."
            ></textarea>
          </div>
          <button @click="processCardList" :disabled="!cardList.trim() || processingList"
            class="btn-secondary disabled:opacity-50">
            {{ processingList ? 'Processing...' : 'Process List' }}
          </button>
        </div>

        <!-- Selected Cards -->
        <div v-if="selectedCards.length > 0" class="space-y-4">
          <div class="flex justify-between items-center">
            <h3 class="font-medium">Selected Cards ({{ selectedCards.length }})</h3>
            <button @click="selectedCards = []" class="text-red-600 hover:text-red-800 text-sm">
              Clear All
            </button>
          </div>

          <div class="max-h-60 overflow-y-auto space-y-2">
            <div v-for="(card, index) in selectedCards" :key="index"
              class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div class="flex items-center space-x-3">
                <img :src="card.image_url" :alt="card.name" class="w-8 h-11 object-cover rounded" />
                <div>
                  <div class="font-medium text-sm">{{ card.name }}</div>
                  <div class="text-xs text-gray-600">{{ card.set_number }}</div>
                </div>
              </div>
              <button @click="selectedCards.splice(index, 1)" 
                class="text-red-600 hover:text-red-800">
                <XMarkIcon class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex space-x-4">
          <button @click="$emit('close')" type="button" 
            class="flex-1 btn-secondary">
            Cancel
          </button>
          <button @click="bulkAdd" 
            :disabled="selectedCards.length === 0 || adding"
            class="flex-1 btn-primary disabled:opacity-50">
            {{ adding ? 'Adding...' : `Add ${selectedCards.length} Cards` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useToast } from 'vue-toastification'
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { debounce } from 'lodash'
import api from '@/lib/api'

const emit = defineEmits(['close', 'added'])
const toast = useToast()

const method = ref('search')
const searchQuery = ref('')
const cardList = ref('')
const searchResults = ref([])
const selectedCards = ref([])
const processingList = ref(false)
const adding = ref(false)

const searchCards = async () => {
  if (searchQuery.value.length < 2) {
    searchResults.value = []
    return
  }
  
  try {
    const response = await api.get('/cards/search', {
      params: { q: searchQuery.value, limit: 10 }
    })
    searchResults.value = response.data
  } catch (error) {
    console.error('Search error:', error)
  }
}

const debouncedSearch = debounce(searchCards, 300)

const addToSelectedCards = (card) => {
  const exists = selectedCards.value.find(c => c.id === card.id)
  if (!exists) {
    selectedCards.value.push(card)
    searchQuery.value = ''
    searchResults.value = []
  } else {
    toast.info('Card already selected')
  }
}

const processCardList = async () => {
  processingList.value = true
  const lines = cardList.value.split('\n').filter(line => line.trim())
  
  for (const line of lines) {
    try {
      const response = await api.get('/cards/search', {
        params: { q: line.trim(), limit: 1 }
      })
      if (response.data.length > 0) {
        const card = response.data[0]
        const exists = selectedCards.value.find(c => c.id === card.id)
        if (!exists) {
          selectedCards.value.push(card)
        }
      }
    } catch (error) {
      console.error('Error processing card:', line, error)
    }
  }
  
  processingList.value = false
  cardList.value = ''
}

const bulkAdd = async () => {
  adding.value = true
  try {
    const cards = selectedCards.value.map(card => ({
      card_id: card.id
    }))
    
    const response = await api.post('/wishlist/bulk-add', { cards })
    
    toast.success(`Added ${response.data.summary.added} cards to wishlist`)
    emit('added')
    emit('close')
  } catch (error) {
    console.error('Bulk add error:', error)
    toast.error('Failed to add cards to wishlist')
  } finally {
    adding.value = false
  }
}
</script>