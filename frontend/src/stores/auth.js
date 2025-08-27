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
    isSeller: (state) => state.profile?.role === 'seller' || state.profile?.role === 'admin',
    isApproved: (state) => (state.profile?.role === 'seller' && state.profile?.approved) || state.profile?.role === 'admin',
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
        const response = await api.get(`auth/profile/${this.user.id}`)
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

        // With database trigger, profile creation is automatic
        if (data.user && (data.user.email_confirmed_at || data.session)) {
          // User is immediately confirmed and logged in
          this.user = data.user
          await this.fetchProfile()
        }
        // If user needs email confirmation, profile will be created by trigger
        // and user will be logged in when they click the confirmation link

        return data
      } catch (error) {
        throw error
      }
    },

    // Add method to create profile after email confirmation
    async createProfileAfterConfirmation(user) {
      try {
        await api.post('/auth/create-profile', {
          user_id: user.id,
          email: user.email,
          display_name: user.user_metadata?.display_name || user.email.split('@')[0],
          role: user.user_metadata?.role || 'buyer'
        })

        this.user = user
        await this.fetchProfile()
      } catch (error) {
        console.error('Profile creation after confirmation error:', error)
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