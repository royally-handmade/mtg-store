import express from 'express'
import { supabase } from '../server.js'
import multer from 'multer'
import csv from 'csv-parser'
import { Readable } from 'stream'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

// Get seller stats
router.get('/stats', async (req, res) => {
  try {
    const sellerId = req.user.id
    
    const [listingsRes, ordersRes, salesRes] = await Promise.all([
      supabase
        .from('listings')
        .select('*', { count: 'exact' })
        .eq('seller_id', sellerId)
        .eq('status', 'active'),
      supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .eq('seller_id', sellerId)
        .eq('status', 'pending'),
      supabase
        .from('orders')
        .select('total_amount')
        .eq('seller_id', sellerId)
        .eq('status', 'completed')
    ])
    
    const totalSales = salesRes.data?.reduce((sum, order) => sum + order.total_amount, 0) || 0
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('rating')
      .eq('id', sellerId)
      .single()
    
    res.json({
      activeListings: listingsRes.count,
      pendingOrders: ordersRes.count,
      totalSales: totalSales.toFixed(2),
      rating: profile?.rating || 0
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get seller orders
router.get('/orders', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          listings (
            *,
            cards (name, image_url)
          )
        ),
        profiles:buyer_id (display_name)
      `)
      .eq('seller_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (error) throw error
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get seller listings
router.get('/listings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('listings')
      .select(`
        *,
        cards (name, image_url, set_number)
      `)
      .eq('seller_id', req.user.id)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Create new listing
router.post('/listings', async (req, res) => {
  try {
    const { card_id, price, condition, quantity } = req.body
    
    const { data, error } = await supabase
      .from('listings')
      .insert({
        card_id,
        seller_id: req.user.id,
        price,
        condition,
        quantity,
        status: 'active'
      })
      .select()
    
    if (error) throw error
    res.json(data[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Bulk upload listings
router.post('/bulk-upload', upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }
    
    const listings = []
    const stream = Readable.from(req.file.buffer)
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => {
          listings.push({
            seller_id: req.user.id,
            card_id: row.card_id,
            price: parseFloat(row.price),
            condition: row.condition,
            quantity: parseInt(row.quantity),
            status: 'active'
          })
        })
        .on('end', resolve)
        .on('error', reject)
    })
    
    const { data, error } = await supabase
      .from('listings')
      .insert(listings)
    
    if (error) throw error
    res.json({ message: `Successfully uploaded ${listings.length} listings` })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get payout settings
router.get('/payout-settings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('payout_settings')
      .select('*')
      .eq('seller_id', req.user.id)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error
    res.json(data || {})
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update payout settings
router.put('/payout-settings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('payout_settings')
      .upsert({
        seller_id: req.user.id,
        ...req.body,
        updated_at: new Date()
      })
      .select()
    
    if (error) throw error
    res.json(data[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router