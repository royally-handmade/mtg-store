<template>
  <div class="card-versions">
    <h3 class="text-lg sm:text-xl font-bold mb-4 sm:mb-6">Other Versions & Printings</h3>

    <!-- Loading State -->
    <div v-if="loading && !loadingMore" class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <!-- Desktop Table View (hidden on mobile) -->
    <div v-if="cardVersions.length > 0" class="hidden md:block overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
        <thead class="bg-gray-50">
          <tr>
            <th class="p-2 md:p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Set
            </th>
            <th class="p-2 md:p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Number
            </th>
            <th class="p-2 md:p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Price
            </th>
            <th class="p-2 md:p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Foil Price
            </th>
            <th class="p-2 md:p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Treatment
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="version in cardVersions" :key="version.id"
            class="hover:bg-gray-50 transition-colors cursor-pointer" :class="[
              'hover:bg-gray-50 transition-colors cursor-pointer',
              version.id === currentCardId
                ? 'bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
            ]" @click="navigateToVersion(version.id)">
            <td class="p-2 lg:px-4">
              <div class="flex items-center space-x-2">
                <div>
                  <div class="text-xs text-gray-900">
                    {{ version.set_number }}
                  </div>
                </div>
              </div>
            </td>

            <td class="px-2 lg:px-4 text-sm text-gray-900">
              <a :href="`/card/${version.id}`" class="hover:text-blue-600"><u>{{ version.card_number || '—' }}</u></a>
            </td>
            <td class="px-2 lg:px-4">
              <div class="text-sm">
                <div v-if="version.prices?.usd" class="text-gray-900">
                  ${{ parseFloat(version.prices.usd).toFixed(2) }}
                </div>
                <div v-else class="text-gray-400">
                  N/A
                </div>
              </div>
            </td>
            <td class="px-2 lg:px-4">
              <div v-if="version.prices?.usd_foil" class="px-2 text-sm">
                <span class="text-yellow-600">
                  ✶ ${{ version.prices.usd_foil.toFixed(2) }}
                </span>
              </div>
            </td>
            <td class="px-2 lg:px-4">
              <div class="flex flex-wrap gap-1">
                <!-- Card Treatment (foil, etched, etc.) -->
                <TreatmentBadge v-if="version.treatment && version.treatment !== 'foil'" :treatment="version.treatment"
                  condensed size="xs" />

                <!-- Border Treatment (borderless) -->
                <TreatmentBadge v-if="version.border_color === 'borderless'" treatment="borderless" condensed
                  size="xs" />

                <!-- Frame Effects (showcase, extended-art, etc.) -->
                <TreatmentBadge v-if="version.frame_effects" :treatment="version.frame_effects" condensed size="xs" />

                <!-- Promo Types -->
                <TreatmentBadge v-if="version.promo_types && version.promo_types !== 'universesbeyond'"
                  :treatment="version.promo_types" condensed size="xs" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile Card View (shown only on mobile) -->
    <div v-if="cardVersions.length > 0" class="md:hidden">
      <div v-for="version in cardVersions" :key="version.id" :class="[
        'bg-white border px-2 py-1 transition-all cursor-pointer',
        version.id === currentCardId
          ? 'bg-blue-50'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
      ]" @click="navigateToVersion(version.id)">
        <!-- Compact header with set info and price -->
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center space-x-2 flex-1 min-w-0">
            <img v-if="version.set_icon_svg_uri" :src="version.set_icon_svg_uri" :alt="version.set_name"
              class="h-4 w-4 flex-shrink-0" />
            <p class="text-xs font-semibold text-gray-900 truncate">
              {{ version.set_number }}
            </p>
            <div class="min-w-0 flex-1">

              <p class="text-xs text-gray-500">
                #{{ version.card_number }}
              </p>

            </div>
            <div
              v-if="version.treatment || version.border_color === 'borderless' || version.frame_effects || version.promo_types"
              class="flex flex-wrap gap-1">
              <TreatmentBadge v-if="version.treatment && version.treatment !== 'foil'" :treatment="version.treatment"
                condensed size="xs" />
              <TreatmentBadge v-if="version.border_color === 'borderless'" treatment="borderless" condensed size="xs" />
              <TreatmentBadge v-if="version.frame_effects" :treatment="version.frame_effects" condensed size="xs" />
              <TreatmentBadge v-if="version.promo_types && version.promo_types !== 'universesbeyond'"
                :treatment="version.promo_types" condensed size="xs" />
            </div>
            <span :class="getRarityClass(version.rarity)"
              class="inline-flex px-1.5 py-0.5 text-xs font-semibold rounded capitalize">
              {{ version.rarity.replace('_', ' ') }}
            </span>
          </div>
          <div class="text-right flex-shrink-0 ml-2">
            <p class="text-sm font-semibold text-gray-900">
              <span v-if="version.prices?.usd">
                ${{ parseFloat(version.prices.usd).toFixed(2) }}
              </span>
              <span v-else class="text-gray-400 text-xs">$---</span>
            </p>

          </div>
        </div>

        <!-- Treatments (if any) -->

      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!loading" class="text-center py-8 text-gray-500">
      No other versions found
    </div>

    <!-- Load More Button -->
    <div v-if="hasMoreVersions && !loading" class="mt-6 text-center">
      <button @click="loadMoreVersions" :disabled="loadingMore"
        class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium">
        {{ loadingMore ? 'Loading...' : 'Load More' }}
      </button>
    </div>

    <!-- Loading More Indicator -->
    <div v-if="loadingMore" class="flex justify-center py-4">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
    </div>
  </div>
</template>

<script setup>
  import { ref, watch, onMounted } from 'vue'
  import { useRouter } from 'vue-router'
  import api from '@/lib/api'
  import TreatmentBadge from './TreatmentBadge.vue'

  const props = defineProps({
    oracleId: {
      type: String,
      required: true
    },
    currentCardId: {
      type: String,
      required: false
    }
  })

  const router = useRouter()

  const cardVersions = ref([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const hasMoreVersions = ref(false)
  const currentPage = ref(1)
  const totalVersions = ref(0)

  const fetchCardVersions = async (page = 1, append = false) => {
    if (page === 1) {
      loading.value = true
    } else {
      loadingMore.value = true
    }

    try {
      const response = await api.get(`/cards/versions/${props.oracleId}`, {
        params: {
          page,
          limit: 10
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

  const loadMoreVersions = () => {
    if (!hasMoreVersions.value || loadingMore.value) return
    fetchCardVersions(currentPage.value + 1, true)
  }

  const navigateToVersion = (cardId) => {
    router.push(`/card/${cardId}`)
  }

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

  /* Custom styles for better mobile experience */
  @media (max-width: 768px) {

    /* Ensure touch targets are adequate */
    button {
      min-height: 44px;
    }

    /* Smooth scrolling for card list */
    .space-y-3 {
      -webkit-overflow-scrolling: touch;
    }
  }

  /* Table hover effects */
  tbody tr:hover {
    background-color: rgb(249 250 251);
  }

  /* Loading spinner animation */
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }
</style>