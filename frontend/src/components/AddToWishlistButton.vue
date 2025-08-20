<template>
  <button 
    @click="handleWishlistToggle" 
    :disabled="loading"
    :class="buttonClass"
    class="rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <component 
      :is="isAlreadyInWishlist ? HeartIconSolid : HeartIcon"
      :class="isAlreadyInWishlist ? 'text-red-500' : 'text-gray-400'" 
      class="h-5 w-5 inline mr-2" 
    />
    <span>{{ buttonText }}</span>
  </button>
</template>

<script setup>
import { ref, computed } from 'vue'
import { HeartIcon } from '@heroicons/vue/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/vue/24/solid'
import { useAuthStore } from '@/stores/auth'
import { useWishlistStore } from '@/stores/wishlist'
import { useToast } from 'vue-toastification'

const props = defineProps({
  cardId: {
    type: String,
    required: true
  },
  cardData: {
    type: Object,
    default: () => ({})
  },
  variant: {
    type: String,
    default: 'primary', // 'primary', 'secondary', 'minimal'
    validator: (value) => ['primary', 'secondary', 'minimal'].includes(value)
  },
  size: {
    type: String,
    default: 'md', // 'sm', 'md', 'lg'
    validator: (value) => ['sm', 'md', 'lg'].includes(value)
  }
})

const emit = defineEmits(['added', 'removed', 'error', 'already-exists'])

const authStore = useAuthStore()
const wishlistStore = useWishlistStore()
const toast = useToast()

const loading = ref(false)

const isAlreadyInWishlist = computed(() => 
  wishlistStore.isInWishlist(props.cardId)
)

const buttonText = computed(() => {
  if (loading.value) return isAlreadyInWishlist.value ? 'Removing...' : 'Adding...'
  if (isAlreadyInWishlist.value) return 'Remove from wishlist'
  return 'Add to wishlist'
})

const buttonClass = computed(() => {
  const baseClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }

  const variantClasses = {
    primary: isAlreadyInWishlist.value 
      ? 'bg-red-100 text-red-600 border border-red-300 hover:bg-red-200' 
      : 'bg-blue-600 text-white hover:bg-blue-700 border border-blue-600',
    secondary: isAlreadyInWishlist.value 
      ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' 
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300',
    minimal: isAlreadyInWishlist.value 
      ? 'text-red-600 hover:text-red-700' 
      : 'text-gray-600 hover:text-blue-600'
  }

  return `${baseClasses[props.size]} ${variantClasses[props.variant]}`
})

const handleWishlistToggle = async () => {
  if (!authStore.isAuthenticated) {
    toast.error('Please sign in to use wishlist')
    return
  }

  loading.value = true
  
  try {
    if (isAlreadyInWishlist.value) {
      // Remove from wishlist
      await wishlistStore.removeFromWishlist(props.cardId)
      toast.success('Removed from wishlist')
      emit('removed')
    } else {
      // Add to wishlist
      const result = await wishlistStore.safeAddToWishlist(props.cardId, props.cardData)
      
      if (result.success) {
        toast.success(result.message)
        emit('added', result.data)
      } else if (result.alreadyExists) {
        toast.info(result.message)
        emit('already-exists')
      } else {
        toast.error(result.message)
        emit('error', result.error)
      }
    }
  } catch (error) {
    toast.error('Failed to update wishlist')
    emit('error', error.message)
    console.error('Error updating wishlist:', error)
  } finally {
    loading.value = false
  }
}
</script>


