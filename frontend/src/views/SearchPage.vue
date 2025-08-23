<template>
  <div class="max-w-6xl mx-auto p-6">
    <div class="mb-8">
      <EnhancedSearchBar 
        @search="handleSearch"
        @filter-change="handleFilterChange"
      />
      
      <div class="mt-4 flex justify-center">
        <button
          @click="showAdvanced = true"
          class="text-blue-600 hover:text-blue-700 text-sm flex items-center space-x-1"
        >
          <AdjustmentsHorizontalIcon class="h-4 w-4" />
          <span>Advanced Search</span>
        </button>
      </div>
    </div>

    <!-- Search Results Summary -->
    <div v-if="hasResults" class="mb-4 text-sm text-gray-600">
      {{ totalResults }} results found
      <span v-if="query">for "{{ query }}"</span>
    </div>

    <!-- Search Results -->
    <SearchResults 
      v-if="results"
      :results="results"
      :loading="loading"
      @load-more="nextPage"
    />

    <!-- Loading State -->
    <div v-if="loading && !results" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="text-center py-12">
      <div class="text-red-600 mb-4">{{ error }}</div>
      <button
        @click="performSearch"
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Try Again
      </button>
    </div>

    <!-- Advanced Search Modal -->
    <AdvancedSearchModal
      :is-open="showAdvanced"
      @close="showAdvanced = false"
      @search="handleAdvancedSearch"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useSearch } from '@/composables/useSearch'
import { AdjustmentsHorizontalIcon } from '@heroicons/vue/24/outline'
import EnhancedSearchBar from '@/components/search/EnhancedSearchBar.vue'
import SearchResults from '@/components/search/SearchResults.vue'
import AdvancedSearchModal from '@/components/search/AdvancedSearchModal.vue'

const {
  query,
  results,
  loading,
  error,
  hasResults,
  totalResults,
  performSearch,
  nextPage,
  initializeFromURL
} = useSearch()

const showAdvanced = ref(false)

const handleSearch = (searchQuery, searchFilters) => {
  query.value = searchQuery
  performSearch(searchQuery, searchFilters)
}

const handleFilterChange = (newFilters) => {
  // Filters are already being watched in the composable
}

const handleAdvancedSearch = (advancedFilters) => {
  // Handle advanced search
  console.log('Advanced search:', advancedFilters)
}

onMounted(() => {
  initializeFromURL()
})
</script>