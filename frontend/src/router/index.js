import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue')
  },
  {
    path: '/cards',
    name: 'Cards',
    component: () => import('@/views/Cards.vue')
  },
  {
    path: '/card/:id',
    name: 'CardDetail',
    component: () => import('@/views/CardDetail.vue')
  },
  {
    path: '/auth',
    name: 'Auth',
    component: () => import('@/views/Auth.vue')
  },
  {
    path: '/reset-password',
    name: 'ResetPassword',
    component: () => import('@/views/ResetPassword.vue')
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/wishlist',
    name: 'Wishlist',
    component: () => import('@/views/Wishlist.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/wishlist/shared/:id',
    name: 'SharedWishlist',
    component: () => import('@/views/SharedWishlist.vue')
  },
  {
    path: '/seller',
    name: 'SellerDashboard',
    component: () => import('@/views/SellerDashboard.vue'),
    meta: { requiresAuth: true, requiresSeller: true }
  },
  {
    path: '/admin',
    name: 'AdminDashboard',
    component: () => import('@/views/AdminDashboard.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/deck-builder',
    name: 'DeckBuilder',
    component: () => import('@/views/DeckBuilder.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/cart',
    name: 'Cart',
    component: () => import('@/views/Cart.vue')
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/Profile.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/orders',
    name: 'Orders',
    component: () => import('@/views/Orders.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/scryfall-admin',
    name: 'ScryfallAdmin',
    component: () => import('@/views/ScryfallAdmin.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'Auth', query: { redirect: to.fullPath } })
    return
  }

  if (to.meta.requiresSeller && !authStore.isSeller) {
    next('/dashboard')
    return
  }

  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    next('/dashboard')
    return
  }

  next()
})

export default router