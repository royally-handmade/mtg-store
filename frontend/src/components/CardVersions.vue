<template>
  <div class="bg-white rounded-lg shadow p-6">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold">Other Printings</h2>
      <span v-if="loading" class="text-sm text-gray-500">Loading...</span>
      <span v-else-if="cardVersions.length > 0" class="text-sm text-gray-500">
        {{ cardVersions.length }} printing{{ cardVersions.length !== 1 ? 's' : '' }} found
      </span>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <!-- No Other Versions -->
    <div v-else-if="cardVersions.length === 0" class="text-center py-8 text-gray-500">
      <p>No other printings of this card are available in our database.</p>
    </div>

    <!-- Card Versions Table -->
    <div v-else class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Set
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Card #
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rarity
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Treatment
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Market Price
            </th>

          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr 
            v-for="version in cardVersions" 
            :key="version.id"
            class="hover:bg-gray-50 transition-colors"
          >
            <!-- Set Information -->
            <td class="px-6 whitespace-nowrap">
              <div>
                <div class="text-sm text-gray-900 font-medium">
                  {{ version.set_number?.toUpperCase() }}
                </div>
              </div>
            </td>

            <!-- Card Number -->
            <td class="px-6 whitespace-nowrap">
              <span class="text-sm font-mono text-gray-900">
                <a :href="`/card/${version.id}`" class="hover:text-blue-600"><u>{{ version.card_number || '—' }}</u></a>
              </span>
            </td>

            <!-- Rarity -->
            <td class="px-6 whitespace-nowrap">
              <span :class="getRarityClass(version.rarity)" class="inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize">
                {{ version.rarity?.replace('_', ' ') }}
              </span>
            </td>

            <!-- Treatment & Foil -->
            <td class="px-6 whitespace-nowrap">
              <div class="flex flex-col space-y-1">
                <!-- Treatment -->
                <span v-if="version.treatment && version.treatment !== 'normal'" 
                      class="inline-flex px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800 capitalize">
                  {{ version.treatment.replace('_', ' ') }}
                </span>
                
                <!-- Foil Availability -->
                <div class="flex items-center space-x-2">
                  <div v-if="version.has_normal" class="flex items-center space-x-1">
                    <div class="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span class="text-xs text-gray-600">Normal</span>
                  </div>
                  <div v-if="version.has_foil" class="flex items-center space-x-1">
                    <svg class="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span class="text-xs text-yellow-600">Foil</span>
                  </div>
                </div>
              </div>
            </td>

            <!-- Market Price -->
            <td class="px-6 whitespace-nowrap">
              <div class="space-y-1">
                <!-- Normal Price -->
                <div v-if="version.market_price" class="text-sm">
                  <span class="font-semibold text-green-600">
                    ${{ version.market_price.toFixed(2) }}
                  </span>
                  <span class="text-xs text-gray-500 ml-1">CAD</span>
                </div>
                
                <!-- Foil Price -->
                <div v-if="version.foil_market_price" class="text-sm">
                  <div class="flex items-center space-x-1">
                    <svg class="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span class="font-semibold text-yellow-600">
                      ${{ version.foil_market_price.toFixed(2) }}
                    </span>
                  </div>
                </div>

                <!-- No Price Available -->
                <div v-if="!version.market_price && !version.foil_market_price" class="text-sm text-gray-400">
                  No price data
                </div>
              </div>
            </td>

          </tr>
        </tbody>
      </table>
    </div>

    <!-- Load More Button (if pagination is needed) -->
    <div v-if="hasMoreVersions && !loading" class="text-center mt-6 pt-4 border-t border-gray-200">
      <button 
        @click="loadMoreVersions"
        :disabled="loadingMore"
        class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <svg v-if="loadingMore" class="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span v-if="loadingMore">Loading...</span>
        <span v-else>Load More Printings</span>
      </button>
    </div>

    <!-- Summary Footer -->
    <div v-if="cardVersions.length > 0" class="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
      <div class="flex justify-between items-center">
        <span>
          Showing {{ cardVersions.length }} of {{ totalVersions || cardVersions.length }} total printings
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/lib/api'

const props = defineProps({
  oracleId: {
    type: String,
    required: true
  },
  currentCardId: {
    type: [String, Number],
    required: true
  }
})

const router = useRouter()
const cardVersions = ref([])
const loading = ref(true)
const loadingMore = ref(false)
const hasMoreVersions = ref(false)
const currentPage = ref(1)
const totalVersions = ref(0)
const pageSize = 15

// Fetch card versions based on oracle_id
const fetchCardVersions = async (page = 1, append = false) => {
  try {
    if (page === 1) loading.value = true
    else loadingMore.value = true

    const response = await api.get(`/cards/versions/${props.oracleId}`, {
      params: {
        page,
        limit: pageSize,
        exclude_card_id: props.currentCardId
      }
    })

    const { data, pagination, meta } = response.data

    if (append) {
      cardVersions.value.push(...data)
    } else {
      cardVersions.value = data
    }

    hasMoreVersions.value = pagination.page < pagination.totalPages
    currentPage.value = pagination.page
    totalVersions.value = meta.total_versions

  } catch (error) {
    console.error('Error fetching card versions:', error)
    cardVersions.value = []
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

// Load more versions for pagination
const loadMoreVersions = () => {
  if (!hasMoreVersions.value || loadingMore.value) return
  fetchCardVersions(currentPage.value + 1, true)
}

// Navigate to a specific card version

// Get rarity-specific CSS classes
const getRarityClass = (rarity) => {
  const rarityClasses = {
    common: 'bg-gray-100 text-gray-800',
    uncommon: 'bg-green-100 text-green-800',
    rare: 'bg-yellow-100 text-yellow-800',
    mythic: 'bg-red-100 text-red-800',
    mythic_rare: 'bg-red-100 text-red-800',
    special: 'bg-purple-100 text-purple-800'
  }
  return rarityClasses[rarity] || 'bg-gray-100 text-gray-800'
}

// Watch for oracle_id changes
watch(() => props.oracleId, (newOracleId) => {
  if (newOracleId) {
    currentPage.value = 1
    fetchCardVersions()
  }
}, { immediate: true })

onMounted(() => {
  if (props.oracleId) {
    fetchCardVersions()
  }
})
</script>

<style scoped>
/* Custom styles for the table */
table {
  border-collapse: separate;
  border-spacing: 0;
}

th:first-child {
  border-top-left-radius: 0.375rem;
}

th:last-child {
  border-top-right-radius: 0.375rem;
}

/* Hover effect for table rows */
tbody tr:hover {
  background-color: rgb(249 250 251);
}

/* Responsive table on smaller screens */
@media (max-width: 768px) {
  .overflow-x-auto {
    -webkit-overflow-scrolling: touch;
  }
  
  th, td {
    padding: 0.75rem 0.5rem;
    font-size: 0.875rem;
  }
}
</style>