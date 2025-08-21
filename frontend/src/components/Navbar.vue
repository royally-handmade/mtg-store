<template>
  <nav class="bg-white shadow-lg border-b border-gray-200">
    <div class="container mx-auto px-4">
      <div class="flex justify-between items-center h-16">
        <div class="flex items-center space-x-8">
          <router-link to="/" class="text-1xl font-bold text-red-700">
            Maple Card Market
          </router-link>
          <router-link to="/cards" class="text-gray-700 hover:text-red-700">
            Browse Cards
          </router-link>
          <router-link v-if="authStore.isAuthenticated" to="/deck-builder" 
            class="text-gray-700 hover:text-red-700">
            Deck Builder
          </router-link>
        </div>
        
        <div class="flex items-center space-x-4">
          <SearchBar />
          
          <!-- Wishlist Link -->
          <router-link v-if="authStore.isAuthenticated" to="/wishlist" 
            class="relative text-gray-700 hover:text-red-700">
            <HeartIcon class="h-6 w-6" />
            <span v-if="wishlistStore.itemCount > 0" 
              class="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {{ wishlistStore.itemCount }}
            </span>
          </router-link>
          
          <router-link to="/cart" class="relative text-gray-700 hover:text-red-700">
            <ShoppingCartIcon class="h-6 w-6" />
            <span v-if="cartStore.itemCount > 0" 
              class="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {{ cartStore.itemCount }}
            </span>
          </router-link>
          
          <!-- User Menu -->
          <div v-if="!authStore.isAuthenticated">
            <router-link to="/auth" 
              class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
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
                <MenuItem>
                  <button @click="authStore.signOut" 
                    class="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100">
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

<script setup>
import { onMounted } from 'vue'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'
import { UserIcon, ShoppingCartIcon, HeartIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth'
import { useWishlistStore } from '@/stores/wishlist'
import { useCartStore } from '@/stores/cart'
import SearchBar from './SearchBar.vue'

const authStore = useAuthStore()
const wishlistStore = useWishlistStore()
const cartStore = useCartStore()

onMounted(async () => {
  if (authStore.isAuthenticated) {
    // Initialize stores
    try {
      await Promise.all([
        wishlistStore.fetchWishlist(),
        cartStore.fetchCart()
      ])
    } catch (error) {
      console.error('Error initializing stores:', error)
    }
  }
})
</script>