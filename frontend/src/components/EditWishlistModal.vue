<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-full max-w-md">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold">Edit Wishlist Item</h2>
        <button @click="$emit('close')" class="text-gray-500 hover:text-gray-700">
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>

      <div class="mb-6">
        <div class="flex items-center space-x-3">
          <img :src="item.cards.image_url" :alt="item.cards.name" 
            class="w-12 h-16 object-cover rounded" />
          <div>
            <h3 class="font-semibold">{{ item.cards.name }}</h3>
            <p class="text-sm text-gray-600">{{ item.cards.set_number }}</p>
            <p class="text-sm text-green-600">Market: ${{ item.cards.market_price }} CAD</p>
          </div>
        </div>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Maximum Price (CAD)
          </label>
          <input 
            v-model="form.max_price" 
            type="number" 
            step="0.01" 
            min="0"
            class="input-field" 
            placeholder="0.00"
          />
          <p class="text-xs text-gray-500 mt-1">
            Get notified when the price drops below this amount
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Preferred Condition
          </label>
          <select v-model="form.condition_preference" class="input-field">
            <option value="">No preference</option>
            <option value="nm">Near Mint</option>
            <option value="lp">Lightly Played</option>
            <option value="mp">Moderately Played</option>
            <option value="hp">Heavily Played</option>
            <option value="dmg">Damaged</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea 
            v-model="form.notes"
            rows="3"
            class="input-field"
            placeholder="Personal notes about this card..."
            maxlength="500"
          ></textarea>
          <p class="text-xs text-gray-500 mt-1">
            {{ form.notes.length }}/500 characters
          </p>
        </div>

        <div class="flex space-x-4">
          <button type="button" @click="$emit('close')" 
            class="flex-1 btn-secondary">
            Cancel
          </button>
          <button type="submit" :disabled="loading" 
            class="flex-1 btn-primary disabled:opacity-50">
            {{ loading ? 'Updating...' : 'Update' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  item: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'update'])

const loading = ref(false)
const form = ref({
  max_price: '',
  condition_preference: '',
  notes: ''
})

const handleSubmit = async () => {
  loading.value = true
  try {
    const updates = {}
    
    if (form.value.max_price !== '') {
      updates.max_price = parseFloat(form.value.max_price) || null
    } else {
      updates.max_price = null
    }
    
    if (form.value.condition_preference !== props.item.condition_preference) {
      updates.condition_preference = form.value.condition_preference || null
    }
    
    if (form.value.notes !== props.item.notes) {
      updates.notes = form.value.notes.trim()
    }
    
    emit('update', updates)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  form.value = {
    max_price: props.item.max_price || '',
    condition_preference: props.item.condition_preference || '',
    notes: props.item.notes || ''
  }
})
</script>