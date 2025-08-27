<template>
  <div id="app" class="min-h-screen bg-gray-50">
    <Navbar />
    <main class="container mx-auto px-4 py-8">
      <router-view />
    </main>
    <Footer />
  </div>
</template>

<script setup>
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'vue-toastification'
import Navbar from '@/components/Navbar.vue'
import Footer from '@/components/Footer.vue'

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

onMounted(async () => {
  await authStore.initialize()
})

// Watch for authentication state changes and handle redirects
watch(() => authStore.isAuthenticated, (isAuth, wasAuth) => {
  if (isAuth && !wasAuth) {
    // User just logged in or confirmed their email
    const currentRoute = router.currentRoute.value
    
    // If they're on the auth page, redirect them to home
    if (currentRoute.name === 'Auth') {
      const redirectTo = currentRoute.query.redirect || '/'
      router.push(redirectTo)
      toast.success('Welcome! You have been signed in.')
    }
  } else if (!isAuth && wasAuth) {
    // User just logged out
    const currentRoute = router.currentRoute.value
    
    // Redirect to home page unless already there
    if (currentRoute.path !== '/') {
      router.push('/')
      toast.success('You have been signed out')
    }
  }
}, { immediate: false })
</script>