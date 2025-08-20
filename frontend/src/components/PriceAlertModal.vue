<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-full max-w-md">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold">Set Price Alert</h2>
        <button @click="$emit('close')" class="text-gray-500 hover:text-gray-700">
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>

      <div class="space-y-4">
        <!-- Card Info -->
        <div v-if="card" class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <img :src="card.cards.image_url" :alt="card.cards.name" 
            class="w-12 h-16 object-cover rounded" />
          <div>
            <div class="font-medium">{{ card.cards.name }}</div>
            <div class="text-sm text-gray-600">Current: ${{ card.cards.market_price }} CAD</div>
          </div>
        </div>

        <!-- Price Input -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Alert me when price drops to or below:
          </label>
          <div class="relative">
            <input
              v-model.number="maxPrice"
              type="number"
              step="0.01"
              min="0"
              :max="card?.cards.market_price"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
            <span class="absolute right-3 top-2 text-gray-500">CAD</span>
          </div>
          <p class="text-xs text-gray-500 mt-1">
            Set a price below the current market price to get notified of drops
          </p>
        </div>

        <!-- Condition Preference -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Condition Preference (Optional)
          </label>
          <select v-model="conditionPreference" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Any condition</option>
            <option value="nm">Near Mint or better</option>
            <option value="lp">Lightly Played or better</option>
            <option value="mp">Moderately Played or better</option>
            <option value="hp">Heavily Played or better</option>
          </select>
        </div>

        <!-- Actions -->
        <div class="flex space-x-3 pt-4">
          <button
            @click="$emit('close')"
            class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="handleSave"
            :disabled="!isValidPrice"
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Set Alert
          </button>
          <button
            v-if="currentMaxPrice"
            @click="removeAlert"
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  card: {
    type: Object,
    required: true
  },
  currentMaxPrice: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['save', 'close', 'remove'])

const maxPrice = ref(props.currentMaxPrice || '')
const conditionPreference = ref('')

const isValidPrice = computed(() => {
  return maxPrice.value && maxPrice.value > 0 && maxPrice.value <= parseFloat(props.card.cards.market_price)
})

const handleSave = () => {
  if (isValidPrice.value) {
    emit('save', maxPrice.value, conditionPreference.value)
  }
}

const removeAlert = () => {
  emit('remove')
}

// Watch for prop changes
watch(() => props.currentMaxPrice, (newValue) => {
  maxPrice.value = newValue || ''
}, { immediate: true })
</script>