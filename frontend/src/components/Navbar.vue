<script setup>
  import { useRouter } from 'vue-router'
  import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'
  import { UserIcon, ShoppingCartIcon, HeartIcon } from '@heroicons/vue/24/outline'
  import { useAuthStore } from '@/stores/auth'
  import { useWishlistInit } from '@/composables/useWishlistInit'
  import { useCartStore } from '@/stores/cart'
  import { useToast } from 'vue-toastification'
  import SearchBar from './SearchBar.vue'


  const authStore = useAuthStore()
  const { wishlistStore } = useWishlistInit()
  const cartStore = useCartStore()
  const toast = useToast()

  const handleSignOut = async () => {
    try {
      await authStore.signOut()
      // Redirect will be handled automatically by App.vue watcher
    } catch (error) {
      toast.error('Failed to sign out')
      console.error('Sign out error:', error)
    }
  }


</script>

<template>
  <!-- Your existing navbar template with updated signOut call -->
  <nav class="bg-white shadow-lg">
    <div class="container mx-auto px-4">
      <div class="flex justify-between items-center py-4">
        <!-- Logo -->
        <router-link to="/" class="flex items-center space-x-2">
          <span class="text-xl font-bold text-gray-800">MTG Marketplace</span>
        </router-link>

        <!-- Search Bar -->
        <div class="flex-1 max-w-xl mx-8">
          <SearchBar />
        </div>

        <!-- Navigation Items -->
        <div class="flex items-center space-x-4">
          <!-- Browse Cards -->
          <router-link to="/cards" class="text-gray-700 hover:text-red-700">
            Browse Cards
          </router-link>

          <!-- Deck Builder -->
          <router-link v-if="authStore.isAuthenticated" to="/deck-builder" class="text-gray-700 hover:text-red-700">
            Deck Builder
          </router-link>

          <!-- Wishlist -->
          <!-- Wishlist -->
          <router-link v-if="authStore.isAuthenticated" to="/wishlist"
            class="relative text-gray-700 hover:text-red-700 transition-colors"
            :class="{ 'animate-pulse': wishlistStore.loading && !wishlistStore.initialized }"
          >
            <HeartIcon class="h-6 w-6" />
            <span v-if="wishlistStore.itemCount > 0"
              class="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center transition-all duration-200"
            >
              {{ wishlistStore.itemCount > 99 ? '99+' : wishlistStore.itemCount }}
            </span>
          </router-link>

          <!-- Cart -->
          <router-link to="/cart" class="relative text-gray-700 hover:text-red-700">
            <ShoppingCartIcon class="h-6 w-6" />
            <span v-if="cartStore.itemCount > 0"
              class="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {{ cartStore.itemCount }}
            </span>
          </router-link>

          <!-- User Menu -->
          <div v-if="!authStore.isAuthenticated">
            <router-link to="/auth" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
              Sign In
            </router-link>
          </div>

          <div v-else class="relative">
            <Menu as="div" class="relative inline-block text-left">
              <MenuButton class="flex items-center space-x-2 text-gray-700 hover:text-red-700">
                <UserIcon class="h-6 w-6" />
                <span>{{ authStore.user.email }}</span>
              </MenuButton>
              <MenuItems class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg">
                <MenuItem>
                <router-link to="/dashboard" class="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                  Dashboard
                </router-link>
                </MenuItem>
                <MenuItem>
                <router-link to="/wishlist" class="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                  My Wishlist
                </router-link>
                </MenuItem>
                <MenuItem v-if="authStore.isSeller">
                <router-link to="/seller" class="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                  Seller Dashboard
                </router-link>
                </MenuItem>
                <MenuItem v-if="authStore.isAdmin">
                <router-link to="/admin" class="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                  Admin Panel
                </router-link>
                </MenuItem>
                <MenuItem v-if="authStore.isAdmin">
                <router-link to="/scryfall-admin" class="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                  Scryfall Admin
                </router-link>
                </MenuItem>
                <MenuItem>
                <button @click="handleSignOut" class="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100">
                  Sign Out
                </button>
                </MenuItem>
              </MenuItems>
            </Menu>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>