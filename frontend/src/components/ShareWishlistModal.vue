<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-full max-w-md">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold">Share Wishlist</h2>
        <button @click="$emit('close')" class="text-gray-500 hover:text-gray-700">
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>

      <div class="space-y-4">
        <!-- Wishlist Summary -->
        <div class="bg-gray-50 rounded-lg p-4">
          <div class="text-sm text-gray-600">
            {{ wishlistItems.length }} items • Total value: ${{ totalValue }} CAD
          </div>
        </div>

        <!-- Share Options -->
        <div class="space-y-3">
          <!-- Copy Link -->
          <button
            @click="copyLink"
            class="w-full flex items-center space-x-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <LinkIcon class="h-5 w-5 text-gray-500" />
            <span>Copy Link</span>
          </button>

          <!-- Email -->
          <button
            @click="shareByEmail"
            class="w-full flex items-center space-x-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <EnvelopeIcon class="h-5 w-5 text-gray-500" />
            <span>Share by Email</span>
          </button>

          <!-- Social Media -->
          <button
            @click="shareOnTwitter"
            class="w-full flex items-center space-x-3 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <span class="text-lg">🐦</span>
            <span>Share on Twitter</span>
          </button>

          <button
            @click="shareOnFacebook"
            class="w-full flex items-center space-x-3 px-4 py-3 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors"
          >
            <span class="text-lg">📘</span>
            <span>Share on Facebook</span>
          </button>
        </div>

        <!-- Custom Message -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Custom Message (Optional)
          </label>
          <textarea
            v-model="customMessage"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Add a personal message..."
          ></textarea>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { XMarkIcon, LinkIcon, EnvelopeIcon } from '@heroicons/vue/24/outline'
import { useToast } from 'vue-toastification'

const props = defineProps({
  wishlistItems: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['close'])
const toast = useToast()

const customMessage = ref('')

const totalValue = computed(() => {
  return props.wishlistItems.reduce((sum, item) => {
    return sum + (parseFloat(item.cards?.market_price || 0))
  }, 0).toFixed(2)
})

const generateShareText = () => {
  const itemCount = props.wishlistItems.length
  const baseText = `Check out my MTG wishlist! ${itemCount} cards worth $${totalValue.value} CAD`
  return customMessage.value ? `${baseText}\n\n${customMessage.value}` : baseText
}

const generateShareLink = () => {
  // In a real app, you'd create a public wishlist view
  return `${window.location.origin}/wishlist/shared/${btoa(JSON.stringify(props.wishlistItems.map(item => item.card_id)))}`
}

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(generateShareLink())
    toast.success('Link copied to clipboard!')
  } catch (error) {
    toast.error('Failed to copy link')
  }
}

const shareByEmail = () => {
  const subject = encodeURIComponent('My MTG Wishlist')
  const body = encodeURIComponent(`${generateShareText()}\n\nView my wishlist: ${generateShareLink()}`)
  window.open(`mailto:?subject=${subject}&body=${body}`)
}

const shareOnTwitter = () => {
  const text = encodeURIComponent(generateShareText())
  const url = encodeURIComponent(generateShareLink())
  window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`)
}

const shareOnFacebook = () => {
  const url = encodeURIComponent(generateShareLink())
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`)
}
</script>