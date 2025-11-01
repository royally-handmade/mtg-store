<template>
  <footer class="bg-gray-900 text-white mt-16">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <!-- Company Info -->
        <div class="space-y-4">
          <h3 class="text-lg sm:text-xl font-bold">MTG Marketplace</h3>
          <p class="text-gray-400 text-sm leading-relaxed">
            The premier destination for buying and selling Magic: The Gathering cards worldwide.
          </p>
          <div class="flex space-x-4">
            <a href="#" class="text-gray-400 hover:text-white transition-colors" aria-label="Twitter">
              <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
              </svg>
            </a>
            <a href="#" class="text-gray-400 hover:text-white transition-colors" aria-label="Facebook">
              <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z"/>
              </svg>
            </a>
          </div>
        </div>

        <!-- Quick Links -->
        <div class="space-y-4">
          <h4 class="text-base sm:text-lg font-semibold">Quick Links</h4>
          <ul class="space-y-2 text-sm">
            <li>
              <router-link to="/cards" class="text-gray-400 hover:text-white transition-colors block py-1">
                Browse Cards
              </router-link>
            </li>
            <li>
              <router-link to="/deck-builder" class="text-gray-400 hover:text-white transition-colors block py-1">
                Deck Builder
              </router-link>
            </li>
            <li>
              <router-link to="/auth" class="text-gray-400 hover:text-white transition-colors block py-1">
                Sign In
              </router-link>
            </li>
            <li>
              <a href="#" @click.prevent="showResetPassword = true" class="text-gray-400 hover:text-white transition-colors cursor-pointer block py-1">
                Reset Password
              </a>
            </li>
          </ul>
        </div>

        <!-- Support -->
        <div class="space-y-4">
          <h4 class="text-base sm:text-lg font-semibold">Support</h4>
          <ul class="space-y-2 text-sm">
            <li>
              <a href="#" class="text-gray-400 hover:text-white transition-colors block py-1">Help Center</a>
            </li>
            <li>
              <a href="#" class="text-gray-400 hover:text-white transition-colors block py-1">Contact Us</a>
            </li>
            <li>
              <a href="#" class="text-gray-400 hover:text-white transition-colors block py-1">Shipping Info</a>
            </li>
            <li>
              <a href="#" class="text-gray-400 hover:text-white transition-colors block py-1">Returns</a>
            </li>
          </ul>
        </div>

        <!-- Legal -->
        <div class="space-y-4">
          <h4 class="text-base sm:text-lg font-semibold">Legal</h4>
          <ul class="space-y-2 text-sm">
            <li>
              <a href="#" class="text-gray-400 hover:text-white transition-colors block py-1">Privacy Policy</a>
            </li>
            <li>
              <a href="#" class="text-gray-400 hover:text-white transition-colors block py-1">Terms of Service</a>
            </li>
            <li>
              <a href="#" class="text-gray-400 hover:text-white transition-colors block py-1">Seller Agreement</a>
            </li>
            <li>
              <a href="#" class="text-gray-400 hover:text-white transition-colors block py-1">Cookie Policy</a>
            </li>
          </ul>
        </div>
      </div>

      <!-- Bottom Bar -->
      <div class="border-t border-gray-800 mt-8 pt-6 sm:pt-8">
        <div class="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
          <p class="text-gray-400 text-xs sm:text-sm text-center sm:text-left">
            © 2024 MTG Marketplace. All rights reserved.
          </p>
          <div class="flex items-center space-x-2 sm:space-x-4">
            <span class="text-gray-400 text-xs sm:text-sm">Powered by</span>
            <div class="flex items-center space-x-2">
              <!-- Add any logos here -->
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Reset Password Modal -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="showResetPassword" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
        <Transition
          enter-active-class="transition ease-out duration-200"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition ease-in duration-150"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div v-if="showResetPassword" class="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-semibold text-gray-900">Reset Password</h3>
              <button 
                @click="showResetPassword = false" 
                class="text-gray-500 hover:text-gray-700 p-2 -mr-2"
                aria-label="Close modal"
              >
                <XMarkIcon class="h-6 w-6" />
              </button>
            </div>
            
            <form @submit.prevent="handleResetPassword" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input 
                  v-model="resetEmail" 
                  type="email" 
                  required 
                  class="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-base" 
                  placeholder="Enter your email address" 
                />
              </div>
              
              <div class="flex flex-col sm:flex-row gap-3">
                <button 
                  type="button" 
                  @click="showResetPassword = false" 
                  class="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  :disabled="resetLoading" 
                  class="flex-1 bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {{ resetLoading ? 'Sending...' : 'Send Reset Link' }}
                </button>
              </div>
            </form>
          </div>
        </Transition>
      </div>
    </Transition>
  </footer>
</template>

<script setup>
import { ref } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'vue-toastification'

const authStore = useAuthStore()
const toast = useToast()

const showResetPassword = ref(false)
const resetEmail = ref('')
const resetLoading = ref(false)

const handleResetPassword = async () => {
  resetLoading.value = true
  try {
    await authStore.resetPassword(resetEmail.value)
    toast.success('Password reset link sent to your email!')
    showResetPassword.value = false
    resetEmail.value = ''
  } catch (error) {
    toast.error('Failed to send reset email. Please try again.')
  } finally {
    resetLoading.value = false
  }
}
</script>

<style scoped>
/* Ensure touch targets are adequate on mobile */
@media (max-width: 640px) {
  a, button {
    min-height: 44px;
  }
}
</style>