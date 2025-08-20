<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-full max-w-lg">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold">Upload Cards Database</h2>
        <button @click="$emit('close')" class="text-gray-500 hover:text-gray-700">
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>

      <div class="space-y-6">
        <!-- File Upload -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Upload CSV File
          </label>
          <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
            <input ref="fileInput" type="file" accept=".csv" @change="handleFileSelect" 
              class="hidden" />
            <button @click="$refs.fileInput.click()" type="button"
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200">
              <DocumentArrowUpIcon class="h-5 w-5 mr-2" />
              Choose CSV File
            </button>
            <p class="mt-2 text-sm text-gray-500">
              {{ selectedFile ? selectedFile.name : 'No file selected' }}
            </p>
          </div>
        </div>

        <!-- CSV Format Help -->
        <div class="bg-gray-50 rounded-lg p-4">
          <h3 class="font-medium text-gray-900 mb-2">Required CSV Columns:</h3>
          <div class="text-sm text-gray-600 space-y-1">
            <ul class="list-disc list-inside space-y-1">
              <li><strong>name</strong> - Card name</li>
              <li><strong>set_number</strong> - Set code (e.g., "M21")</li>
              <li><strong>card_number</strong> - Card number in set</li>
              <li><strong>mana_cost</strong> - Mana cost (e.g., "{2}{R}")</li>
              <li><strong>rarity</strong> - common, uncommon, rare, mythic</li>
              <li><strong>treatment</strong> - normal, foil, etc.</li>
              <li><strong>image_url</strong> - URL to card image</li>
              <li><strong>type_line</strong> - Card type (e.g., "Creature — Human")</li>
              <li><strong>market_price</strong> - Starting market price</li>
            </ul>
          </div>
        </div>

        <!-- Upload Progress -->
        <div v-if="uploading" class="space-y-2">
          <div class="flex justify-between text-sm">
            <span>Processing cards...</span>
            <span>{{ uploadProgress }}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-blue-600 h-2 rounded-full transition-all duration-300"
              :style="{ width: uploadProgress + '%' }"></div>
          </div>
        </div>

        <!-- Results -->
        <div v-if="uploadResults" class="bg-green-50 border border-green-200 rounded-lg p-4">
          <div class="text-green-800">
            ✓ Successfully uploaded {{ uploadResults.count }} cards to the database
          </div>
        </div>

        <!-- Actions -->
        <div class="flex space-x-4">
          <button @click="$emit('close')" type="button" 
            class="flex-1 btn-secondary">
            Cancel
          </button>
          <button @click="handleUpload" :disabled="!selectedFile || uploading" 
            class="flex-1 btn-primary disabled:opacity-50">
            {{ uploading ? 'Processing...' : 'Upload Cards' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { XMarkIcon, DocumentArrowUpIcon } from '@heroicons/vue/24/outline'
import { useToast } from 'vue-toastification'
import api from '@/lib/api'

const emit = defineEmits(['close'])
const toast = useToast()

const selectedFile = ref(null)
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadResults = ref(null)

const handleFileSelect = (event) => {
  selectedFile.value = event.target.files[0]
  uploadResults.value = null
}

const handleUpload = async () => {
  if (!selectedFile.value) return

  uploading.value = true
  uploadProgress.value = 0
  uploadResults.value = null

  try {
    const formData = new FormData()
    formData.append('csv', selectedFile.value)

    const response = await api.post('/admin/upload-cards', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
      }
    })

    uploadResults.value = {
      count: response.data.count || 0
    }

    toast.success(`Successfully uploaded ${uploadResults.value.count} cards!`)
    setTimeout(() => emit('close'), 2000)
  } catch (error) {
    toast.error('Upload failed')
    console.error('Upload error:', error)
  } finally {
    uploading.value = false
  }
}
</script>