<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-full max-w-lg">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold">Bulk Upload Listings</h2>
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
          <h3 class="font-medium text-gray-900 mb-2">CSV Format Required:</h3>
          <div class="text-sm text-gray-600 space-y-1">
            <p><strong>Columns:</strong> card_id, price, condition, quantity</p>
            <p><strong>Conditions:</strong> nm, lp, mp, hp, dmg</p>
            <p><strong>Example:</strong></p>
            <code class="block bg-white p-2 rounded text-xs mt-1">
              card_id,price,condition,quantity<br>
              550e8400-e29b-41d4-a716-446655440000,5.99,nm,3<br>
              6ba7b810-9dad-11d1-80b4-00c04fd430c8,12.50,lp,1
            </code>
          </div>
        </div>

        <!-- Upload Progress -->
        <div v-if="uploading" class="space-y-2">
          <div class="flex justify-between text-sm">
            <span>Uploading...</span>
            <span>{{ uploadProgress }}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-blue-600 h-2 rounded-full transition-all duration-300"
              :style="{ width: uploadProgress + '%' }"></div>
          </div>
        </div>

        <!-- Results -->
        <div v-if="uploadResults" class="space-y-2">
          <div class="text-sm">
            <div class="text-green-600">✓ {{ uploadResults.success }} listings uploaded</div>
            <div v-if="uploadResults.errors.length > 0" class="text-red-600">
              ✗ {{ uploadResults.errors.length }} errors
            </div>
          </div>
          <div v-if="uploadResults.errors.length > 0" class="max-h-32 overflow-y-auto">
            <div v-for="error in uploadResults.errors" :key="error.row" 
              class="text-xs text-red-600 bg-red-50 p-2 rounded">
              Row {{ error.row }}: {{ error.message }}
            </div>
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
            {{ uploading ? 'Uploading...' : 'Upload Listings' }}
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

    const response = await api.post('/seller/bulk-upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
      }
    })

    uploadResults.value = {
      success: response.data.success || 0,
      errors: response.data.errors || []
    }

    if (uploadResults.value.errors.length === 0) {
      toast.success('All listings uploaded successfully!')
      setTimeout(() => emit('close'), 2000)
    } else {
      toast.warning('Upload completed with some errors')
    }
  } catch (error) {
    toast.error('Upload failed')
    console.error('Upload error:', error)
    uploadResults.value = {
      success: 0,
      errors: [{ row: 'N/A', message: error.response?.data?.error || 'Upload failed' }]
    }
  } finally {
    uploading.value = false
  }
}
</script>