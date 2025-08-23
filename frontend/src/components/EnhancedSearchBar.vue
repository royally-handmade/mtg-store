<template>
  <div class="w-full max-w-4xl mx-auto relative">
    <!-- Main Search Bar -->
    <div class="relative">
      <div class="flex items-center bg-white border border-gray-300 rounded-lg shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
        <MagnifyingGlassIcon class="h-5 w-5 text-gray-400 ml-3" />
        
        <input
          ref="searchInput"
          v-model="query"
          type="text"
          @input="handleQueryChange"
          @focus="showSuggestions = true"
          @blur="handleBlur"
          @keydown="handleKeyDown"
          placeholder="Search for cards, sets, or types..."
          class="flex-1 px-3 py-3 border-0 outline-none"
        />

        <!-- Filter Toggle -->
        <button
          @click="showFilters = !showFilters"
          :class="[
            'px-3 py-2 mx-2 rounded-md text-sm font-medium border transition-colors',
            getActiveFilterCount() > 0 
              ? 'bg-blue-100 text-blue-700 border-blue-300' 
              : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
          ]"
        >
          <FunnelIcon class="h-4 w-4 inline mr-1" />
          Filters
          <span v-if="getActiveFilterCount() > 0" 
            class="ml-1 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
            {{ getActiveFilterCount() }}
          </span>
        </button>

        <!-- Search Button -->
        <button
          @click="handleSearch()"
          class="px-6 py-3 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 transition-colors"
        >
          Search
        </button>
      </div>

      <!-- Search Suggestions -->
      <div
        v-if="showSuggestions && suggestions.length > 0"
        ref="suggestionsRef"
        class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
      >
        <button
          v-for="(suggestion, index) in suggestions"
          :key="`${suggestion.type}-${suggestion.value}-${index}`"
          @click="handleSuggestionClick(suggestion)"
          :class="[
            'w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3',
            index === selectedSuggestion ? 'bg-blue-50' : ''
          ]"
        >
          <img 
            v-if="suggestion.image" 
            :src="suggestion.image" 
            :alt="suggestion.display"
            class="w-8 h-11 object-cover rounded"
          />
          <div class="flex-1">
            <div class="font-medium text-gray-900">{{ suggestion.display }}</div>
            <div v-if="suggestion.set" class="text-sm text-gray-500">{{ suggestion.set }}</div>
          </div>
          <div class="text-xs text-gray-400 capitalize">
            {{ suggestion.type }}
          </div>
        </button>
      </div>
    </div>

    <!-- Advanced Filters Panel -->
    <div v-if="showFilters" class="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium text-gray-900">Search Filters</h3>
        <div class="flex items-center space-x-2">
          <button
            @click="clearFilters"
            class="text-sm text-gray-600 hover:text-gray-800"
          >
            Clear All
          </button>
          <button
            @click="showFilters = false"
            class="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Search Type -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Search Type
          </label>
          <select
            v-model="filters.type"
            @change="handleFilterChange('type', $event.target.value)"
            class="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="all">All Results</option>
            <option value="cards">Cards Only</option>
            <option value="listings">Listings Only</option>
            <option value="sellers">Sellers Only</option>
          </select>
        </div>

        <!-- Sort -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Sort By
          </label>
          <select
            v-model="filters.sort"
            @change="handleFilterChange('sort', $event.target.value)"
            class="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="relevance">Relevance</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name_asc">Name: A to Z</option>
            <option value="name_desc">Name: Z to A</option>
          </select>
        </div>

        <!-- Price Range -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Price Range (CAD)
          </label>
          <div class="flex space-x-2">
            <input
              type="number"
              placeholder="Min"
              v-model="filters.min_price"
              @input="handleFilterChange('min_price', $event.target.value)"
              class="w-full border border-gray-300 rounded-md px-3 py-2"
            />
            <input
              type="number"
              placeholder="Max"
              v-model="filters.max_price"
              @input="handleFilterChange('max_price', $event.target.value)"
              class="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
        </div>

        <!-- Condition -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Condition
          </label>
          <select
            v-model="filters.condition"
            @change="handleFilterChange('condition', $event.target.value)"
            class="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">All Conditions</option>
            <option value="Near Mint">Near Mint</option>
            <option value="Lightly Played">Lightly Played</option>
            <option value="Moderately Played">Moderately Played</option>
            <option value="Heavily Played">Heavily Played</option>
            <option value="Damaged">Damaged</option>
          </select>
        </div>

        <!-- Set -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Set
          </label>
          <input
            type="text"
            placeholder="e.g. MH3, BRO"
            v-model="filters.set"
            @input="handleFilterChange('set', $event.target.value)"
            class="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>

        <!-- Rarity -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Rarity
          </label>
          <select
            v-model="filters.rarity"
            @change="handleFilterChange('rarity', $event.target.value)"
            class="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">All Rarities</option>
            <option value="common">Common</option>
            <option value="uncommon">Uncommon</option>
            <option value="rare">Rare</option>
            <option value="mythic">Mythic Rare</option>
          </select>
        </div>

        <!-- Language -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Language
          </label>
          <select
            v-model="filters.language"
            @change="handleFilterChange('language', $event.target.value)"
            class="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="English">English</option>
            <option value="Japanese">Japanese</option>
            <option value="French">French</option>
            <option value="German">German</option>
            <option value="Spanish">Spanish</option>
            <option value="Italian">Italian</option>
            <option value="Korean">Korean</option>
            <option value="Portuguese">Portuguese</option>
            <option value="Russian">Russian</option>
            <option value="Chinese Simplified">Chinese Simplified</option>
            <option value="Chinese Traditional">Chinese Traditional</option>
          </select>
        </div>

        <!-- Availability -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Availability
          </label>
          <select
            v-model="filters.availability"
            @change="handleFilterChange('availability', $event.target.value)"
            class="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="in_stock">In Stock Only</option>
            <option value="all">All Listings</option>
          </select>
        </div>
      </div>

      <!-- Special Properties -->
      <div class="mt-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Special Properties
        </label>
        <div class="flex flex-wrap gap-4">
          <label class="flex items-center">
            <input
              type="checkbox"
              :checked="filters.foil === true"
              @change="handleFilterChange('foil', $event.target.checked ? true : null)"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span class="ml-2 text-sm text-gray-700">Foil</span>
          </label>
          <label class="flex items-center">
            <input
              type="checkbox"
              :checked="filters.signed === true"
              @change="handleFilterChange('signed', $event.target.checked ? true : null)"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span class="ml-2 text-sm text-gray-700">Signed</span>
          </label>
          <label class="flex items-center">
            <input
              type="checkbox"
              :checked="filters.altered === true"
              @change="handleFilterChange('altered', $event.target.checked ? true : null)"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span class="ml-2 text-sm text-gray-700">Altered</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Saved Searches -->
    <div v-if="savedSearches.length > 0" class="mt-4">
      <h4 class="text-sm font-medium text-gray-700 mb-2">Saved Searches</h4>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="search in savedSearches"
          :key="search.id"
          @click="executeSavedSearch(search)"
          class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 flex items-center space-x-1"
        >
          <BookmarkIcon class="h-3 w-3" />
          <span>{{ search.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  XMarkIcon,
  BookmarkIcon
} from '@heroicons/vue/24/outline'
import api from '@/lib/api'

// Props
const props = defineProps({
  savedSearches: {
    type: Array,
    default: () => []
  }
})

// Emits
const emit = defineEmits(['search', 'filter-change'])

// Refs
const searchInput = ref(null)
const suggestionsRef = ref(null)
const debounceRef = ref(null)

// Reactive state
const query = ref('')
const suggestions = ref([])
const showSuggestions = ref(false)
const showFilters = ref(false)
const selectedSuggestion = ref(-1)
const filters = ref({
  type: 'all',
  sort: 'relevance',
  min_price: '',
  max_price: '',
  condition: '',
  set: '',
  rarity: '',
  foil: null,
  signed: null,
  altered: null,
  language: 'English',
  availability: 'in_stock'
})

// Computed
const getActiveFilterCount = () => {
  const defaultValues = ['all', 'relevance', '', null, 'English', 'in_stock']
  return Object.values(filters.value).filter(value => 
    !defaultValues.includes(value) && value !== ''
  ).length
}

// Methods
const handleQueryChange = () => {
  setSelectedSuggestion(-1)
  
  clearTimeout(debounceRef.value)
  debounceRef.value = setTimeout(() => {
    fetchSuggestions(query.value)
  }, 300)
}

const fetchSuggestions = async (searchQuery) => {
  if (!searchQuery || searchQuery.length < 2) {
    suggestions.value = []
    return
  }

  try {
    const response = await api.get('/search/suggestions', {
      params: { q: searchQuery, limit: 10 }
    })
    suggestions.value = response.data
  } catch (error) {
    console.error('Error fetching suggestions:', error)
    suggestions.value = []
  }
}

const handleSearch = (searchQuery = query.value) => {
  emit('search', searchQuery, filters.value)
  setShowSuggestions(false)
}

const handleSuggestionClick = (suggestion) => {
  query.value = suggestion.value
  handleSearch(suggestion.value)
}

const handleKeyDown = (e) => {
  if (!showSuggestions.value || suggestions.value.length === 0) {
    if (e.key === 'Enter') {
      handleSearch()
    }
    return
  }

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      setSelectedSuggestion(
        selectedSuggestion.value < suggestions.value.length - 1 
          ? selectedSuggestion.value + 1 
          : selectedSuggestion.value
      )
      break
    case 'ArrowUp':
      e.preventDefault()
      setSelectedSuggestion(
        selectedSuggestion.value > -1 
          ? selectedSuggestion.value - 1 
          : -1
      )
      break
    case 'Enter':
      e.preventDefault()
      if (selectedSuggestion.value >= 0) {
        handleSuggestionClick(suggestions.value[selectedSuggestion.value])
      } else {
        handleSearch()
      }
      break
    case 'Escape':
      setShowSuggestions(false)
      setSelectedSuggestion(-1)
      break
  }
}

