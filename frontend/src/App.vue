<template>
  <div id="app" class="min-h-screen bg-gray-50">
    <Navbar />
    <main class="container mx-auto px-4 py-8">
      <router-view />
    </main>
    <Footer />
    
    <!-- Development Debug Panel -->
  </div>
</template>

<script setup>
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useWishlistStore } from '@/stores/wishlist'
import { useCartStore } from '@/stores/cart'
import { useToast } from 'vue-toastification'
import Navbar from '@/components/Navbar.vue'
import Footer from '@/components/Footer.vue'

const router = useRouter()
const authStore = useAuthStore()
const wishlistStore = useWishlistStore()
const cartStore = useCartStore()
const toast = useToast()


onMounted(async () => {
  await authStore.initialize()
})

// Watch for authentication state changes
watch(() => authStore.isAuthenticated, async (isAuth, wasAuth) => {
  if (isAuth && !wasAuth) {
    // User just logged in
    console.log('🔐 User logged in, initializing stores...')
    
    try {
      const startTime = performance.now()
      
      await Promise.all([
        wishlistStore.fetchWishlist(), // Use fetchWishlist instead of initialize
        cartStore.fetchCart() // Use fetchCart instead of initialize
      ])
      
      const endTime = performance.now()
      console.log(`✅ Stores initialized in ${(endTime - startTime).toFixed(2)}ms`)
      
      // Handle redirect
      const currentRoute = router.currentRoute.value
      if (currentRoute.name === 'Auth') {
        const redirectTo = currentRoute.query.redirect || '/'
        router.push(redirectTo)
        toast.success('Welcome! You have been signed in.')
      }
      
    } catch (error) {
      console.error('❌ Error initializing user stores:', error)
    }
    
  } else if (!isAuth && wasAuth) {
    // User just logged out
    console.log('🔐 User logged out, resetting stores...')
    
    wishlistStore.reset()
    cartStore.reset()
    
    const currentRoute = router.currentRoute.value
    if (currentRoute.path !== '/') {
      router.push('/')
      toast.success('You have been signed out')
    }
  }
}, { immediate: false })
</script>