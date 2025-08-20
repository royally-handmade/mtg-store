import express from 'express'
import { supabase } from '../server.js'
import { authenticateUser } from '../middleware/auth.js'
import { 
  sendAccountSecurityAlert, 
  sendEmailPreferencesUpdate,
  sendAccountDeletionConfirmation 
} from '../services/emailService.js'
import { validateUpdateProfile, validatePasswordChange } from '../middleware/validation.js'

const router = express.Router()

// ===== PROFILE MANAGEMENT =====

// Get current user's full profile
router.get('/profile', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        email_preferences,
        shipping_address,
        business_info
      `)
      .eq('id', req.user.id)
      .single()
    
    if (error) throw error
    
    // Don't expose sensitive data
    const sanitizedProfile = {
      ...data,
      // Remove sensitive fields if needed
    }
    
    res.json(sanitizedProfile)
  } catch (error) {
    console.error('Error fetching profile:', error)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

// Get user profile by ID (public info only)
router.get('/profile/:user_id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, role, rating, total_sales, created_at')
      .eq('id', req.params.user_id)
      .single()
    
    if (error) throw error
    res.json(data)
  } catch (error) {
    console.error('Error fetching public profile:', error)
    res.status(500).json({ error: error.message })
  }
})

// Update user profile
router.put('/profile', authenticateUser, validateUpdateProfile, async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      updated_at: new Date()
    }
    
    // Handle email preferences separately if provided
    if (req.body.email_preferences) {
      updateData.email_preferences = req.body.email_preferences
      
      // Send confirmation email for preference changes
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, email')
          .eq('id', req.user.id)
          .single()
        
        if (profile) {
          await sendEmailPreferencesUpdate(
            profile.email, 
            profile.display_name, 
            req.body.email_preferences
          )
        }
      } catch (emailError) {
        console.error('Failed to send preference update email:', emailError)
        // Continue with profile update even if email fails
      }
    }
    
    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', req.user.id)
      .select()
    
    if (error) throw error
    
    // Log profile update for security
    await logSecurityEvent(req.user.id, 'profile_updated', {
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      updated_fields: Object.keys(req.body)
    })
    
    res.json({
      message: 'Profile updated successfully',
      profile: data[0]
    })
  } catch (error) {
    console.error('Error updating profile:', error)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

// Export user data (GDPR compliance)
router.get('/export-data', authenticateUser, async (req, res) => {
  try {
    // Collect all user data from various tables
    const [profileRes, ordersRes, listingsRes, wishlistRes, cartRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', req.user.id).single(),
      supabase.from('orders').select('*').or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`),
      supabase.from('listings').select('*').eq('seller_id', req.user.id),
      supabase.from('wishlists').select('*').eq('user_id', req.user.id),
      supabase.from('cart_items').select('*').eq('user_id', req.user.id)
    ])
    
    const exportData = {
      export_info: {
        generated_at: new Date().toISOString(),
        user_id: req.user.id,
        export_type: 'complete_user_data'
      },
      profile: profileRes.data,
      orders: ordersRes.data || [],
      listings: listingsRes.data || [],
      wishlist: wishlistRes.data || [],
      cart: cartRes.data || [],
      auth_info: {
        email: req.user.email,
        created_at: req.user.created_at,
        last_sign_in: req.user.last_sign_in_at
      }
    }
    
    // Log data export for security
    await logSecurityEvent(req.user.id, 'data_exported', {
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      export_size: JSON.stringify(exportData).length
    })
    
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="mtg-marketplace-data-${req.user.id}.json"`)
    res.json(exportData)
  } catch (error) {
    console.error('Error exporting user data:', error)
    res.status(500).json({ error: 'Failed to export user data' })
  }
})

// Delete user account
router.delete('/account', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id
    
    // Get user info before deletion for logging
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email, role')
      .eq('id', userId)
      .single()
    
    // Start transaction-like deletion process
    // Note: Supabase doesn't have transactions, so we'll delete in order
    
    // 1. Delete user data (in reverse dependency order)
    await Promise.all([
      supabase.from('cart_items').delete().eq('user_id', userId),
      supabase.from('wishlists').delete().eq('user_id', userId),
      supabase.from('order_items').delete().in('order_id', 
        supabase.from('orders').select('id').or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      )
    ])
    
    await supabase.from('orders').delete().or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    await supabase.from('listings').delete().eq('seller_id', userId)
    await supabase.from('security_logs').delete().eq('user_id', userId)
    await supabase.from('payout_settings').delete().eq('seller_id', userId)
    
    // 2. Delete profile
    await supabase.from('profiles').delete().eq('id', userId)
    
    // 3. Delete auth user (this will cascade)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId)
    if (authError) {
      console.error('Auth deletion error:', authError)
      // Profile is already deleted, so we can't easily rollback
      // Log this for manual cleanup if needed
    }
    
    // Send confirmation email (if email still works)
    try {
      if (profile?.email) {
        await sendAccountDeletionConfirmation(profile.email, profile.display_name)
      }
    } catch (emailError) {
      console.error('Failed to send deletion confirmation:', emailError)
    }
    
    // Log account deletion
    console.log(`Account deleted: ${userId} (${profile?.email}) at ${new Date().toISOString()}`)
    
    res.json({ 
      message: 'Account deleted successfully',
      deleted_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error deleting account:', error)
    res.status(500).json({ error: 'Failed to delete account' })
  }
})

// ===== SECURITY HELPER FUNCTION =====

const logSecurityEvent = async (userId, action, metadata = {}) => {
  try {
    await supabase
      .from('security_logs')
      .insert({
        user_id: userId,
        action,
        ip_address: metadata.ip_address,
        user_agent: metadata.user_agent,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString()
        }
      })
  } catch (error) {
    console.error('Failed to log security event:', error)
  }
}

export default router