const handleBlur = (e) => {
  // Delay hiding suggestions to allow clicking on them
  setTimeout(() => {
    if (!suggestionsRef.value?.contains(e.relatedTarget)) {
      setShowSuggestions(false)
    }
  }, 200)
}

const handleFilterChange = (filterKey, value) => {
  filters.value[filterKey] = value
  emit('filter-change', filters.value)
}

const clearFilters = () => {
  filters.value = {
    type: 'all',
    sort: 'relevance',
    min_price: '',
    max_price: '',
    condition: '',
    set: '',
    rarity: '',
    foil: null,
    signed: null,
    altered: null,
    language: 'English',
    availability: 'in_stock'
  }
  emit('filter-change', filters.value)
}

const executeSavedSearch = (search) => {
  query.value = search.query_params.q || ''
  filters.value = { ...filters.value, ...search.query_params }
  handleSearch(search.query_params.q || '', { ...filters.value, ...search.query_params })
}

const setShowSuggestions = (show) => {
  showSuggestions.value = show
}

const setSelectedSuggestion = (index) => {
  selectedSuggestion.value = index
}

// Watch for filter changes
watch(filters, (newFilters) => {
  if (getActiveFilterCount() > 0 || query.value) {
    emit('filter-change', newFilters)
  }
}, { deep: true })
</script>

