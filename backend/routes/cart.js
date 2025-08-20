import express from 'express'
import { supabase } from '../server.js'
import { authenticateUser } from '../middleware/auth.js'

const router = express.Router()

// Get cart items
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cart_items')
      .select(`
        *,
        listings (
          *,
          cards (name, image_url, set_number),
          profiles:seller_id (display_name, rating)
        )
      `)
      .eq('user_id', req.user.id)
    
    if (error) throw error
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Add item to cart
router.post('/add', authenticateUser, async (req, res) => {
  try {
    const { listing_id, quantity = 1 } = req.body
    
    // Check if item already in cart
    const { data: existing } = await supabase
      .from('cart_items')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('listing_id', listing_id)
      .single()
    
    if (existing) {
      // Update quantity
      const { data, error } = await supabase
        .from('cart_items')
        .update({ quantity: existing.quantity + quantity })
        .eq('id', existing.id)
        .select()
      
      if (error) throw error
      res.json(data[0])
    } else {
      // Add new item
      const { data, error } = await supabase
        .from('cart_items')
        .insert({
          user_id: req.user.id,
          listing_id,
          quantity
        })
        .select()
      
      if (error) throw error
      res.json(data[0])
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Add multiple items to cart
router.post('/add-multiple', authenticateUser, async (req, res) => {
  try {
    const { items } = req.body
    
    const cartItems = items.map(item => ({
      user_id: req.user.id,
      listing_id: item.listing_id,
      quantity: item.quantity
    }))
    
    const { data, error } = await supabase
      .from('cart_items')
      .insert(cartItems)
      .select()
    
    if (error) throw error
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update cart item quantity
router.put('/:id', authenticateUser, async (req, res) => {
  try {
    const { quantity } = req.body
    
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
      const { data, error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('id', req.params.id)
        .eq('user_id', req.user.id)
        .select()
      
      if (error) throw error
      res.json(data[0])
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
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
    res.status(500).json({ error: error.message })
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
    res.json({ message: 'Cart cleared' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get cart summary
router.get('/summary', authenticateUser, async (req, res) => {
  try {
    const { data: items, error } = await supabase
      .from('cart_items')
      .select(`
        *,
        listings (price, seller_id)
      `)
      .eq('user_id', req.user.id)
    
    if (error) throw error
    
    const subtotal = items.reduce((sum, item) => {
      return sum + (item.listings.price * item.quantity)
    }, 0)
    
    const uniqueSellers = new Set(items.map(item => item.listings.seller_id)).size
    const estimatedShipping = uniqueSellers * 5.00 // $5 per seller
    const tax = subtotal * 0.13 // 13% HST
    const total = subtotal + estimatedShipping + tax
    
    res.json({
      itemCount: items.length,
      subtotal: subtotal.toFixed(2),
      estimatedShipping: estimatedShipping.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      uniqueSellers
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router