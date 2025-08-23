<template>
  <EnhancedSearchBarComponent 
    :saved-searches="savedSearches"
    @search="handleSearch"
    @filter-change="handleFilterChange"
  />
</template>

<script setup>
import { onMounted } from 'vue'
import { useSearch } from '@/composables/useSearch'
import EnhancedSearchBarComponent from './EnhancedSearchBarComponent.vue'

const {
  query,
  filters,
  savedSearches,
  performSearch,
  loadSavedSearches
} = useSearch()

const emit = defineEmits(['search', 'filter-change'])

const handleSearch = (searchQuery, searchFilters) => {
  performSearch(searchQuery, searchFilters)
  emit('search', searchQuery, searchFilters)
}

const handleFilterChange = (newFilters) => {
  emit('filter-change', newFilters)
}

onMounted(() => {
  loadSavedSearches()
})
</script>