<!-- Advanced Search Modal Component -->
<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      <div class="p-6 border-b">
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-semibold">Advanced Search</h2>
          <button
            @click="$emit('close')"
            class="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon class="h-6 w-6" />
          </button>
        </div>
      </div>

      <div class="p-6 space-y-6">
        <!-- Text Search -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Card Name or Text
          </label>
          <div class="space-y-2">
            <input
              type="text"
              v-model="advancedFilters.text_search"
              placeholder="Lightning Bolt, Counterspell, etc."
              class="w-full border border-gray-300 rounded-md px-3 py-2"
            />
            <label class="flex items-center">
              <input
                type="checkbox"
                v-model="advancedFilters.exact_name"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span class="ml-2 text-sm text-gray-700">Exact name match</span>
            </label>
          </div>
        </div>

        <!-- Colors -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Colors
            </label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="color in colors"
                :key="color.symbol"
                @click="toggleColor(color.symbol)"
                :class="[
                  'w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold transition-all',
                  advancedFilters.colors.includes(color.symbol)
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-300 hover:border-gray-400',
                  color.bgClass,
                  color.symbol === 'B' ? 'text-white' : 'text-black'
                ]"
              >
                {{ color.symbol }}
              </button>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Color Identity
            </label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="color in colors"
                :key="`identity-${color.symbol}`"
                @click="toggleColorIdentity(color.symbol)"
                :class="[
                  'w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold transition-all',
                  advancedFilters.color_identity.includes(color.symbol)
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-300 hover:border-gray-400',
                  color.bgClass,
                  color.symbol === 'B' ? 'text-white' : 'text-black'
                ]"
              >
                {{ color.symbol }}
              </button>
            </div>
          </div>
        </div>

        <!-- Numeric Filters -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Mana Cost
            </label>
            <div class="flex space-x-2">
              <input
                type="number"
                placeholder="Min"
                v-model="advancedFilters.cmc_min"
                class="w-full border border-gray-300 rounded-md px-3 py-2"
              />
              <input
                type="number"
                placeholder="Max"
                v-model="advancedFilters.cmc_max"
                class="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Power
            </label>
            <div class="flex space-x-2">
              <input
                type="text"
                placeholder="Min"
                v-model="advancedFilters.power_min"
                class="w-full border border-gray-300 rounded-md px-3 py-2"
              />
              <input
                type="text"
                placeholder="Max"
                v-model="advancedFilters.power_max"
                class="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Toughness
            </label>
            <div class="flex space-x-2">
              <input
                type="text"
                placeholder="Min"
                v-model="advancedFilters.toughness_min"
                class="w-full border border-gray-300 rounded-md px-3 py-2"
              />
              <input
                type="text"
                placeholder="Max"
                v-model="advancedFilters.toughness_max"
                class="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>
        </div>

        <!-- Card Types -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Card Types
          </label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="type in cardTypes"
              :key="type"
              @click="toggleType(type)"
              :class="[
                'px-3 py-1 text-sm rounded-full border transition-colors',
                advancedFilters.types.includes(type)
                  ? 'bg-blue-100 border-blue-300 text-blue-700'
                  : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
              ]"
            >
              {{ type }}
            </button>
          </div>
        </div>

        <!-- Format Legality -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Format Legality
          </label>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div v-for="format in formats" :key="format">
              <label class="block text-xs font-medium text-gray-600 mb-1">
                {{ format }}
              </label>
              <select
                v-model="advancedFilters.format_legality[format.toLowerCase()]"
                class="w-full text-sm border border-gray-300 rounded-md px-2 py-1"
              >
                <option value="">Any</option>
                <option value="legal">Legal</option>
                <option value="banned">Banned</option>
                <option value="restricted">Restricted</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="p-6 border-t bg-gray-50 flex justify-between">
        <button
          @click="clearAdvancedFilters"
          class="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Clear All
        </button>
        <div class="flex space-x-3">
          <button
            @click="$emit('close')"
            class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            @click="handleSubmit"
            class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Search
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'

