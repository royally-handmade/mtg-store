import express from 'express'
import { supabase } from '../server.js'
import multer from 'multer'
import csv from 'csv-parser'
import { Readable } from 'stream'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

// Middleware to check admin role
const requireAdmin = async (req, res, next) => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single()
    
    if (profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }
    next()
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

router.use(requireAdmin)

// Get platform statistics
router.get('/stats', async (req, res) => {
  try {
    const [usersRes, sellersRes, listingsRes, ordersRes] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'seller').eq('approved', true),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('orders').select('total_amount').eq('status', 'completed')
    ])
    
    const totalRevenue = ordersRes.data?.reduce((sum, order) => {
      return sum + (order.total_amount * 0.025) // 2.5% platform fee
    }, 0) || 0
    
    res.json({
      totalUsers: usersRes.count,
      activeSellers: sellersRes.count,
      totalListings: listingsRes.count,
      revenue: totalRevenue.toFixed(2)
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get pending seller approvals
router.get('/pending-sellers', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'seller')
      .eq('approved', false)
      .order('created_at', { ascending: true })
    
    if (error) throw error
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Approve seller
router.patch('/sellers/:id/approve', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ approved: true, updated_at: new Date() })
      .eq('id', req.params.id)
      .select()
    
    if (error) throw error
    res.json(data[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Reject seller
router.patch('/sellers/:id/reject', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ role: 'buyer', updated_at: new Date() })
      .eq('id', req.params.id)
      .select()
    
    if (error) throw error
    res.json(data[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Upload cards CSV
router.post('/upload-cards', upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }
    
    const cards = []
    const stream = Readable.from(req.file.buffer)
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => {
          cards.push({
            name: row.name,
            set_number: row.set_number,
            card_number: row.card_number,
            mana_cost: row.mana_cost,
            rarity: row.rarity?.toLowerCase(),
            treatment: row.treatment,
            image_url: row.image_url,
            type_line: row.type_line,
            market_price: parseFloat(row.market_price) || null
          })
        })
        .on('end', resolve)
        .on('error', reject)
    })
    
    const { data, error } = await supabase
      .from('cards')
      .upsert(cards, { onConflict: 'name,set_number' })
    
    if (error) throw error
    res.json({ message: `Successfully uploaded ${cards.length} cards` })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get platform settings
router.get('/settings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('*')
    
    if (error) throw error
    
    const settings = {}
    data.forEach(setting => {
      settings[setting.key] = setting.value
    })
    
    res.json(settings)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update platform settings
router.put('/settings', async (req, res) => {
  try {
    const updates = Object.entries(req.body).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date()
    }))
    
    const { data, error } = await supabase
      .from('platform_settings')
      .upsert(updates, { onConflict: 'key' })
    
    if (error) throw error
    res.json({ message: 'Settings updated successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Export platform data
router.get('/export', async (req, res) => {
  try {
    const { type = 'all' } = req.query
    
    let data = []
    let filename = 'platform-export.csv'
    
    switch (type) {
      case 'orders':
        const { data: orders } = await supabase
          .from('orders')
          .select(`
            *,
            buyer:buyer_id(display_name, email),
            seller:seller_id(display_name, email)
          `)
        data = orders
        filename = 'orders-export.csv'
        break
      
      case 'listings':
        const { data: listings } = await supabase
          .from('listings')
          .select(`
            *,
            cards(name, set_number),
            profiles(display_name, email)
          `)
        data = listings
        filename = 'listings-export.csv'
        break
      
      default:
        // Export summary data
        data = await generateSummaryReport()
        filename = 'summary-export.csv'
    }
    
    const csv = convertToCSV(data)
    
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(csv)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

function convertToCSV(data) {
  if (!data || data.length === 0) return ''
  
  const headers = Object.keys(data[0])
  const csvRows = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header]
        return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
      }).join(',')
    )
  ]
  
  return csvRows.join('\n')
}

async function generateSummaryReport() {
  // Generate comprehensive platform summary
  const [users, sellers, listings, orders] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('profiles').select('*').eq('role', 'seller'),
    supabase.from('listings').select('*'),
    supabase.from('orders').select('*')
  ])
  
  return [{
    total_users: users.data?.length || 0,
    total_sellers: sellers.data?.length || 0,
    total_listings: listings.data?.length || 0,
    total_orders: orders.data?.length || 0,
    generated_at: new Date().toISOString()
  }]
}

export default router