<template>
  <div class="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold">Set New Password</h1>
      <p class="text-gray-600 mt-2">
        Enter your new password below
      </p>
    </div>

    <form v-if="!isComplete" @submit.prevent="handleSubmit" class="space-y-6">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">New Password</label>
        <input v-model="form.password" type="password" required 
          class="input-field" placeholder="Enter new password" minlength="6" />
        <p class="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
        <input v-model="form.confirmPassword" type="password" required 
          class="input-field" placeholder="Confirm new password" />
      </div>

      <button type="submit" :disabled="loading || !isFormValid" 
        class="w-full btn-primary disabled:opacity-50">
        {{ loading ? 'Updating...' : 'Update Password' }}
      </button>
    </form>

    <!-- Success State -->
    <div v-if="isComplete" class="text-center space-y-4">
      <div class="text-green-600">
        <CheckCircleIcon class="h-16 w-16 mx-auto mb-4" />
        <h2 class="text-xl font-semibold">Password Updated!</h2>
        <p class="text-gray-600 mt-2">Your password has been successfully updated.</p>
      </div>
      <router-link to="/auth" class="btn-primary inline-block">
        Sign In with New Password
      </router-link>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="mt-4 p-3 bg-red-100 border border-red-300 rounded text-red-700">
      <div class="flex items-center">
        <ExclamationTriangleIcon class="h-5 w-5 mr-2" />
        <span>{{ error }}</span>
      </div>
    </div>

    <!-- Invalid Token State -->
    <div v-if="invalidToken" class="text-center space-y-4">
      <div class="text-red-600">
        <ExclamationTriangleIcon class="h-16 w-16 mx-auto mb-4" />
        <h2 class="text-xl font-semibold">Invalid or Expired Link</h2>
        <p class="text-gray-600 mt-2">
          This password reset link is invalid or has expired.
        </p>
      </div>
      <router-link to="/auth" class="btn-secondary inline-block mr-2">
        Back to Sign In
      </router-link>
      <button @click="requestNewLink" class="btn-primary">
        Request New Link
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'vue-toastification'
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const toast = useToast()

const loading = ref(false)
const isComplete = ref(false)
const invalidToken = ref(false)
const error = ref('')

const form = ref({
  password: '',
  confirmPassword: ''
})

const isFormValid = computed(() => {
  return form.value.password.length >= 6 && 
         form.value.password === form.value.confirmPassword
})

const handleSubmit = async () => {
  if (!isFormValid.value) {
    error.value = 'Passwords must match and be at least 6 characters'
    return
  }

  loading.value = true
  error.value = ''
  
  try {
    await authStore.updatePassword(form.value.password)
    isComplete.value = true
    toast.success('Password updated successfully!')
  } catch (err) {
    error.value = err.message || 'Failed to update password'
  } finally {
    loading.value = false
  }
}

const requestNewLink = () => {
  router.push('/auth')
  toast.info('Please request a new password reset link')
}

onMounted(async () => {
  // Check if we have a valid session from the reset link
  try {
    await authStore.validateResetSession()
  } catch (err) {
    invalidToken.value = true
    console.error('Invalid reset session:', err)
  }
})
</script>