// Props
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['close', 'search'])

// Data
const colors = [
  { symbol: 'W', name: 'White', bgClass: 'bg-yellow-100' },
  { symbol: 'U', name: 'Blue', bgClass: 'bg-blue-100' },
  { symbol: 'B', name: 'Black', bgClass: 'bg-gray-800' },
  { symbol: 'R', name: 'Red', bgClass: 'bg-red-100' },
  { symbol: 'G', name: 'Green', bgClass: 'bg-green-100' }
]

const formats = [
  'Standard', 'Pioneer', 'Modern', 'Legacy', 'Vintage', 'Commander', 
  'Historic', 'Explorer', 'Alchemy', 'Brawl', 'Pauper'
]

const cardTypes = [
  'Artifact', 'Battle', 'Creature', 'Enchantment', 'Instant', 
  'Land', 'Planeswalker', 'Sorcery', 'Tribal'
]

const advancedFilters = ref({
  text_search: '',
  exact_name: false,
  colors: [],
  color_identity: [],
  cmc_min: '',
  cmc_max: '',
  power_min: '',
  power_max: '',
  toughness_min: '',
  toughness_max: '',
  types: [],
  subtypes: [],
  keywords: [],
  price_filters: {
    min: '',
    max: '',
    currency: 'CAD'
  },
  condition_filters: [],
  seller_filters: {
    rating_min: '',
    tier: '',
    location: ''
  },
  format_legality: {},
  sort: 'relevance'
})

