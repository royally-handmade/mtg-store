// Enhanced backend/routes/cart.js with better seller and shipping info
import express from 'express'
import { supabase } from '../server.js'
import { authenticateUser } from '../middleware/auth.js'

const router = express.Router()

// Get cart items with enhanced seller and shipping information
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cart_items')
      .select(`
        *,
        listings (
          *,
          cards (id, name, image_url, set_number),
          profiles:seller_id (
            id,
            display_name, 
            rating,
            shipping_address,
            seller_tier,
            created_at
          )
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    // Filter out any items with inactive listings
    const activeItems = data.filter(item => 
      item.listings && 
      item.listings.status === 'active' && 
      item.listings.quantity > 0
    )
    
    res.json(activeItems)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get cart summary with detailed breakdown
router.get('/summary', authenticateUser, async (req, res) => {
  try {
    const { data: items, error } = await supabase
      .from('cart_items')
      .select(`
        *,
        listings (
          price,
          seller_id,
          profiles:seller_id (
            shipping_address
          )
        )
      `)
      .eq('user_id', req.user.id)
    
    if (error) throw error
    
    // Calculate totals
    let subtotal = 0
    let itemCount = 0
    const uniqueSellers = new Set()
    
    items.forEach(item => {
      if (item.listings && item.listings.price) {
        subtotal += parseFloat(item.listings.price) * item.quantity
        itemCount += item.quantity
        uniqueSellers.add(item.listings.seller_id)
      }
    })
    
    // Calculate tax (13% HST for Canada)
    const tax = subtotal * 0.13
    
    // Estimate shipping (simplified - in production you'd calculate per seller/location)
    let estimatedShipping = 0
    if (uniqueSellers.size > 0) {
      estimatedShipping = uniqueSellers.size * 5.99 // $5.99 per seller
    }
    
    const total = subtotal + tax + estimatedShipping
    
    res.json({
      itemCount,
      subtotal: subtotal.toFixed(2),
      estimatedShipping: estimatedShipping.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      uniqueSellers: uniqueSellers.size
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Add item to cart with validation
router.post('/add', authenticateUser, async (req, res) => {
  try {
    const { listing_id, quantity = 1 } = req.body
    
    // Validate listing exists and is available
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select(`
        *,
        profiles:seller_id (
          id,
          display_name,
          rating
        )
      `)
      .eq('id', listing_id)
      .eq('status', 'active')
      .single()
    
    if (listingError || !listing) {
      return res.status(404).json({ error: 'Listing not found or no longer available' })
    }
    
    // Prevent users from adding their own listings
    if (listing.seller_id === req.user.id) {
      return res.status(400).json({ error: 'Cannot add your own listing to cart' })
    }
    
    // Check quantity availability
    if (listing.quantity < quantity) {
      return res.status(400).json({ 
        error: `Only ${listing.quantity} items available` 
      })
    }
    
    // Check if item already in cart
    const { data: existing } = await supabase
      .from('cart_items')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('listing_id', listing_id)
      .single()
    
    if (existing) {
      // Check if adding quantity would exceed available stock
      const newQuantity = existing.quantity + quantity
      if (newQuantity > listing.quantity) {
        return res.status(400).json({ 
          error: `Cannot add ${quantity} more. Only ${listing.quantity - existing.quantity} additional items available` 
        })
      }
      
      // Update quantity
      const { data, error } = await supabase
        .from('cart_items')
        .update({ 
          quantity: newQuantity,
          updated_at: new Date()
        })
        .eq('id', existing.id)
        .select(`
          *,
          listings (
            *,
            cards (id, name, image_url, set_number),
            profiles:seller_id (
              id,
              display_name, 
              rating,
              shipping_address
            )
          )
        `)
      
      if (error) throw error
      res.json(data[0])
    } else {
      // Add new item
      const { data, error } = await supabase
        .from('cart_items')
        .insert({
          user_id: req.user.id,
          listing_id,
          quantity,
          created_at: new Date(),
          updated_at: new Date()
        })
        .select(`
          *,
          listings (
            *,
            cards (id, name, image_url, set_number),
            profiles:seller_id (
              id,
              display_name, 
              rating,
              shipping_address
            )
          )
        `)
      
      if (error) throw error
      res.json(data[0])
    }
  } catch (error) {
    console.error('Error adding to cart:', error)
    res.status(500).json({ error: 'Failed to add item to cart' })
  }
})

// Update cart item quantity with validation
router.put('/:id', authenticateUser, async (req, res) => {
  try {
    const { quantity } = req.body
    
    // Get cart item with listing info
    const { data: cartItem } = await supabase
      .from('cart_items')
      .select(`
        *,
        listings (quantity, status, seller_id)
      `)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()
    
    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found' })
    }
    
    // Check if listing is still active
    if (cartItem.listings.status !== 'active') {
      return res.status(400).json({ error: 'This listing is no longer available' })
    }
    
    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', req.params.id)
        .eq('user_id', req.user.id)
      
      if (error) throw error
      res.json({ message: 'Item removed from cart' })
    } else {
      // Check quantity availability
      if (quantity > cartItem.listings.quantity) {
        return res.status(400).json({ 
          error: `Only ${cartItem.listings.quantity} items available` 
        })
      }
      
      const { data, error } = await supabase
        .from('cart_items')
        .update({ 
          quantity,
          updated_at: new Date()
        })
        .eq('id', req.params.id)
        .eq('user_id', req.user.id)
        .select(`
          *,
          listings (
            *,
            cards (id, name, image_url, set_number),
            profiles:seller_id (
              id,
              display_name, 
              rating,
              shipping_address
            )
          )
        `)
      
      if (error) throw error
      res.json(data[0])
    }
  } catch (error) {
    console.error('Error updating cart item:', error)
    res.status(500).json({ error: 'Failed to update cart item' })
  }
})

// Remove item from cart
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
    
    if (error) throw error
    res.json({ message: 'Item removed from cart' })
  } catch (error) {
    console.error('Error removing cart item:', error)
    res.status(500).json({ error: 'Failed to remove item from cart' })
  }
})

// Clear entire cart
router.delete('/', authenticateUser, async (req, res) => {
  try {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', req.user.id)
    
    if (error) throw error
    res.json({ message: 'Cart cleared successfully' })
  } catch (error) {
    console.error('Error clearing cart:', error)
    res.status(500).json({ error: 'Failed to clear cart' })
  }
})

// Validate cart items (check availability before checkout)
router.post('/validate', authenticateUser, async (req, res) => {
  try {
    const { data: items, error } = await supabase
      .from('cart_items')
      .select(`
        *,
        listings (
          *,
          cards (name),
          profiles:seller_id (display_name)
        )
      `)
      .eq('user_id', req.user.id)
    
    if (error) throw error
    
    const issues = []
    const validItems = []
    
    for (const item of items) {
      const listing = item.listings
      
      if (!listing || listing.status !== 'active') {
        issues.push({
          itemId: item.id,
          cardName: listing?.cards?.name || 'Unknown Card',
          issue: 'Listing no longer available'
        })
      } else if (listing.quantity < item.quantity) {
        issues.push({
          itemId: item.id,
          cardName: listing.cards.name,
          issue: `Only ${listing.quantity} available (you have ${item.quantity} in cart)`
        })
      } else {
        validItems.push(item)
      }
    }
    
    res.json({
      valid: issues.length === 0,
      validItems,
      issues
    })
  } catch (error) {
    console.error('Error validating cart:', error)
    res.status(500).json({ error: 'Failed to validate cart' })
  }
})

export default router