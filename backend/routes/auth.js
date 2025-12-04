import express from 'express'
import { supabase, supabaseAdmin } from '../server.js'
import { authenticateUser } from '../middleware/auth.js'
import {
  sendPasswordResetEmail,
  sendPasswordResetConfirmation,
  sendAccountSecurityAlert
} from '../services/emailServiceMailgun.js'
import { 
  resetPasswordLimiter, 
  updatePasswordLimiter, 
  logSecurityEvent 
} from '../middleware/passwordSecurity.js'
import { validatePasswordChange } from '../middleware/validation.js'

const router = express.Router()

// ===== USER PROFILE MANAGEMENT =====

// Create user profile after signup
router.post('/create-profile', async (req, res) => {
  try {
    const { user_id, email, display_name, role } = req.body
    
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: user_id,
        email,
        display_name,
        role,
        approved: false
      })
      .select()
    
    if (error) throw error
    res.json(data[0])
  } catch (error) {
    console.error('Profile creation error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get user profile
router.get('/profile/:user_id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.params.user_id)
      .single()

    if (error) throw error
    res.json(data)
  } catch (error) {
    console.error('Profile fetch error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Update profile
router.put('/profile/:user_id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...req.body, updated_at: new Date() })
      .eq('id', req.params.user_id)
      .select()
    
    if (error) throw error
    res.json(data[0])
  } catch (error) {
    console.error('Profile update error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ===== PASSWORD RESET FUNCTIONALITY =====

// Send password reset email
router.post('/reset-password', resetPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }
    
    // Check if user exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('email', email)
      .single()
    
    if (profileError || !profile) {
      // Don't reveal if email exists or not for security
      return res.json({ message: 'If an account exists with this email, a reset link has been sent.' })
    }
    
    // Generate reset token
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`
    })
    
    if (error) throw error
    
    // Send custom email notification
    try {
      await sendPasswordResetEmail(email, profile.display_name)
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError)
      // Continue anyway since Supabase also sends an email
    }
    
    // Log password reset request
    await logSecurityEvent(null, 'password_reset_requested', {
      email,
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    })
    
    res.json({ message: 'If an account exists with this email, a reset link has been sent.' })
  } catch (error) {
    console.error('Password reset error:', error)
    res.status(500).json({ error: 'Failed to process password reset request' })
  }
})

// Confirm password reset
router.post('/reset-password/confirm', updatePasswordLimiter, async (req, res) => {
  try {
    const { token, password } = req.body
    
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' })
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }
    
    // Update password using Supabase
    const { data, error } = await supabase.auth.updateUser({
      password: password
    })
    
    if (error) throw error
    
    // Send confirmation email
    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', data.user.id)
        .single()
      
      try {
        await sendPasswordResetConfirmation(data.user.email, profile?.display_name)
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError)
      }
      
      // Log successful password reset
      await logSecurityEvent(data.user.id, 'password_reset_completed', {
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      })
    }
    
    res.json({ message: 'Password updated successfully' })
  } catch (error) {
    console.error('Password update error:', error)
    res.status(500).json({ error: 'Failed to update password' })
  }
})

// Validate reset session
router.get('/validate-reset-session', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }
    
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }
    
    res.json({ valid: true, user: { id: user.id, email: user.email } })
  } catch (error) {
    res.status(401).json({ error: 'Invalid session' })
  }
})

// ===== AUTHENTICATED PASSWORD CHANGE =====

// Change password (while authenticated)
router.post('/change-password', authenticateUser, updatePasswordLimiter, validatePasswordChange, async (req, res) => {
  try {
    const { current_password, new_password } = req.body
    
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new passwords are required' })
    }
    
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' })
    }
    
    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: req.user.email,
      password: current_password
    })
    
    if (signInError) {
      // Log failed password change attempt
      await logSecurityEvent(req.user.id, 'password_change_failed', {
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        reason: 'invalid_current_password'
      })
      
      return res.status(400).json({ error: 'Current password is incorrect' })
    }
    
    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: new_password
    })
    
    if (updateError) throw updateError
    
    // Get user profile for notifications
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', req.user.id)
      .single()
    
    // Log successful password change
    await logSecurityEvent(req.user.id, 'password_changed', {
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      method: 'authenticated_change'
    })
    
    // Send confirmation email
    try {
      await sendPasswordResetConfirmation(profile?.email || req.user.email, profile?.display_name)
    } catch (emailError) {
      console.error('Failed to send password change confirmation:', emailError)
    }
    
    res.json({ message: 'Password updated successfully' })
  } catch (error) {
    console.error('Password change error:', error)
    res.status(500).json({ error: 'Failed to update password' })
  }
})

// ===== SECURITY ACTIONS =====

// Sign out from all devices
router.post('/sign-out-all', authenticateUser, async (req, res) => {
  try {
    // Log security event
    await logSecurityEvent(req.user.id, 'signed_out_all_devices', {
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    })
    
    // Get user profile for notification
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', req.user.id)
      .single()
    
    // In Supabase, we can't directly sign out all sessions
    // But we can invalidate the current session and send a security alert
    // The frontend should handle signing out locally
    
    // Send security notification
    try {
      await sendAccountSecurityAlert(
        profile?.email || req.user.email,
        profile?.display_name,
        'Signed out from all devices',
        {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          location: 'Unknown' // You could use IP geolocation here
        }
      )
    } catch (emailError) {
      console.error('Failed to send security alert:', emailError)
    }
    
    res.json({ 
      message: 'Signed out from all devices',
      action_required: 'Please sign in again on all devices'
    })
  } catch (error) {
    console.error('Sign out all error:', error)
    res.status(500).json({ error: 'Failed to sign out from all devices' })
  }
})

// ===== SELLER APPLICATION =====

// Apply to become seller
router.post('/apply-seller', authenticateUser, async (req, res) => {
  try {
    const { business_info } = req.body
    const userId = req.user.id
    
    // Check if user is already a seller or has pending application
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('role, approved, email, display_name')
      .eq('id', userId)
      .single()
    
    if (currentProfile?.role === 'seller') {
      return res.status(400).json({ 
        error: currentProfile.approved ? 'You are already an approved seller' : 'Your seller application is pending review'
      })
    }
    
    // Update profile to seller role with pending approval
    const { data, error } = await supabase
      .from('profiles')
      .update({
        role: 'seller',
        approved: false,
        business_info: {
          ...business_info,
          application_date: new Date().toISOString(),
          application_ip: req.ip,
          application_user_agent: req.get('User-Agent')
        },
        updated_at: new Date()
      })
      .eq('id', userId)
      .select()
    
    if (error) throw error
    
    // Log seller application
    await logSecurityEvent(userId, 'seller_application_submitted', {
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    })
    
    // Notify admins about new seller application (you could implement this)
    // await notifyAdminsOfNewSellerApplication(currentProfile)
    
    res.json({
      message: 'Seller application submitted successfully',
      status: 'pending_review',
      application_date: new Date().toISOString()
    })
  } catch (error) {
    console.error('Seller application error:', error)
    res.status(500).json({ error: 'Failed to submit seller application' })
  }
})

export default router