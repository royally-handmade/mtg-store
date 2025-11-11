<!-- ScryfallAdmin.vue -->
<template>
  <div class="scryfall-admin p-6">
    <div class="header mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Scryfall Integration</h1>
      <p class="text-gray-600">Import and manage card data from Scryfall API</p>
    </div>

    <!-- Tab Navigation -->
    <div class="tab-nav mb-6">
      <nav class="flex space-x-8 border-b border-gray-200">
        <button v-for="tab in tabs" :key="tab.id" @click="activeTab = tab.id" :class="[
          'py-2 px-1 border-b-2 font-medium text-sm',
          activeTab === tab.id
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        ]">
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Single Card Import -->
    <div v-if="activeTab === 'single'" class="space-y-6">
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold mb-4">Import Single Card</h2>

        <form @submit.prevent="importSingleCard" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Card Name *
              </label>
              <input v-model="singleCard.name" type="text" required
                class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Lightning Bolt">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Set Code (Optional)
              </label>
              <input v-model="singleCard.set_code" type="text"
                class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="lea">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Collector Number (Optional)
              </label>
              <input v-model="singleCard.card_num" type="text"
                class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="lea">
            </div>
          </div>

          <button type="submit" :disabled="importing.single"
            class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            <span v-if="importing.single">Importing...</span>
            <span v-else>Import Card</span>
          </button>
        </form>

        <!-- Import Result -->
        <div v-if="importResults.single" class="mt-4 p-4 rounded-md"
          :class="importResults.single.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'">
          <div class="flex">
            <div class="flex-shrink-0">
              <CheckCircleIcon v-if="importResults.single.success" class="h-5 w-5 text-green-400" />
              <XCircleIcon v-else class="h-5 w-5 text-red-400" />
            </div>
            <div class="ml-3">
              <p class="text-sm font-medium" :class="importResults.single.success ? 'text-green-800' : 'text-red-800'">
                {{ importResults.single.message }}
              </p>
              <div v-if="importResults.single.card" class="mt-2">
                <div class="flex items-center space-x-3">
                  <img :src="importResults.single.card.image_url_small" :alt="importResults.single.card.name"
                    class="w-16 rounded-md" @click="$router.push(`/card/${importResults.single.card.id}`)">
                  <div>
                    <p class="font-medium">{{ importResults.single.card.name }}</p>
                    <p class="text-sm text-gray-600">{{ importResults.single.card.set_name }} ({{
                      importResults.single.card.set_number?.toUpperCase() }})</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Set Import -->
    <div v-if="activeTab === 'sets'" class="space-y-6">
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold mb-4">Import Complete Set</h2>

        <!-- Set Selection -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Select Set to Import
          </label>
          <div class="relative">
            <select v-model="selectedSet"
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Choose a set...</option>
              <option v-for="set in availableSets" :key="set.code" :value="set.code">
                {{ set.name }} ({{ set.code.toUpperCase() }}) - {{ set.card_count }} cards
                <span v-if="set.is_fully_imported"> ✓ Imported</span>
                <span v-else-if="set.imported_count > 0"> ({{ set.import_percentage }}% imported)</span>
              </option>
            </select>
          </div>
        </div>

        <!-- Selected Set Info -->
        <div v-if="selectedSetInfo" class="mb-6 p-4 bg-gray-50 rounded-md">
          <div class="flex items-center space-x-4">
            <img v-if="selectedSetInfo.icon_svg_uri" :src="selectedSetInfo.icon_svg_uri" :alt="selectedSetInfo.name"
              class="w-8 h-8">
            <div>
              <h3 class="font-medium">{{ selectedSetInfo.name }}</h3>
              <p class="text-sm text-gray-600">
                Released: {{ formatDate(selectedSetInfo.released_at) }} |
                {{ selectedSetInfo.card_count }} cards |
                {{ selectedSetInfo.imported_count }}/{{ selectedSetInfo.card_count }} imported ({{
                  selectedSetInfo.import_percentage }}%)
              </p>
            </div>
          </div>
        </div>

        <button @click="importSet" :disabled="!selectedSet || importing.set"
          class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
          <span v-if="importing.set">Importing Set...</span>
          <span v-else>Import Set</span>
        </button>

        <!-- Set Import Progress -->
        <div v-if="setImportProgress" class="mt-6">
          <div class="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h4 class="font-medium text-blue-900">Import Progress</h4>
            <div class="mt-2">
              <div class="bg-blue-200 rounded-full h-2">
                <div class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  :style="{ width: setImportProgress.percentage + '%' }"></div>
              </div>
              <div class="mt-2 text-sm text-blue-800">
                {{ setImportProgress.imported }} imported, {{ setImportProgress.errors }} errors
              </div>
            </div>
            <div class="mt-3 max-h-40 overflow-y-auto text-xs font-mono bg-white p-2 rounded border">
              <div v-for="log in setImportProgress.logs" :key="log.id" class="text-gray-700">
                {{ log.message }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Search & Preview -->
    <div v-if="activeTab === 'search'" class="space-y-6">
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold mb-4">Search Scryfall</h2>

        <!-- Search Form -->
        <div class="mb-6">
          <div class="flex space-x-4">
            <div class="flex-1">
              <input v-model="searchQuery" @keyup.enter="searchScryfall" type="text"
                placeholder="Search for cards... (e.g., 'Lightning Bolt', 'set:lea', 'cmc:1')"
                class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <button @click="searchScryfall" :disabled="!searchQuery || searching"
              class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50">
              <span v-if="searching">Searching...</span>
              <span v-else>Search</span>
            </button>
          </div>
        </div>

        <!-- Search Results -->
        <div v-if="searchResults.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="card in searchResults" :key="card.scryfall_id"
            class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div class="flex space-x-3">
              <img :src="card.image_url" :alt="card.name" class="w-16 rounded-md object-cover">
              <div class="flex-1 min-w-0">
                <h3 class="font-medium text-gray-900 truncate">{{ card.name }}</h3>
                <p class="text-sm text-gray-600">{{ card.set_name }} ({{ card.set?.toUpperCase() }})</p>
                <p class="text-sm text-gray-500 capitalize">{{ card.rarity }}</p>

                <div class="mt-2 flex items-center justify-between">
                  <div class="text-sm">
                    <span v-if="card.prices?.usd" class="text-green-600">${{ card.prices.usd }}</span>
                    <span v-else class="text-gray-400">No price</span>
                  </div>

                  <div class="flex items-center space-x-2">
                    <span v-if="card.is_imported"
                      class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ✓ Imported
                    </span>
                    <button @click="importCardFromSearch(card)" :disabled="card.is_imported || importing.search"
                      class="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50">
                      Import
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bulk Import -->
    <div v-if="activeTab === 'bulk'" class="space-y-6">
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold mb-4">Bulk Import</h2>
        <div class="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
          <div class="flex">
            <ExclamationTriangleIcon class="h-5 w-5 text-yellow-400 mt-0.5" />
            <div class="ml-3">
              <h3 class="text-sm font-medium text-yellow-800">Warning</h3>
              <p class="text-sm text-yellow-700 mt-1">
                Bulk import will download and process all Magic cards from Scryfall.
                This process can take 30+ minutes and will import 80,000+ cards.
              </p>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Import Type
            </label>
            <select v-model="bulkImportType"
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="default_cards">Default Cards (recommended)</option>
              <option value="oracle_cards">Oracle Cards</option>
              <option value="unique_artwork">Unique Artwork</option>
              <option value="all_cards">All Cards (includes tokens)</option>
            </select>
          </div>

          <button @click="startBulkImport" :disabled="importing.bulk"
            class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50">
            <span v-if="importing.bulk">Importing...</span>
            <span v-else>Start Bulk Import</span>
          </button>
        </div>

        <!-- Bulk Import Progress -->
        <div v-if="bulkImportProgress" class="mt-6">
          <div class="bg-gray-50 border border-gray-200 rounded-md p-4">
            <h4 class="font-medium text-gray-900">Bulk Import Progress</h4>
            <div class="mt-2 space-y-2">
              <div class="text-sm">
                Processed: {{ bulkImportProgress.processed?.toLocaleString() || 0 }} |
                Imported: {{ bulkImportProgress.imported?.toLocaleString() || 0 }} |
                Errors: {{ bulkImportProgress.errors?.toLocaleString() || 0 }}
              </div>
              <div class="max-h-40 overflow-y-auto text-xs font-mono bg-white p-2 rounded border">
                <div v-for="log in bulkImportProgress.logs" :key="log.id" class="text-gray-700">
                  {{ log.message }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
  import { ref, computed, onMounted } from 'vue'
  import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline'
  import api from '@/lib/api'

  export default {
    name: 'ScryfallAdmin',
    components: {
      CheckCircleIcon,
      XCircleIcon,
      ExclamationTriangleIcon
    },
    setup() {
      const activeTab = ref('single')
      const tabs = [
        { id: 'single', label: 'Single Card' },
        { id: 'sets', label: 'Set Import' },
        { id: 'search', label: 'Search & Preview' },
        { id: 'bulk', label: 'Bulk Import' }
      ]

      // Single card import
      const singleCard = ref({ name: '', set_code: '', card_num: '' })
      const importing = ref({
        single: false,
        set: false,
        search: false,
        bulk: false
      })
      const importResults = ref({ single: null })

      // Set import
      const availableSets = ref([])
      const selectedSet = ref('')
      const setImportProgress = ref(null)

      // Search
      const searchQuery = ref('')
      const searchResults = ref([])
      const searching = ref(false)

      // Bulk import
      const bulkImportType = ref('default_cards')
      const bulkImportProgress = ref(null)

      const selectedSetInfo = computed(() => {
        return availableSets.value.find(set => set.code === selectedSet.value)
      })

      // Methods
      const importSingleCard = async () => {
        importing.value.single = true
        importResults.value.single = null

        try {
          const response = await api.post('/scryfall/import-card', {
            name: singleCard.value.name,
            set_code: singleCard.value.set_code || undefined,
            card_num: singleCard.value.card_num || undefined
          })

          importResults.value.single = {
            success: true,
            message: response.data.message,
            card: response.data.card
          }

          // Clear form
          singleCard.value = { name: '', set_code: '' }
        } catch (error) {
          importResults.value.single = {
            success: false,
            message: error.response?.data?.error || 'Import failed'
          }
        } finally {
          importing.value.single = false
        }
      }

      const loadAvailableSets = async () => {
        try {
          const response = await api.get('/scryfall/sets')
          availableSets.value = response.data
        } catch (error) {
          console.error('Error loading sets:', error)
        }
      }

      const importSet = async () => {
        if (!selectedSet.value) return

        importing.value.set = true
        setImportProgress.value = {
          imported: 0,
          errors: 0,
          percentage: 0,
          logs: []
        }

        try {
          const response = await api.post(`/scryfall/import-set`, {
            set_code: selectedSet.value
          }, {
            responseType: 'stream',
            adapter: 'fetch'
          })

          const reader = response.data.getReader()
          const decoder = new TextDecoder()

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value)
            const lines = chunk.split('\n').filter(line => line.trim())

            for (const line of lines) {
              try {
                const data = JSON.parse(line)

                if (data.type === 'start') {
                  setImportProgress.value.logs.push({
                    id: Date.now(),
                    message: `Starting import of ${data.set} (${data.card_count} cards)`
                  })
                } else if (data.type === 'progress') {
                  setImportProgress.value.imported = data.imported
                  setImportProgress.value.errors = data.errors
                  setImportProgress.value.logs.push({
                    id: Date.now(),
                    message: `Page ${data.page}: ${data.current_batch} cards processed`
                  })
                } else if (data.type === 'complete') {
                  setImportProgress.value.logs.push({
                    id: Date.now(),
                    message: `Import complete: ${data.imported} imported, ${data.errors} errors`
                  })
                  // Reload sets to update import status
                  await loadAvailableSets()
                } else if (data.type === 'error') {
                  setImportProgress.value.logs.push({
                    id: Date.now(),
                    message: `Error: ${data.error}`
                  })
                }
              } catch (parseError) {
                console.error('Error parsing response:', parseError)
              }
            }
          }
        } catch (error) {
          console.error('Error importing set:', error)
        } finally {
          importing.value.set = false
        }
      }

      const searchScryfall = async () => {
        if (!searchQuery.value.trim()) return

        searching.value = true
        try {
          const response = await api.get('/scryfall/search', {
            params: { q: searchQuery.value }
          })
          searchResults.value = response.data.cards || []
        } catch (error) {
          console.error('Error searching:', error)
          searchResults.value = []
        } finally {
          searching.value = false
        }
      }

      const importCardFromSearch = async (card) => {
        importing.value.search = true
        try {
          await api.post('/scryfall/import-card', {
            name: card.name,
            set_code: card.set
          })

          // Update the card's import status
          card.is_imported = true
        } catch (error) {
          console.error('Error importing card:', error)
        } finally {
          importing.value.search = false
        }
      }

      const startBulkImport = async () => {
        if (!confirm('This will import all Magic cards from Scryfall. This process can take 30+ minutes. Continue?')) {
          return
        }

        importing.value.bulk = true
        bulkImportProgress.value = {
          processed: 0,
          imported: 0,
          errors: 0,
          logs: []
        }

        try {
          const response = await api.post(`/scryfall/bulk-import`, {
            type: bulkImportType.value,
            batch_size: 1000
          })

          const reader = response.body.getReader()
          const decoder = new TextDecoder()

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value)
            const lines = chunk.split('\n').filter(line => line.trim())

            for (const line of lines) {
              try {
                const data = JSON.parse(line)

                if (data.type === 'start') {
                  bulkImportProgress.value.logs.push({
                    id: Date.now(),
                    message: data.message
                  })
                } else if (data.type === 'info') {
                  bulkImportProgress.value.logs.push({
                    id: Date.now(),
                    message: data.message
                  })
                } else if (data.type === 'progress') {
                  bulkImportProgress.value.processed = data.processed
                  bulkImportProgress.value.imported = data.imported
                  bulkImportProgress.value.errors = data.errors
                  bulkImportProgress.value.logs.push({
                    id: Date.now(),
                    message: `Processed: ${data.processed.toLocaleString()}, Imported: ${data.imported.toLocaleString()}, Errors: ${data.errors.toLocaleString()}`
                  })
                } else if (data.type === 'complete') {
                  bulkImportProgress.value.logs.push({
                    id: Date.now(),
                    message: `Bulk import complete! Processed: ${data.total_processed.toLocaleString()}, Imported: ${data.total_imported.toLocaleString()}, Errors: ${data.total_errors.toLocaleString()}`
                  })
                } else if (data.type === 'error') {
                  bulkImportProgress.value.logs.push({
                    id: Date.now(),
                    message: `Error: ${data.error}`
                  })
                }

                // Keep only last 50 log entries to prevent memory issues
                if (bulkImportProgress.value.logs.length > 50) {
                  bulkImportProgress.value.logs = bulkImportProgress.value.logs.slice(-50)
                }
              } catch (parseError) {
                console.error('Error parsing response:', parseError)
              }
            }
          }
        } catch (error) {
          console.error('Error in bulk import:', error)
        } finally {
          importing.value.bulk = false
        }
      }

      const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString()
      }

      // Load data on component mount
      onMounted(() => {
        loadAvailableSets()
      })

      return {
        // Data
        activeTab,
        tabs,
        singleCard,
        importing,
        importResults,
        availableSets,
        selectedSet,
        selectedSetInfo,
        setImportProgress,
        searchQuery,
        searchResults,
        searching,
        bulkImportType,
        bulkImportProgress,

        // Methods
        importSingleCard,
        loadAvailableSets,
        importSet,
        searchScryfall,
        importCardFromSearch,
        startBulkImport,
        formatDate
      }
    }
  }
</script>

<style scoped>
  .scryfall-admin {
    max-width: 1200px;
    margin: 0 auto;
  }

  .tab-nav button {
    transition: all 0.2s ease;
  }

  .grid>div {
    transition: all 0.2s ease;
  }

  .grid>div:hover {
    transform: translateY(-1px);
  }
</style>