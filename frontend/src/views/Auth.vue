<template>
  <div class="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold">{{ getTitle() }}</h1>
      <p class="text-gray-600 mt-2">
        {{ getSubtitle() }}
      </p>
    </div>

    <!-- Sign In / Sign Up Form -->
    <form v-if="!showResetPassword" @submit.prevent="handleSubmit" class="space-y-6">
      <div v-if="isSignUp">
        <label class="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
        <input v-model="form.displayName" type="text" required class="input-field" placeholder="Your display name" />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input v-model="form.email" type="email" required class="input-field" placeholder="your@email.com" />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input v-model="form.password" type="password" required class="input-field" placeholder="••••••••" />
      </div>

      <div v-if="isSignUp">
        <label class="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
        <select v-model="form.role" class="input-field">
          <option value="buyer">Buyer</option>
          <option value="seller">Seller</option>
        </select>
        <p v-if="form.role === 'seller'" class="text-sm text-gray-500 mt-1">
          Seller accounts require approval before you can list items.
        </p>
      </div>

      <button type="submit" :disabled="loading" class="w-full btn-primary disabled:opacity-50">
        {{ loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In') }}
      </button>
    </form>

    <!-- Reset Password Form -->
    <form v-if="showResetPassword" @submit.prevent="handleResetPassword" class="space-y-6">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
        <input v-model="resetEmail" type="email" required class="input-field" placeholder="Enter your email address" />
        <p class="text-sm text-gray-500 mt-1">
          We'll send you a link to reset your password.
        </p>
      </div>

      <button type="submit" :disabled="resetLoading" class="w-full btn-primary disabled:opacity-50">
        {{ resetLoading ? 'Sending...' : 'Send Reset Link' }}
      </button>
    </form>

    <!-- Navigation Links -->
    <div class="mt-6 text-center space-y-2">
      <div v-if="!showResetPassword">
        <button @click="isSignUp = !isSignUp" class="text-blue-600 hover:text-blue-800">
          {{ isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up" }}
        </button>
      </div>

      <div>
        <button @click="toggleResetPassword" class="text-sm text-gray-600 hover:text-gray-800">
          {{ showResetPassword ? 'Back to sign in' : 'Forgot your password?' }}
        </button>
      </div>
    </div>

    <!-- Success Message -->
    <div v-if="resetSuccess" class="mt-4 p-3 bg-green-100 border border-green-300 rounded text-green-700">
      <div class="flex items-center">
        <CheckCircleIcon class="h-5 w-5 mr-2" />
        <span>Password reset link sent! Check your email.</span>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="mt-4 p-3 bg-red-100 border border-red-300 rounded text-red-700">
      <div class="flex items-center">
        <ExclamationTriangleIcon class="h-5 w-5 mr-2" />
        <span>{{ error }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
  import { ref } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { useAuthStore } from '@/stores/auth'
  import { useToast } from 'vue-toastification'
  import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline'

  const router = useRouter()
  const route = useRoute()
  const authStore = useAuthStore()
  const toast = useToast()

  const isSignUp = ref(false)
  const showResetPassword = ref(false)
  const loading = ref(false)
  const resetLoading = ref(false)
  const resetSuccess = ref(false)
  const error = ref('')
  const resetEmail = ref('')

  const form = ref({
    email: '',
    password: '',
    displayName: '',
    role: 'buyer'
  })

  const getTitle = () => {
    if (showResetPassword.value) return 'Reset Password'
    return isSignUp.value ? 'Create Account' : 'Sign In'
  }

  const getSubtitle = () => {
    if (showResetPassword.value) return 'Enter your email to receive a reset link'
    return isSignUp.value ? 'Join the MTG community' : 'Welcome back!'
  }

  const handleSubmit = async () => {
    loading.value = true
    error.value = ''

    try {
      if (isSignUp.value) {
        await authStore.signUp(form.value.email, form.value.password, {
          display_name: form.value.displayName,
          role: form.value.role
        })

        toast.success('Account created successfully!')
      } else {
        await authStore.signIn(form.value.email, form.value.password)

        // Redirect to intended page or dashboard
        const redirectTo = route.query.redirect || '/dashboard'
        router.push(redirectTo)
      }
    } catch (err) {
      error.value = err.message || 'An error occurred'
    } finally {
      loading.value = false
    }
  }

  const handleResetPassword = async () => {
    resetLoading.value = true
    error.value = ''
    resetSuccess.value = false

    try {
      await authStore.resetPassword(resetEmail.value)
      resetSuccess.value = true
      toast.success('Password reset link sent to your email!')
    } catch (err) {
      error.value = err.message || 'Failed to send reset email'
    } finally {
      resetLoading.value = false
    }
  }

  const toggleResetPassword = () => {
    showResetPassword.value = !showResetPassword.value
    error.value = ''
    resetSuccess.value = false
    resetEmail.value = ''
  }
</script>