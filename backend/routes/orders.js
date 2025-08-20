import express from 'express'
import { supabase } from '../server.js'
import { authenticateUser } from '../middleware/auth.js'

const router = express.Router()

// Get listing by ID
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('listings')
      .select(`
        *,
        cards (*),
        profiles:seller_id (display_name, rating)
      `)
      .eq('id', req.params.id)
      .single()
    
    if (error) throw error
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update listing
router.put('/:id', authenticateUser, async (req, res) => {
  try {
    const { price, condition, quantity } = req.body
    
    const { data, error } = await supabase
      .from('listings')
      .update({ 
        price, 
        condition, 
        quantity,
        updated_at: new Date()
      })
      .eq('id', req.params.id)
      .eq('seller_id', req.user.id)
      .select()
    
    if (error) throw error
    res.json(data[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete listing
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('listings')
      .update({ status: 'removed' })
      .eq('id', req.params.id)
      .eq('seller_id', req.user.id)
      .select()
    
    if (error) throw error
    res.json({ message: 'Listing removed successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Search listings
router.get('/search', async (req, res) => {
  try {
    const { q, condition, min_price, max_price, seller_id } = req.query
    
    let query = supabase
      .from('listings')
      .select(`
        *,
        cards (name, image_url, set_number),
        profiles:seller_id (display_name, rating)
      `)
      .eq('status', 'active')
    
    if (q) {
      query = query.or(`cards.name.ilike.%${q}%,cards.type_line.ilike.%${q}%`)
    }
    if (condition) query = query.eq('condition', condition)
    if (min_price) query = query.gte('price', min_price)
    if (max_price) query = query.lte('price', max_price)
    if (seller_id) query = query.eq('seller_id', seller_id)
    
    query = query.order('price', { ascending: true })
    
    const { data, error } = await query
    if (error) throw error
    
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router