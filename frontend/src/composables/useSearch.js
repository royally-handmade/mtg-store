import { ref, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/lib/api'

export function useSearch() {
  // Reactive state
  const query = ref('')
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
  
  const results = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const currentPage = ref(1)
  const suggestions = ref([])
  const showSuggestions = ref(false)
  const savedSearches = ref([])
  const facets = ref({})

  // Route and router for URL sync
  const route = useRoute()
  const router = useRouter()

  // Computed properties
  const hasResults = computed(() => {
    if (!results.value) return false
    return Object.values(results.value).some(result => 
      result.data && result.data.length > 0
    )
  })

  const totalResults = computed(() => {
    if (!results.value) return 0
    return Object.values(results.value).reduce((total, result) => 
      total + (result.count || 0), 0
    )
  })

  const hasActiveFilters = computed(() => {
    const defaultValues = ['all', 'relevance', '', null, 'English', 'in_stock']
    return Object.values(filters.value).some(value => 
      !defaultValues.includes(value) && value !== ''
    )
  })

  // Debounced search function
  let searchTimeout = null
  const debouncedSearch = (searchQuery, searchFilters, delay = 300) => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      performSearch(searchQuery, searchFilters)
    }, delay)
  }

  // Main search function that works with your existing API
  const performSearch = async (searchQuery = query.value, searchFilters = filters.value) => {
    if (!searchQuery.trim() && !hasActiveFilters.value) {
      results.value = null
      return
    }

    loading.value = true
    error.value = null

    try {
      // Use your existing search API structure
      const params = {
        q: searchQuery,
        page: currentPage.value,
        limit: 20,
        ...searchFilters
      }

      // Remove empty/null values
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key]
        }
      })

      let response
      
      // Check if we have the new enhanced search API
      try {
        response = await api.get('/search', { params })
      } catch (searchError) {
        // Fallback to existing cards search if enhanced search not available
        if (searchError.response?.status === 404) {
          response = await api.get('/cards', { params })
          // Wrap in expected format
          response.data = {
            cards: {
              data: response.data,
              count: response.data.length,
              pagination: {
                page: currentPage.value,
                limit: 20,
                total: response.data.length,
                totalPages: Math.ceil(response.data.length / 20)
              }
            }
          }
        } else {
          throw searchError
        }
      }
      
      results.value = response.data

      // Update URL with search parameters
      updateURL(searchQuery, searchFilters)

      // Add to search history
      addToSearchHistory(searchQuery, searchFilters)

    } catch (err) {
      console.error('Search error:', err)
      error.value = err.response?.data?.error || 'Search failed'
    } finally {
      loading.value = false
    }
  }

  // Get search suggestions using existing API
  const getSuggestions = async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      suggestions.value = []
      return
    }

    try {
      // Try enhanced suggestions first, fallback to cards search
      let response
      try {
        response = await api.get('/search/suggestions', {
          params: { q: searchQuery, limit: 10 }
        })
      } catch (suggestionsError) {
        // Fallback to cards search for suggestions
        response = await api.get('/cards', {
          params: { search: searchQuery, limit: 10 }
        })
        // Transform to expected format
        response.data = response.data.map(card => ({
          type: 'card',
          value: card.name,
          display: card.name,
          image: card.image_url,
          set: card.set_number
        }))
      }
      
      suggestions.value = response.data
    } catch (err) {
      console.error('Suggestions error:', err)
      suggestions.value = []
    }
  }

  // Save current search (requires enhanced API)
  const saveSearch = async (name, alertEnabled = false) => {
    try {
      const searchParams = {
        q: query.value,
        ...filters.value
      }

      const response = await api.post('/search/save', {
        name,
        query_params: searchParams,
        alert_enabled: alertEnabled
      })

      await loadSavedSearches()
      return response.data

    } catch (err) {
      console.error('Save search error:', err)
      throw err
    }
  }

  // Load saved searches
  const loadSavedSearches = async () => {
    try {
      const response = await api.get('/search/saved')
      savedSearches.value = response.data
    } catch (err) {
      console.error('Load saved searches error:', err)
      // Don't throw error if feature not available
      savedSearches.value = []
    }
  }

  // Execute saved search
  const executeSavedSearch = async (savedSearch) => {
    query.value = savedSearch.query_params.q || ''
    filters.value = { ...filters.value, ...savedSearch.query_params }
    currentPage.value = 1
    await performSearch()
  }

  // Delete saved search
  const deleteSavedSearch = async (searchId) => {
    try {
      await api.delete(`/search/saved/${searchId}`)
      await loadSavedSearches()
    } catch (err) {
      console.error('Delete saved search error:', err)
      throw err
    }
  }

  // Clear all filters
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
  }

  // Update URL with search parameters
  const updateURL = (searchQuery, searchFilters) => {
    const queryParams = { ...route.query }

    if (searchQuery) {
      queryParams.q = searchQuery
      queryParams.search = searchQuery // Also set search for compatibility
    } else {
      delete queryParams.q
      delete queryParams.search
    }

    // Add filters to URL
    Object.entries(searchFilters).forEach(([key, value]) => {
      if (value && value !== '' && value !== null) {
        queryParams[key] = value
      } else {
        delete queryParams[key]
      }
    })

    // Update URL without triggering navigation
    router.replace({ query: queryParams })
  }

  // Initialize from URL parameters
  const initializeFromURL = () => {
    if (route.query.q || route.query.search) {
      query.value = route.query.q || route.query.search
    }

    // Load filters from URL
    Object.keys(filters.value).forEach(key => {
      if (route.query[key]) {
        if (key === 'foil' || key === 'signed' || key === 'altered') {
          filters.value[key] = route.query[key] === 'true'
        } else {
          filters.value[key] = route.query[key]
        }
      }
    })

    // Perform search if there are parameters
    if (query.value || hasActiveFilters.value) {
      performSearch()
    }
  }

  // Add to search history (localStorage)
  const addToSearchHistory = (searchQuery, searchFilters) => {
    if (!searchQuery) return

    const historyItem = {
      query: searchQuery,
      filters: searchFilters,
      timestamp: Date.now()
    }

    let history = []
    try {
      history = JSON.parse(localStorage.getItem('mtg-searchHistory') || '[]')
    } catch (err) {
      console.error('Error parsing search history:', err)
    }

    // Remove duplicate
    history = history.filter(item => item.query !== searchQuery)

    // Add to beginning
    history.unshift(historyItem)

    // Keep only last 20 searches
    history = history.slice(0, 20)

    try {
      localStorage.setItem('mtg-searchHistory', JSON.stringify(history))
    } catch (err) {
      console.error('Error saving search history:', err)
    }
  }

  // Pagination functions
  const nextPage = () => {
    currentPage.value++
    performSearch()
  }

  const previousPage = () => {
    if (currentPage.value > 1) {
      currentPage.value--
      performSearch()
    }
  }

  const goToPage = (page) => {
    currentPage.value = page
    performSearch()
  }

  // Watch for filter changes
  watch(filters, (newFilters) => {
    if (hasActiveFilters.value || query.value) {
      currentPage.value = 1
      debouncedSearch(query.value, newFilters)
    }
  }, { deep: true })

  return {
    // State
    query,
    filters,
    results,
    loading,
    error,
    currentPage,
    suggestions,
    showSuggestions,
    savedSearches,
    facets,

    // Computed
    hasResults,
    totalResults,
    hasActiveFilters,

    // Methods
    performSearch,
    debouncedSearch,
    getSuggestions,
    saveSearch,
    loadSavedSearches,
    executeSavedSearch,
    deleteSavedSearch,
    clearFilters,
    initializeFromURL,
    nextPage,
    previousPage,
    goToPage
  }
}