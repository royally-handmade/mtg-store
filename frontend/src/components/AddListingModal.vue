<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-full max-w-md">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold">Add Listing for {{ card.name }}</h2>
        <button @click="$emit('close')" class="text-gray-500 hover:text-gray-700">
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Price (CAD)</label>
          <input v-model="form.price" type="number" step="0.01" min="0" required 
            class="input-field" placeholder="0.00" />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Condition</label>
          <select v-model="form.condition" required class="input-field">
            <option value="">Select condition</option>
            <option value="nm">Near Mint</option>
            <option value="lp">Lightly Played</option>
            <option value="mp">Moderately Played</option>
            <option value="hp">Heavily Played</option>
            <option value="dmg">Damaged</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
          <input v-model="form.quantity" type="number" min="1" required 
            class="input-field" placeholder="1" />
        </div>

        <div class="bg-blue-50 border border-blue-200 rounded p-3">
          <p class="text-sm text-blue-800">
            Market price: ${{ card.market_price || '0.00' }} CAD
          </p>
        </div>

        <div class="flex space-x-4">
          <button type="button" @click="$emit('close')" 
            class="flex-1 btn-secondary">
            Cancel
          </button>
          <button type="submit" :disabled="loading" 
            class="flex-1 btn-primary disabled:opacity-50">
            {{ loading ? 'Adding...' : 'Add Listing' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'
import { useToast } from 'vue-toastification'
import api from '@/lib/api'

const props = defineProps({
  card: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'added'])
const toast = useToast()

const loading = ref(false)
const form = ref({
  price: '',
  condition: '',
  quantity: 1
})

const handleSubmit = async () => {
  loading.value = true
  try {
    await api.post('/seller/listings', {
      card_id: props.card.id,
      price: parseFloat(form.value.price),
      condition: form.value.condition,
      quantity: parseInt(form.value.quantity)
    })
    
    toast.success('Listing added successfully!')
    emit('added')
    emit('close')
  } catch (error) {
    toast.error('Error adding listing')
    console.error('Error adding listing:', error)
  } finally {
    loading.value = false
  }
}
</script>