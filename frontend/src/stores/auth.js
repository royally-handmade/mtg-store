import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import api from '@/lib/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    profile: null,
    loading: false
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    isSeller: (state) => state.profile?.role === 'seller' && state.profile?.approved,
    isAdmin: (state) => state.profile?.role === 'admin'
  },

  actions: {
    async initialize() {
      this.loading = true
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          this.user = user
          await this.fetchProfile()
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
      } finally {
        this.loading = false
      }
    },

    async fetchProfile() {
      if (!this.user) return
      try {
        const response = await api.get(`/users/profile/${this.user.id}`)
        this.profile = response.data
      } catch (error) {
        console.error('Profile fetch error:', error)
      }
    },

    async signUp(email, password, userData) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: userData }
        })
        if (error) throw error
        return data
      } catch (error) {
        throw error
      }
    },

    async signIn(email, password) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (error) throw error
        this.user = data.user
        await this.fetchProfile()
        return data
      } catch (error) {
        throw error
      }
    },

    async signOut() {
      try {
        await supabase.auth.signOut()
        this.user = null
        this.profile = null
      } catch (error) {
        throw error
      }
    },

    // New password reset methods
    async resetPassword(email) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        })
        if (error) throw error
      } catch (error) {
        throw error
      }
    },

    async updatePassword(newPassword) {
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword
        })
        if (error) throw error
      } catch (error) {
        throw error
      }
    },

    async validateResetSession() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) throw new Error('Invalid session')
        this.user = user
        return user
      } catch (error) {
        throw error
      }
    }
  }
})