// Methods
const toggleColor = (colorSymbol) => {
  const colors = advancedFilters.value.colors
  const index = colors.indexOf(colorSymbol)
  if (index > -1) {
    colors.splice(index, 1)
  } else {
    colors.push(colorSymbol)
  }
}

const toggleColorIdentity = (colorSymbol) => {
  const colorIdentity = advancedFilters.value.color_identity
  const index = colorIdentity.indexOf(colorSymbol)
  if (index > -1) {
    colorIdentity.splice(index, 1)
  } else {
    colorIdentity.push(colorSymbol)
  }
}

const toggleType = (type) => {
  const types = advancedFilters.value.types
  const index = types.indexOf(type)
  if (index > -1) {
    types.splice(index, 1)
  } else {
    types.push(type)
  }
}

const clearAdvancedFilters = () => {
  advancedFilters.value = {
    text_search: '',
    exact_name: false,
    colors: [],
    color_identity: [],
    cmc_min: '',
    cmc_max: '',
    power_min: '',
    power_max: '',
    toughness_min: '',
    toughness_max: '',
    types: [],
    subtypes: [],
    keywords: [],
    price_filters: { min: '', max: '', currency: 'CAD' },
    condition_filters: [],
    seller_filters: { rating_min: '', tier: '', location: '' },
    format_legality: {},
    sort: 'relevance'
  }
}

const handleSubmit = () => {
  emit('search', advancedFilters.value)
  emit('close')
}
</script>

