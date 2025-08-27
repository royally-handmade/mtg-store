// backend/middleware/auth.js
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    // Profile should exist due to database trigger
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return res.status(500).json({ error: 'Failed to fetch user profile - ' + JSON.stringify(profileError) })
    } {
    }

    req.user = user
    req.userProfile = profile
    next()
  } catch (error) {
    console.error('Authentication error:', error)
    res.status(401).json({ error: 'Authentication failed' })
  }
}

// Admin authentication middleware
export const authenticateAdmin = async (req, res, next) => {
  try {
    // First authenticate the user
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    // Check if user has admin role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, approved')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return res.status(500).json({ error: 'Failed to verify admin status' })
    }

    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' })
    }

    if (profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    if (!profile.approved) {
      return res.status(403).json({ error: 'Admin account not approved' })
    }

    req.user = user
    req.userProfile = profile
    next()
  } catch (error) {
    console.error('Admin authentication error:', error)
    res.status(500).json({ error: 'Authentication failed' })
  }
}

// Seller authentication middleware
export const authenticateSeller = async (req, res, next) => {
  try {
    // First authenticate the user
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    // Check if user has seller role and is approved
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, approved')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return res.status(500).json({ error: 'Failed to verify seller status' })
    }

    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' })
    }

    if (profile.role !== 'seller' && profile.role !== 'admin') {
      return res.status(403).json({ error: 'Seller access required' })
    }

    if (!profile.approved) {
      return res.status(403).json({ error: 'Seller account not approved' })
    }

    req.user = user
    req.userProfile = profile
    next()
  } catch (error) {
    console.error('Seller authentication error:', error)
    res.status(500).json({ error: 'Authentication failed' })
  }
}

// Optional: Admin or Seller authentication (for routes accessible to both)
export const authenticateAdminOrSeller = async (req, res, next) => {
  try {
    // First authenticate the user
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    // Check if user has admin or seller role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, approved')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return res.status(500).json({ error: 'Failed to verify user status' })
    }

    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' })
    }

    if (profile.role !== 'admin' && profile.role !== 'seller') {
      return res.status(403).json({ error: 'Admin or Seller access required' })
    }

    if (!profile.approved) {
      return res.status(403).json({ error: 'Account not approved' })
    }

    req.user = user
    req.userProfile = profile
    next()
  } catch (error) {
    console.error('Authentication error:', error)
    res.status(500).json({ error: 'Authentication failed' })
  }
}

// Middleware to check if user can perform admin actions on a resource
export const canManageResource = (resourceType) => {
  return async (req, res, next) => {
    try {
      const userRole = req.userProfile?.role

      // Admins can manage everything
      if (userRole === 'admin') {
        return next()
      }

      // Resource-specific permissions
      switch (resourceType) {
        case 'listings':
          // Sellers can manage their own listings
          if (userRole === 'seller') {
            const { listing_id, seller_id } = req.params
            if (seller_id && seller_id !== req.user.id) {
              return res.status(403).json({ error: 'Cannot manage other sellers\' resources' })
            }
          }
          break

        case 'orders':
          // Users can manage their own orders
          const { buyer_id } = req.params
          if (buyer_id && buyer_id !== req.user.id && userRole !== 'admin') {
            return res.status(403).json({ error: 'Cannot access other users\' orders' })
          }
          break

        case 'cards':
          // Only admins can manage card data
          if (userRole !== 'admin') {
            return res.status(403).json({ error: 'Admin access required for card management' })
          }
          break

        default:
          return res.status(403).json({ error: 'Insufficient permissions' })
      }

      next()
    } catch (error) {
      console.error('Resource permission check error:', error)
      res.status(500).json({ error: 'Permission check failed' })
    }
  }
}

// Helper function to check permissions in route handlers
export const hasPermission = (userProfile, permission) => {
  const rolePermissions = {
    admin: ['*'], // Admin has all permissions
    seller: ['manage_own_listings', 'view_orders', 'manage_payouts'],
    buyer: ['view_public', 'manage_own_orders', 'manage_wishlist']
  }

  const userPermissions = rolePermissions[userProfile?.role] || []

  return userPermissions.includes('*') || userPermissions.includes(permission)
}

// Middleware for route-level permission checking
export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!hasPermission(req.userProfile, permission)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permission
      })
    }
    next()
  }
}