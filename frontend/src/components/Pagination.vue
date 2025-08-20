<template>
  <div class="flex justify-center items-center space-x-2">
    <!-- Previous Button -->
    <button 
      @click="$emit('page-change', currentPage - 1)" 
      :disabled="currentPage <= 1"
      class="px-3 py-2 rounded bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition-colors"
    >
      Previous
    </button>
    
    <!-- Page Numbers -->
    <div class="flex space-x-1">
      <button 
        v-for="page in visiblePages" 
        :key="page"
        @click="handlePageClick(page)"
        :disabled="page === '...'"
        :class="getPageButtonClass(page)"
        class="px-3 py-2 rounded transition-colors"
      >
        {{ page }}
      </button>
    </div>
    
    <!-- Next Button -->
    <button 
      @click="$emit('page-change', currentPage + 1)" 
      :disabled="currentPage >= totalPages"
      class="px-3 py-2 rounded bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition-colors"
    >
      Next
    </button>
  </div>
  
  <!-- Page Info -->
  <div v-if="showInfo" class="text-center text-sm text-gray-600 mt-2">
    Page {{ currentPage }} of {{ totalPages }} 
    <span v-if="totalItems">({{ totalItems }} total items)</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  currentPage: {
    type: Number,
    required: true,
    default: 1
  },
  totalPages: {
    type: Number,
    required: true,
    default: 1
  },
  totalItems: {
    type: Number,
    default: null
  },
  maxVisiblePages: {
    type: Number,
    default: 7
  },
  showInfo: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['page-change'])

const visiblePages = computed(() => {
  const { currentPage, totalPages, maxVisiblePages } = props
  
  if (totalPages <= maxVisiblePages) {
    // Show all pages if total is less than max visible
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  
  const pages = []
  const delta = Math.floor(maxVisiblePages / 2)
  
  // Always show first page
  if (currentPage > delta + 1) {
    pages.push(1)
    if (currentPage > delta + 2) {
      pages.push('...')
    }
  }
  
  // Calculate range around current page
  const start = Math.max(1, currentPage - delta)
  const end = Math.min(totalPages, currentPage + delta)
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  // Always show last page
  if (currentPage < totalPages - delta) {
    if (currentPage < totalPages - delta - 1) {
      pages.push('...')
    }
    pages.push(totalPages)
  }
  
  // Remove duplicates while preserving order
  return pages.filter((page, index) => pages.indexOf(page) === index)
})

const getPageButtonClass = (page) => {
  if (page === '...') {
    return 'text-gray-400 cursor-default'
  }
  
  if (page === props.currentPage) {
    return 'bg-blue-600 text-white'
  }
  
  return 'bg-gray-200 text-gray-700 hover:bg-gray-300'
}

const handlePageClick = (page) => {
  if (page !== '...' && page !== props.currentPage) {
    emit('page-change', page)
  }
}
</script>

<style scoped>
/* Additional styling if needed */
button:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

button:disabled {
  pointer-events: none;
}
</style>

