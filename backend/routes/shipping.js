import express from 'express'
import EasyPost from '@easypost/api'
import { supabase } from '../server.js'

const router = express.Router()
const easypost = new EasyPost(process.env.EASYPOST_API_KEY)

// Calculate shipping costs
router.post('/calculate', async (req, res) => {
  try {
    const { items, shipping_address } = req.body
    
    // Group items by seller
    const sellerGroups = groupItemsBySeller(items)
    let totalCost = 0
    const shipments = []
    
    for (const [sellerId, sellerItems] of Object.entries(sellerGroups)) {
      // Get seller address
      const { data: seller } = await supabase
        .from('profiles')
        .select('shipping_address')
        .eq('id', sellerId)
        .single()
      
      if (seller?.shipping_address) {
        const shipment = await easypost.Shipment.create({
          to_address: shipping_address,
          from_address: seller.shipping_address,
          parcel: {
            length: 6,
            width: 4,
            height: 0.5,
            weight: sellerItems.length * 0.1 // Estimate: 0.1 oz per card
          }
        })
        
        const cheapestRate = shipment.lowestRate(['USPS', 'CanadaPost'])
        totalCost += parseFloat(cheapestRate.rate)
        
        shipments.push({
          seller_id: sellerId,
          rate_id: cheapestRate.id,
          cost: parseFloat(cheapestRate.rate),
          service: cheapestRate.service,
          estimated_days: cheapestRate.est_delivery_days
        })
      }
    }
    
    res.json({
      totalCost: totalCost.toFixed(2),
      shipments: shipments
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Create shipping labels
router.post('/create-labels', async (req, res) => {
  try {
    const { order_id } = req.body
    
    const { data: order } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          listings (seller_id)
        )
      `)
      .eq('id', order_id)
      .single()
    
    const labels = []
    
    // Group items by seller and create labels
    const sellerGroups = {}
    order.order_items.forEach(item => {
      const sellerId = item.listings.seller_id
      if (!sellerGroups[sellerId]) {
        sellerGroups[sellerId] = []
      }
      sellerGroups[sellerId].push(item)
    })
    
    for (const [sellerId, items] of Object.entries(sellerGroups)) {
      const { data: seller } = await supabase
        .from('profiles')
        .select('shipping_address')
        .eq('id', sellerId)
        .single()
      
      const shipment = await easypost.Shipment.create({
        to_address: order.shipping_address,
        from_address: seller.shipping_address,
        parcel: {
          length: 6,
          width: 4,
          height: 0.5,
          weight: items.length * 0.1
        }
      })
      
      const cheapestRate = shipment.lowestRate()
      const label = await shipment.buy(cheapestRate)
      
      labels.push({
        seller_id: sellerId,
        label_url: label.postage_label.label_url,
        tracking_code: label.tracking_code
      })
      
      // Update order with tracking info
      await supabase
        .from('orders')
        .update({ 
          tracking_number: label.tracking_code,
          status: 'shipped',
          updated_at: new Date()
        })
        .eq('id', order_id)
        .eq('seller_id', sellerId)
    }
    
    res.json({ labels })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

function groupItemsBySeller(items) {
  const groups = {}
  items.forEach(item => {
    if (!groups[item.seller_id]) {
      groups[item.seller_id] = []
    }
    groups[item.seller_id].push(item)
  })
  return groups
}

export default router