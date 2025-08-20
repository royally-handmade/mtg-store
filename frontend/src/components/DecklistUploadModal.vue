<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-full max-w-lg">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold">Upload Decklist</h2>
        <button @click="$emit('close')" class="text-gray-500 hover:text-gray-700">
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>

      <div class="space-y-6">
        <!-- Text Input -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Paste Decklist
          </label>
          <textarea v-model="decklistText" rows="12" 
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="4 Lightning Bolt
3 Counterspell
2 Snapcaster Mage
..."></textarea>
        </div>

        <!-- File Upload Alternative -->
        <div class="text-center">
          <span class="text-gray-500">or</span>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Upload File
          </label>
          <div class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
            <input ref="fileInput" type="file" accept=".txt,.dec" @change="handleFileUpload" 
              class="hidden" />
            <button @click="$refs.fileInput.click()" type="button"
              class="text-blue-600 hover:text-blue-800">
              Choose decklist file (.txt, .dec)
            </button>
          </div>
        </div>

        <!-- Format Help -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 class="font-medium text-blue-900 mb-2">Supported Formats:</h3>
          <ul class="text-sm text-blue-800 space-y-1">
            <li>• MTG Arena export format</li>
            <li>• MTGO .dec files</li>
            <li>• Plain text (e.g., "4 Lightning Bolt")</li>
            <li>• One card per line with quantity</li>
          </ul>
        </div>

        <!-- Actions -->
        <div class="flex space-x-4">
          <button @click="$emit('close')" type="button" 
            class="flex-1 btn-secondary">
            Cancel
          </button>
          <button @click="processDeck" :disabled="!decklistText.trim() || processing" 
            class="flex-1 btn-primary disabled:opacity-50">
            {{ processing ? 'Processing...' : 'Process Decklist' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'
import { useToast } from 'vue-toastification'

const emit = defineEmits(['close', 'uploaded'])
const toast = useToast()

const decklistText = ref('')
const processing = ref(false)

const handleFileUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      decklistText.value = e.target.result
    }
    reader.readAsText(file)
  }
}

const processDeck = async () => {
  if (!decklistText.value.trim()) return

  processing.value = true
  try {
    emit('uploaded', decklistText.value.trim())
    toast.success('Decklist processed successfully!')
    emit('close')
  } catch (error) {
    toast.error('Error processing decklist')
    console.error('Decklist processing error:', error)
  } finally {
    processing.value = false
  }
}
</script>