<!-- Search Results Component -->
<template>
  <div class="space-y-4">
    <div v-if="loading && !results" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>

    <!-- View Toggle -->
    <div v-if="results" class="flex border-b border-gray-200">
      <button
        v-for="(resultType, key) in results"
        :key="key"
        @click="view = key"
        :class="[
          'px-4 py-2 border-b-2 font-medium text-sm',
          view === key
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        ]"
      >
        {{ key.charAt(0).toUpperCase() + key.slice(1) }} ({{ resultType.count || 0 }})
      </button>
    </div>

    <!-- Results -->
    <div v-if="results" class="grid gap-4">
      <!-- Cards View -->
      <div v-if="view === 'cards' && results.cards?.data" class="space-y-4">
        <div
          v-for="card in results.cards.data"
          :key="card.id"
          class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div class="flex items-start space-x-4">
            <img 
              :src="card.image_url" 
              :alt="card.name"
              class="w-16 h-22 object-cover rounded"
            />
            <div class="flex-1">
              <h3 class="font-semibold text-lg text-gray-900">{{ card.name }}</h3>
              <p class="text-sm text-gray-600">{{ card.set_name }} • {{ card.rarity }}</p>
              <p class="text-sm text-gray-500 mt-1">{{ card.type_line }}</p>
              
              <div v-if="card.listings && card.listings.length > 0" class="mt-2">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-green-600">
                    From ${{ card.lowest_price?.toFixed(2) }}
                  </span>
                  <span class="text-xs text-gray-500">
                    {{ card.listing_count }} listing{{ card.listing_count !== 1 ? 's' : '' }}
                  </span>
                </div>
              </div>
            </div>
            <router-link
              :to="`/card/${card.id}`"
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              View Details
            </router-link>
          </div>
        </div>
      </div>

      <!-- Listings View -->
      <div v-if="view === 'listings' && results.listings?.data" class="space-y-4">
        <div
          v-for="listing in results.listings.data"
          :key="listing.id"
          class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div class="flex items-start space-x-4">
            <img 
              :src="listing.cards.image_url" 
              :alt="listing.cards.name"
              class="w-16 h-22 object-cover rounded"
            />
            <div class="flex-1">
              <h3 class="font-semibold text-lg text-gray-900">{{ listing.cards.name }}</h3>
              <p class="text-sm text-gray-600">{{ listing.cards.set_number }} • {{ listing.condition }}</p>
              
              <div class="flex items-center space-x-4 mt-2">
                <span class="text-lg font-bold text-green-600">
                  ${{ listing.price.toFixed(2) }}
                </span>
                <span class="text-sm text-gray-500">
                  Qty: {{ listing.quantity }}
                </span>
                <span v-if="listing.foil" class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  Foil
                </span>
                <span v-if="listing.signed" class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Signed
                </span>
              </div>
              
              <div class="flex items-center mt-2">
                <span class="text-sm text-gray-600">by {{ listing.profiles.display_name }}</span>
                <span v-if="listing.profiles.rating" class="ml-2 text-sm text-yellow-600">
                  ★ {{ listing.profiles.rating.toFixed(1) }}
                </span>
              </div>
            </div>
            <div class="flex flex-col space-y-2">
              <button class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm">
                Add to Cart
              </button>
              <router-link
                :to="`/card/${listing.cards.id}`"
                class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm text-center"
              >
                View Card
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- Sellers View -->
      <div v-if="view === 'sellers' && results.sellers?.data" class="space-y-4">
        <div
          v-for="seller in results.sellers.data"
          :key="seller.id"
          class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div class="flex items-start justify-between">
            <div>
              <h3 class="font-semibold text-lg text-gray-900">{{ seller.display_name }}</h3>
              <p v-if="seller.seller_settings?.business_name" class="text-sm text-gray-600">
                {{ seller.seller_settings.business_name }}
              </p>
              
              <div class="flex items-center space-x-4 mt-2">
                <span v-if="seller.rating" class="text-sm text-yellow-600">
                  ★ {{ seller.rating.toFixed(1) }} rating
                </span>
                <span class="text-sm text-gray-500">
                  {{ seller._count_listings }} listings
                </span>
                <span
                  v-if="seller.seller_tier"
                  :class="[
                    'text-xs px-2 py-1 rounded capitalize',
                    seller.seller_tier === 'platinum' ? 'bg-purple-100 text-purple-800' :
                    seller.seller_tier === 'gold' ? 'bg-yellow-100 text-yellow-800' :
                    seller.seller_tier === 'silver' ? 'bg-gray-100 text-gray-800' :
                    'bg-orange-100 text-orange-800'
                  ]"
                >
                  {{ seller.seller_tier }}
                </span>
              </div>
            </div>
            <router-link
              :to="`/seller/${seller.id}`"
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              View Store
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Load More Button -->
    <div v-if="hasMore && results" class="text-center py-4">
      <button
        @click="$emit('load-more')"
        :disabled="loading"
        class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {{ loading ? 'Loading...' : 'Load More' }}
      </button>
    </div>

    <!-- No Results -->
    <div v-if="!loading && results && Object.values(results).every(data => data.count === 0)" class="text-center py-12">
      <div class="text-gray-400 text-lg mb-2">No results found</div>
      <div class="text-gray-500">Try adjusting your search criteria</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// Props
const props = defineProps({
  results: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  },
  hasMore: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['load-more'])

// State
const view = ref('cards')

// Watch for results to set initial view
watch(() => props.results, (newResults) => {
  if (newResults) {
    // Set view to the first result type that has data
    const availableViews = Object.keys(newResults).filter(key => 
      newResults[key]?.data?.length > 0
    )
    if (availableViews.length > 0) {
      view.value = availableViews[0]
    }
  }
}, { immediate: true })
</script>


