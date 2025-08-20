<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-full max-w-md">
      <div class="flex items-center space-x-3 mb-4">
        <ExclamationTriangleIcon class="h-8 w-8 text-yellow-500" />
        <h2 class="text-xl font-bold text-gray-900">{{ title }}</h2>
      </div>
      
      <p class="text-gray-600 mb-6">{{ message }}</p>
      
      <div class="flex space-x-3">
        <button
          @click="$emit('cancel')"
          class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {{ cancelText }}
        </button>
        <button
          @click="$emit('confirm')"
          :class="[
            'flex-1 px-4 py-2 text-white rounded-lg transition-colors',
            confirmClass
          ]"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline'

defineProps({
  title: {
    type: String,
    default: 'Confirm Action'
  },
  message: {
    type: String,
    required: true
  },
  confirmText: {
    type: String,
    default: 'Confirm'
  },
  cancelText: {
    type: String,
    default: 'Cancel'
  },
  confirmClass: {
    type: String,
    default: 'bg-blue-600 hover:bg-blue-700'
  }
})

defineEmits(['confirm', 'cancel'])
</script>