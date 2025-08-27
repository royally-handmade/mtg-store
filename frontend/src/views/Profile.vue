<!-- src/views/Profile.vue -->
<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold">Profile Settings</h1>
      <div class="flex items-center space-x-2">
        <span :class="getStatusBadgeClass()" class="px-3 py-1 rounded-full text-sm font-medium">
          {{ getStatusText() }}
        </span>
      </div>
    </div>

    <!-- Profile Information Card -->
    <div class="card">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold">Personal Information</h2>
        <button v-if="!editingProfile" @click="editingProfile = true" 
          class="btn-secondary">
          <PencilIcon class="h-4 w-4 mr-2" />
          Edit
        </button>
      </div>

      <form v-if="editingProfile" @submit.prevent="updateProfile" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <input v-model="profileForm.display_name" type="text" required 
              class="input-field" placeholder="Your display name" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input v-model="profileForm.email" type="email" disabled 
              class="input-field bg-gray-100 cursor-not-allowed" />
            <p class="text-xs text-gray-500 mt-1">Contact support to change your email</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input v-model="profileForm.phone" type="tel" 
              class="input-field" placeholder="+1 (555) 123-4567" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Time Zone</label>
            <select v-model="profileForm.timezone" class="input-field">
              <option value="">Select timezone</option>
              <option value="America/Vancouver">Pacific Time (Vancouver)</option>
              <option value="America/Toronto">Eastern Time (Toronto)</option>
              <option value="America/New_York">Eastern Time (New York)</option>
              <option value="Europe/London">GMT (London)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Bio</label>
          <textarea v-model="profileForm.bio" rows="3" 
            class="input-field" placeholder="Tell us about yourself and your MTG interests..."></textarea>
        </div>

        <div class="flex space-x-4">
          <button type="button" @click="cancelProfileEdit" class="btn-secondary">
            Cancel
          </button>
          <button type="submit" :disabled="profileLoading" class="btn-primary">
            {{ profileLoading ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </form>

      <!-- Read-only profile display -->
      <div v-else class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-medium text-gray-700">Display Name</label>
            <p class="mt-1 text-gray-900">{{ authStore.profile?.display_name || 'Not set' }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Email Address</label>
            <p class="mt-1 text-gray-900">{{ authStore.user?.email }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Phone Number</label>
            <p class="mt-1 text-gray-900">{{ authStore.profile?.phone || 'Not set' }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Member Since</label>
            <p class="mt-1 text-gray-900">{{ formatDate(authStore.profile?.created_at) }}</p>
          </div>
        </div>

        <div v-if="authStore.profile?.bio">
          <label class="block text-sm font-medium text-gray-700">Bio</label>
          <p class="mt-1 text-gray-900">{{ authStore.profile.bio }}</p>
        </div>
      </div>
    </div>

    <!-- Shipping Address Card -->
    <div class="card">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold">Shipping Address</h2>
        <button v-if="!editingAddress" @click="editingAddress = true" 
          class="btn-secondary">
          <PencilIcon class="h-4 w-4 mr-2" />
          {{ hasAddress ? 'Edit' : 'Add Address' }}
        </button>
      </div>

      <form v-if="editingAddress" @submit.prevent="updateShippingAddress" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input v-model="addressForm.name" type="text" required 
              class="input-field" placeholder="John Doe" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Company (Optional)</label>
            <input v-model="addressForm.company" type="text" 
              class="input-field" placeholder="Company Name" />
          </div>

          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
            <input v-model="addressForm.street1" type="text" required 
              class="input-field" placeholder="123 Main Street" />
          </div>

          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Apartment, Suite, etc. (Optional)
            </label>
            <input v-model="addressForm.street2" type="text" 
              class="input-field" placeholder="Apt 4B" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input v-model="addressForm.city" type="text" required 
              class="input-field" placeholder="Vancouver" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">State/Province</label>
            <input v-model="addressForm.state" type="text" required 
              class="input-field" placeholder="BC" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
            <input v-model="addressForm.zip" type="text" required 
              class="input-field" placeholder="V6B 1A1" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <select v-model="addressForm.country" required class="input-field">
              <option value="">Select country</option>
              <option value="CA">Canada</option>
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="AU">Australia</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="JP">Japan</option>
            </select>
          </div>
        </div>

        <div class="flex space-x-4">
          <button type="button" @click="cancelAddressEdit" class="btn-secondary">
            Cancel
          </button>
          <button type="submit" :disabled="addressLoading" class="btn-primary">
            {{ addressLoading ? 'Saving...' : 'Save Address' }}
          </button>
        </div>
      </form>

      <!-- Read-only address display -->
      <div v-else-if="hasAddress" class="space-y-2">
        <p class="font-medium">{{ shippingAddress.name }}</p>
        <p v-if="shippingAddress.company" class="text-gray-600">{{ shippingAddress.company }}</p>
        <p>{{ shippingAddress.street1 }}</p>
        <p v-if="shippingAddress.street2">{{ shippingAddress.street2 }}</p>
        <p>{{ shippingAddress.city }}, {{ shippingAddress.state }} {{ shippingAddress.zip }}</p>
        <p>{{ getCountryName(shippingAddress.country) }}</p>
      </div>

      <div v-else class="text-center py-8 text-gray-500">
        <MapPinIcon class="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>No shipping address set</p>
        <p class="text-sm">Add an address to enable order shipping</p>
      </div>
    </div>

    <!-- Email Preferences Card -->
    <div class="card">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold">Email Preferences</h2>
      </div>

      <form @submit.prevent="updateEmailPreferences" class="space-y-4">
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium">Order Updates</h3>
              <p class="text-sm text-gray-600">Notifications about your orders and shipping</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input v-model="emailPreferences.order_updates" type="checkbox" class="sr-only peer">
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium">Price Alerts</h3>
              <p class="text-sm text-gray-600">Get notified when wishlist cards drop in price</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input v-model="emailPreferences.price_alerts" type="checkbox" class="sr-only peer">
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium">Marketing Emails</h3>
              <p class="text-sm text-gray-600">News, promotions, and platform updates</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input v-model="emailPreferences.marketing" type="checkbox" class="sr-only peer">
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium">Security Alerts</h3>
              <p class="text-sm text-gray-600">Important account security notifications (recommended)</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input v-model="emailPreferences.security" type="checkbox" class="sr-only peer">
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        <div class="pt-4">
          <button type="submit" :disabled="preferencesLoading" class="btn-primary">
            {{ preferencesLoading ? 'Saving...' : 'Save Email Preferences' }}
          </button>
        </div>
      </form>
    </div>

    <!-- Security Section -->
    <div class="card">
      <h2 class="text-xl font-bold mb-6">Security</h2>
      
      <div class="space-y-6">
        <!-- Password Change -->
        <div class="border-b pb-6">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h3 class="font-medium">Password</h3>
              <p class="text-sm text-gray-600">Last updated {{ formatDate(authStore.user?.updated_at) }}</p>
            </div>
            <button @click="showPasswordChange = true" class="btn-secondary">
              Change Password
            </button>
          </div>
        </div>

        <!-- Two-Factor Authentication -->
        <div class="border-b pb-6">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h3 class="font-medium">Two-Factor Authentication</h3>
              <p class="text-sm text-gray-600">Add an extra layer of security to your account</p>
            </div>
            <span class="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
              Coming Soon
            </span>
          </div>
        </div>

        <!-- Login Sessions -->
        <div>
          <div class="flex justify-between items-center mb-4">
            <div>
              <h3 class="font-medium">Active Sessions</h3>
              <p class="text-sm text-gray-600">Manage where you're signed in</p>
            </div>
            <button @click="signOutEverywhere" class="text-red-600 hover:text-red-800 text-sm font-medium">
              Sign out everywhere
            </button>
          </div>
          
          <div class="space-y-3">
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div class="flex items-center space-x-3">
                <ComputerDesktopIcon class="h-5 w-5 text-gray-400" />
                <div>
                  <p class="font-medium text-sm">Current Session</p>
                  <p class="text-xs text-gray-600">{{ userAgent }} • {{ currentLocation }}</p>
                </div>
              </div>
              <span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Account Actions -->
    <div class="card">
      <h2 class="text-xl font-bold mb-6">Account Actions</h2>
      
      <div class="space-y-4">
        <!-- Become a Seller -->
        <div v-if="!authStore.isSeller && authStore.profile?.role !== 'seller'" 
          class="flex justify-between items-center p-4 border border-green-200 rounded-lg">
          <div>
            <h3 class="font-medium text-green-800">Become a Seller</h3>
            <p class="text-sm text-green-600">Start selling your MTG cards on our marketplace</p>
          </div>
          <button @click="applyToBecomeSellerDialog = true" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
            Apply Now
          </button>
        </div>

        <!-- Seller Status -->
        <div v-else-if="authStore.profile?.role === 'seller'" 
          class="flex justify-between items-center p-4 border border-blue-200 rounded-lg">
          <div>
            <h3 class="font-medium text-blue-800">Seller Account</h3>
            <p class="text-sm text-blue-600">
              Status: {{ authStore.profile.approved ? 'Approved' : 'Pending Approval' }}
            </p>
          </div>
          <router-link v-if="authStore.isSeller" to="/seller" class="btn-primary">
            Seller Dashboard
          </router-link>
        </div>

        <!-- Export Data -->
        <div class="flex justify-between items-center p-4 border border-gray-200 rounded-lg">
          <div>
            <h3 class="font-medium">Export Your Data</h3>
            <p class="text-sm text-gray-600">Download a copy of your account data</p>
          </div>
          <button @click="exportUserData" :disabled="exportLoading" class="btn-secondary">
            {{ exportLoading ? 'Preparing...' : 'Export Data' }}
          </button>
        </div>

        <!-- Delete Account -->
        <div class="flex justify-between items-center p-4 border border-red-200 rounded-lg">
          <div>
            <h3 class="font-medium text-red-800">Delete Account</h3>
            <p class="text-sm text-red-600">Permanently delete your account and all data</p>
          </div>
          <button @click="showDeleteConfirm = true" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
            Delete Account
          </button>
        </div>
      </div>
    </div>

    <!-- Password Change Modal -->
    <div v-if="showPasswordChange" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold">Change Password</h3>
          <button @click="showPasswordChange = false" class="text-gray-500 hover:text-gray-700">
            <XMarkIcon class="h-6 w-6" />
          </button>
        </div>
        
        <form @submit.prevent="changePassword" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input v-model="passwordForm.current" type="password" required 
              class="input-field" placeholder="Enter current password" />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input v-model="passwordForm.new" type="password" required 
              class="input-field" placeholder="Enter new password" minlength="6" />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input v-model="passwordForm.confirm" type="password" required 
              class="input-field" placeholder="Confirm new password" />
          </div>
          
          <div class="flex space-x-4">
            <button type="button" @click="showPasswordChange = false" 
              class="flex-1 btn-secondary">
              Cancel
            </button>
            <button type="submit" :disabled="passwordLoading" 
              class="flex-1 btn-primary">
              {{ passwordLoading ? 'Updating...' : 'Update Password' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Become Seller Modal -->
    <div v-if="applyToBecomeSellerDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold">Apply to Become a Seller</h3>
          <button @click="applyToBecomeSellerDialog = false" class="text-gray-500 hover:text-gray-700">
            <XMarkIcon class="h-6 w-6" />
          </button>
        </div>
        
        <div class="space-y-4">
          <p class="text-gray-600">
            Ready to start selling your MTG cards? Our seller program allows you to list cards, 
            manage inventory, and earn money from your collection.
          </p>
          
          <div class="bg-blue-50 border border-blue-200 rounded p-3">
            <h4 class="font-medium text-blue-900 mb-2">Seller Benefits:</h4>
            <ul class="text-sm text-blue-800 space-y-1">
              <li>• List unlimited cards</li>
              <li>• Set your own prices</li>
              <li>• Bulk upload via CSV</li>
              <li>• Weekly payouts</li>
              <li>• 97.5% of sale price (2.5% platform fee)</li>
            </ul>
          </div>
          
          <div class="flex space-x-4">
            <button @click="applyToBecomeSellerDialog = false" 
              class="flex-1 btn-secondary">
              Cancel
            </button>
            <button @click="applyToBecomeSellerNow" :disabled="sellerApplicationLoading" 
              class="flex-1 btn-primary">
              {{ sellerApplicationLoading ? 'Applying...' : 'Apply Now' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Account Confirmation -->
    <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold text-red-800">Delete Account</h3>
          <button @click="showDeleteConfirm = false" class="text-gray-500 hover:text-gray-700">
            <XMarkIcon class="h-6 w-6" />
          </button>
        </div>
        
        <div class="space-y-4">
          <p class="text-gray-600">
            <strong>Warning:</strong> This action cannot be undone. All your data including orders, 
            wishlists, and account information will be permanently deleted.
          </p>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Type "DELETE" to confirm
            </label>
            <input v-model="deleteConfirmText" type="text" 
              class="input-field" placeholder="DELETE" />
          </div>
          
          <div class="flex space-x-4">
            <button @click="showDeleteConfirm = false" 
              class="flex-1 btn-secondary">
              Cancel
            </button>
            <button @click="deleteAccount" 
              :disabled="deleteConfirmText !== 'DELETE' || deleteLoading" 
              class="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50">
              {{ deleteLoading ? 'Deleting...' : 'Delete Account' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Success/Error Messages -->
    <div v-if="successMessage" class="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50">
      {{ successMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'vue-toastification'
import { 
  PencilIcon, 
  XMarkIcon, 
  MapPinIcon, 
  ComputerDesktopIcon 
} from '@heroicons/vue/24/outline'
import api from '@/lib/api'

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

// Loading states
const profileLoading = ref(false)
const addressLoading = ref(false)
const preferencesLoading = ref(false)
const passwordLoading = ref(false)
const exportLoading = ref(false)
const deleteLoading = ref(false)
const sellerApplicationLoading = ref(false)

// Edit states
const editingProfile = ref(false)
const editingAddress = ref(false)

// Modal states
const showPasswordChange = ref(false)
const showDeleteConfirm = ref(false)
const applyToBecomeSellerDialog = ref(false)

// Success message
const successMessage = ref('')

// Form data
const profileForm = ref({
  display_name: '',
  email: '',
  phone: '',
  timezone: '',
  bio: ''
})

const addressForm = ref({
  name: '',
  company: '',
  street1: '',
  street2: '',
  city: '',
  state: '',
  zip: '',
  country: ''
})

const emailPreferences = ref({
  order_updates: true,
  price_alerts: true,
  marketing: false,
  security: true
})

const passwordForm = ref({
  current: '',
  new: '',
  confirm: ''
})

const deleteConfirmText = ref('')

// Computed properties
const hasAddress = computed(() => {
  return authStore.profile?.shipping_address && 
         Object.keys(authStore.profile.shipping_address).length > 0
})

const shippingAddress = computed(() => {
  return authStore.profile?.shipping_address || {}
})

const userAgent = computed(() => {
  return navigator.userAgent.includes('Chrome') ? 'Chrome Browser' : 
         navigator.userAgent.includes('Firefox') ? 'Firefox Browser' :
         navigator.userAgent.includes('Safari') ? 'Safari Browser' : 'Unknown Browser'
})

const currentLocation = computed(() => {
  // In a real app, you'd use geolocation or IP lookup
  return 'Vancouver, BC'
})

// Status badge helpers
const getStatusBadgeClass = () => {
  if (authStore.profile?.role === 'admin') {
    return 'bg-purple-100 text-purple-800'
  } else if (authStore.isSeller) {
    return 'bg-green-100 text-green-800'
  } else if (authStore.profile?.role === 'seller') {
    return 'bg-yellow-100 text-yellow-800'
  } else {
    return 'bg-blue-100 text-blue-800'
  }
}

const getStatusText = () => {
  if (authStore.profile?.role === 'admin') {
    return 'Administrator'
  } else if (authStore.isSeller) {
    return 'Approved Seller'
  } else if (authStore.profile?.role === 'seller') {
    return 'Seller (Pending)'
  } else {
    return 'Buyer'
  }
}

// Helper functions
const formatDate = (date) => {
  if (!date) return 'Unknown'
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const getCountryName = (code) => {
  const countries = {
    'CA': 'Canada',
    'US': 'United States',
    'GB': 'United Kingdom',
    'AU': 'Australia',
    'DE': 'Germany',
    'FR': 'France',
    'JP': 'Japan'
  }
  return countries[code] || code
}

const showSuccess = (message) => {
  successMessage.value = message
  setTimeout(() => {
    successMessage.value = ''
  }, 3000)
}

// Profile management
const initializeProfileForm = () => {
  if (authStore.profile) {
    profileForm.value = {
      display_name: authStore.profile.display_name || '',
      email: authStore.user?.email || '',
      phone: authStore.profile.phone || '',
      timezone: authStore.profile.timezone || '',
      bio: authStore.profile.bio || ''
    }
  }
}

const initializeAddressForm = () => {
  if (hasAddress.value) {
    addressForm.value = { ...shippingAddress.value }
  }
}

const initializeEmailPreferences = () => {
  if (authStore.profile?.email_preferences) {
    emailPreferences.value = { ...authStore.profile.email_preferences }
  }
}

const updateProfile = async () => {
  profileLoading.value = true
  try {
    await api.put('/users/profile', profileForm.value)
    await authStore.fetchProfile()
    editingProfile.value = false
    showSuccess('Profile updated successfully!')
  } catch (error) {
    toast.error('Failed to update profile')
    console.error('Profile update error:', error)
  } finally {
    profileLoading.value = false
  }
}

const cancelProfileEdit = () => {
  editingProfile.value = false
  initializeProfileForm()
}

// Address management
const updateShippingAddress = async () => {
  addressLoading.value = true
  try {
    await api.put('/users/profile', {
      shipping_address: addressForm.value
    })
    await authStore.fetchProfile()
    editingAddress.value = false
    showSuccess('Shipping address updated successfully!')
  } catch (error) {
    toast.error('Failed to update shipping address')
    console.error('Address update error:', error)
  } finally {
    addressLoading.value = false
  }
}

const cancelAddressEdit = () => {
  editingAddress.value = false
  initializeAddressForm()
}

// Email preferences
const updateEmailPreferences = async () => {
  preferencesLoading.value = true
  try {
    await api.put('/users/profile', {
      email_preferences: emailPreferences.value
    })
    await authStore.fetchProfile()
    showSuccess('Email preferences updated successfully!')
  } catch (error) {
    toast.error('Failed to update email preferences')
    console.error('Email preferences error:', error)
  } finally {
    preferencesLoading.value = false
  }
}

// Password management
const changePassword = async () => {
  if (passwordForm.value.new !== passwordForm.value.confirm) {
    toast.error('New passwords do not match')
    return
  }

  if (passwordForm.value.new.length < 6) {
    toast.error('Password must be at least 6 characters')
    return
  }

  passwordLoading.value = true
  try {
    await api.post('/auth/change-password', {
      current_password: passwordForm.value.current,
      new_password: passwordForm.value.new
    })
    
    showPasswordChange.value = false
    passwordForm.value = { current: '', new: '', confirm: '' }
    showSuccess('Password updated successfully!')
  } catch (error) {
    toast.error('Failed to update password. Please check your current password.')
    console.error('Password change error:', error)
  } finally {
    passwordLoading.value = false
  }
}

// Security actions
const signOutEverywhere = async () => {
  try {
    await api.post('/auth/sign-out-all')
    await authStore.signOut()
    toast.success('Signed out from all devices')
  } catch (error) {
    toast.error('Failed to sign out from all devices')
    console.error('Sign out error:', error)
  }
}

// Seller application
const applyToBecomeSellerNow = async () => {
  sellerApplicationLoading.value = true
  try {
    await api.post('/auth/apply-seller', {
      user_id: authStore.user.id,
      business_info: {
        application_date: new Date().toISOString(),
        reason: 'Profile page application'
      }
    })
    
    await authStore.fetchProfile()
    applyToBecomeSellerDialog.value = false
    showSuccess('Seller application submitted! We\'ll review it within 2-3 business days.')
  } catch (error) {
    toast.error('Failed to submit seller application')
    console.error('Seller application error:', error)
  } finally {
    sellerApplicationLoading.value = false
  }
}

// Data export
const exportUserData = async () => {
  exportLoading.value = true
  try {
    const response = await api.get('/users/export-data', {
      responseType: 'blob'
    })
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `mtg-marketplace-data-${new Date().toISOString().split('T')[0]}.json`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    
    showSuccess('Data export started! Check your downloads.')
  } catch (error) {
    toast.error('Failed to export data')
    console.error('Data export error:', error)
  } finally {
    exportLoading.value = false
  }
}

// Account deletion
const deleteAccount = async () => {
  if (deleteConfirmText.value !== 'DELETE') {
    toast.error('Please type "DELETE" to confirm')
    return
  }

  deleteLoading.value = true
  try {
    await api.delete('/users/account')
    await authStore.signOut()
    router.push('/')
    toast.success('Account deleted successfully')
  } catch (error) {
    toast.error('Failed to delete account')
    console.error('Account deletion error:', error)
  } finally {
    deleteLoading.value = false
    showDeleteConfirm.value = false
    deleteConfirmText.value = ''
  }
}

// Initialize data
onMounted(() => {
  initializeProfileForm()
  initializeAddressForm()
  initializeEmailPreferences()
})
</script>

<style scoped>
/* Custom toggle switch styles */
.peer:checked ~ .peer-checked\:bg-blue-600 {
  background-color: #2563eb;
}

.peer:focus ~ .peer-focus\:ring-4 {
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);
}

/* Custom input field styles */
.input-field:disabled {
  background-color: #f3f4f6;
  cursor: not-allowed;
}

/* Animation for success message */
@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.fixed.bottom-4.right-4 {
  animation: slideIn 0.3s ease-out;
}
</style>