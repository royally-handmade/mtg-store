import { onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useWishlistStore } from '@/stores/wishlist'

export function useWishlistInit() {
  const authStore = useAuthStore()
  const wishlistStore = useWishlistStore()

  // Initialize wishlist when auth state changes to authenticated
  watch(
    () => authStore.isAuthenticated,
    async (isAuthenticated, wasAuthenticated) => {
      if (isAuthenticated && !wasAuthenticated) {
        // User just logged in - only fetch if not already initialized
        if (!wishlistStore.initialized && !wishlistStore.loading) {
          await wishlistStore.fetchWishlist()
        }
      } else if (!isAuthenticated && wasAuthenticated) {
        // User just logged out
        wishlistStore.reset()
      }
    },
    { immediate: true }
  )

  // Initialize on mount if already authenticated and not already initialized
  onMounted(async () => {
    if (authStore.isAuthenticated && !wishlistStore.initialized && !wishlistStore.loading) {
      await wishlistStore.fetchWishlist()
    }
  })

  return {
    wishlistStore,
    isInitialized: () => wishlistStore.initialized,
    refresh: () => wishlistStore.fetchWishlist() // Use the correct method name
  }
}
