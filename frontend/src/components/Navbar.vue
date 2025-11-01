<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'
import { 
  UserIcon, 
  ShoppingCartIcon, 
  HeartIcon, 
  MagnifyingGlassIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth'
import { useWishlistInit } from '@/composables/useWishlistInit'
import { useCartStore } from '@/stores/cart'
import { useToast } from 'vue-toastification'
import SearchBar from './SearchBar.vue'

const authStore = useAuthStore()
const { wishlistStore } = useWishlistInit()
const cartStore = useCartStore()
const toast = useToast()

// Mobile menu state
const mobileMenuOpen = ref(false)
const mobileSearchOpen = ref(false)

const handleSignOut = async () => {
  try {
    await authStore.signOut()
    mobileMenuOpen.value = false
    // Redirect will be handled automatically by App.vue watcher
  } catch (error) {
    toast.error('Failed to sign out')
    console.error('Sign out error:', error)
  }
}

const closeMobileMenu = () => {
  mobileMenuOpen.value = false
}

const toggleMobileSearch = () => {
  mobileSearchOpen.value = !mobileSearchOpen.value
}
</script>

<template>
  <nav class="bg-white shadow-lg sticky top-0 z-50">
    <div class="container mx-auto px-4">
      <!-- Desktop and Mobile Header -->
      <div class="flex justify-between items-center py-4">
        <!-- Logo -->
        <router-link to="/" class="flex items-center space-x-2 flex-shrink-0">
          <span class="text-lg sm:text-xl font-bold text-gray-800">MTG Marketplace</span>
        </router-link>

        <!-- Desktop Search Bar (hidden on mobile) -->
        <div class="hidden lg:flex flex-1 max-w-xl mx-8">
          <SearchBar />
        </div>

        <!-- Desktop Navigation Items (hidden on mobile) -->
        <div class="hidden lg:flex items-center space-x-4">
          <!-- Browse Cards -->
          <router-link to="/cards" class="text-gray-700 hover:text-red-700 transition-colors whitespace-nowrap">
            Browse Cards
          </router-link>

          <!-- Deck Builder -->
          <router-link 
            v-if="authStore.isAuthenticated" 
            to="/deck-builder" 
            class="text-gray-700 hover:text-red-700 transition-colors whitespace-nowrap"
          >
            Deck Builder
          </router-link>

          <!-- Wishlist -->
          <router-link 
            v-if="authStore.isAuthenticated" 
            to="/wishlist"
            class="relative text-gray-700 hover:text-red-700 transition-colors"
            :class="{ 'animate-pulse': wishlistStore.loading && !wishlistStore.initialized }"
          >
            <HeartIcon class="h-6 w-6" />
            <span 
              v-if="wishlistStore.itemCount > 0"
              class="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center transition-all duration-200"
            >
              {{ wishlistStore.itemCount > 99 ? '99+' : wishlistStore.itemCount }}
            </span>
          </router-link>

          <!-- Cart -->
          <router-link to="/cart" class="relative text-gray-700 hover:text-red-700 transition-colors">
            <ShoppingCartIcon class="h-6 w-6" />
            <span 
              v-if="cartStore.itemCount > 0"
              class="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center"
            >
              {{ cartStore.itemCount }}
            </span>
          </router-link>

          <!-- User Menu -->
          <div v-if="!authStore.isAuthenticated">
            <router-link to="/auth" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors whitespace-nowrap">
              Sign In
            </router-link>
          </div>

          <div v-else class="relative">
            <Menu as="div" class="relative inline-block text-left">
              <MenuButton class="flex items-center space-x-2 text-gray-700 hover:text-red-700">
                <UserIcon class="h-6 w-6" />
                <span class="hidden xl:inline">{{ authStore.user.email }}</span>
              </MenuButton>
              <MenuItems class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                <MenuItem v-slot="{ active }">
                  <router-link 
                    to="/dashboard" 
                    :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-gray-700']"
                  >
                    Dashboard
                  </router-link>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <router-link 
                    to="/wishlist" 
                    :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-gray-700']"
                  >
                    My Wishlist
                  </router-link>
                </MenuItem>
                <MenuItem v-if="authStore.isSeller" v-slot="{ active }">
                  <router-link 
                    to="/seller-dashboard" 
                    :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-gray-700']"
                  >
                    Seller Dashboard
                  </router-link>
                </MenuItem>
                <MenuItem v-if="authStore.isAdmin" v-slot="{ active }">
                  <router-link 
                    to="/admin" 
                    :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-gray-700']"
                  >
                    Admin Panel
                  </router-link>
                </MenuItem>
                <MenuItem v-if="authStore.isAdmin" v-slot="{ active }">
                  <router-link 
                    to="/scryfall-admin" 
                    :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-gray-700']"
                  >
                    Scryfall Admin
                  </router-link>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <button 
                    @click="handleSignOut" 
                    :class="[active ? 'bg-gray-100' : '', 'block w-full text-left px-4 py-2 text-gray-700']"
                  >
                    Sign Out
                  </button>
                </MenuItem>
              </MenuItems>
            </Menu>
          </div>
        </div>

        <!-- Mobile Icons (Cart, Search, Hamburger) -->
        <div class="flex lg:hidden items-center space-x-3">
          <!-- Mobile Search Icon -->
          <button 
            @click="toggleMobileSearch"
            class="text-gray-700 hover:text-red-700 p-2"
            aria-label="Toggle search"
          >
            <MagnifyingGlassIcon class="h-6 w-6" />
          </button>

          <!-- Mobile Cart Icon -->
          <router-link to="/cart" class="relative text-gray-700 hover:text-red-700 p-2">
            <ShoppingCartIcon class="h-6 w-6" />
            <span 
              v-if="cartStore.itemCount > 0"
              class="absolute top-0 right-0 bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center"
            >
              {{ cartStore.itemCount }}
            </span>
          </router-link>

          <!-- Mobile Hamburger Menu Button -->
          <button 
            @click="mobileMenuOpen = !mobileMenuOpen"
            class="text-gray-700 hover:text-red-700 p-2"
            aria-label="Toggle menu"
          >
            <Bars3Icon v-if="!mobileMenuOpen" class="h-6 w-6" />
            <XMarkIcon v-else class="h-6 w-6" />
          </button>
        </div>
      </div>

      <!-- Mobile Search Bar (expandable) -->
      <div 
        v-if="mobileSearchOpen"
        class="lg:hidden pb-4 animate-slideDown"
      >
        <SearchBar />
      </div>

      <!-- Mobile Menu (slide-in from top) -->
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0 -translate-y-4"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-4"
      >
        <div 
          v-if="mobileMenuOpen"
          class="lg:hidden border-t border-gray-200 py-4"
        >
          <div class="flex flex-col space-y-2">
            <!-- Browse Cards -->
            <router-link 
              to="/cards" 
              @click="closeMobileMenu"
              class="px-3 py-3 text-gray-700 hover:bg-gray-100 hover:text-red-700 transition-colors rounded-md"
            >
              Browse Cards
            </router-link>

            <!-- Deck Builder (authenticated users only) -->
            <router-link 
              v-if="authStore.isAuthenticated"
              to="/deck-builder" 
              @click="closeMobileMenu"
              class="px-3 py-3 text-gray-700 hover:bg-gray-100 hover:text-red-700 transition-colors rounded-md"
            >
              Deck Builder
            </router-link>

            <!-- Wishlist (authenticated users only) -->
            <router-link 
              v-if="authStore.isAuthenticated"
              to="/wishlist" 
              @click="closeMobileMenu"
              class="px-3 py-3 text-gray-700 hover:bg-gray-100 hover:text-red-700 transition-colors rounded-md flex items-center justify-between"
            >
              <span>My Wishlist</span>
              <span 
                v-if="wishlistStore.itemCount > 0"
                class="bg-red-600 text-white text-xs rounded-full px-2 py-1"
              >
                {{ wishlistStore.itemCount }}
              </span>
            </router-link>

            <!-- Divider for authenticated users -->
            <div v-if="authStore.isAuthenticated" class="border-t border-gray-200 my-2"></div>

            <!-- Dashboard (authenticated users only) -->
            <router-link 
              v-if="authStore.isAuthenticated"
              to="/dashboard" 
              @click="closeMobileMenu"
              class="px-3 py-3 text-gray-700 hover:bg-gray-100 hover:text-red-700 transition-colors rounded-md"
            >
              Dashboard
            </router-link>

            <!-- Seller Dashboard (sellers only) -->
            <router-link 
              v-if="authStore.isSeller"
              to="/seller-dashboard" 
              @click="closeMobileMenu"
              class="px-3 py-3 text-gray-700 hover:bg-gray-100 hover:text-red-700 transition-colors rounded-md"
            >
              Seller Dashboard
            </router-link>

            <!-- Admin Panel (admins only) -->
            <router-link 
              v-if="authStore.isAdmin"
              to="/admin" 
              @click="closeMobileMenu"
              class="px-3 py-3 text-gray-700 hover:bg-gray-100 hover:text-red-700 transition-colors rounded-md"
            >
              Admin Panel
            </router-link>

            <!-- Scryfall Admin (admins only) -->
            <router-link 
              v-if="authStore.isAdmin"
              to="/scryfall-admin" 
              @click="closeMobileMenu"
              class="px-3 py-3 text-gray-700 hover:bg-gray-100 hover:text-red-700 transition-colors rounded-md"
            >
              Scryfall Admin
            </router-link>

            <!-- Divider before auth actions -->
            <div class="border-t border-gray-200 my-2"></div>

            <!-- Sign In (unauthenticated users) -->
            <router-link 
              v-if="!authStore.isAuthenticated"
              to="/auth" 
              @click="closeMobileMenu"
              class="mx-4 p-3 bg-red-600 text-white text-center rounded hover:bg-red-700 transition-colors font-semibold"
            >
              Sign In
            </router-link>

            <!-- User Info and Sign Out (authenticated users) -->
            <div v-if="authStore.isAuthenticated" class="px-4 py-2">
              <p class="text-sm text-gray-600 mb-2">Signed in as:</p>
              <p class="text-sm font-medium text-gray-900 mb-3 truncate">{{ authStore.user.email }}</p>
              <button 
                @click="handleSignOut"
                class="w-full p-3 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors font-semibold"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </nav>
</template>

<style scoped>
/* Smooth slide down animation for mobile search */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slideDown {
  animation: slideDown 0.2s ease-out;
}

/* Ensure menu items have adequate touch targets on mobile */
@media (max-width: 1023px) {
  a, button {
    min-height: 44px;
    display: flex;
    align-items: center;
  }
}
</style>