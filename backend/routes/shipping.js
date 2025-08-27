// backend/routes/shipping.js - Enhanced shipping calculation

import express from 'express'
import EasyPost from '@easypost/api'
import { supabase } from '../server.js'
import { authenticateUser } from '../middleware/auth.js'

const router = express.Router()
const easypost = new EasyPost(process.env.EASYPOST_API_KEY)

// Enhanced shipping calculation that handles both static fees and dynamic EasyPost rates
router.post('/calculate', authenticateUser, async (req, res) => {
  try {
    const { items, shipping_address } = req.body

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' })
    }

    if (!shipping_address) {
      return res.status(400).json({ error: 'Shipping address is required' })
    }

    // Get detailed listing information including seller data and shipping preferences
    const itemIds = items.map(item => item.listing_id || item.id)
    
    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select(`
        id,
        seller_id,
        static_shipping_fee,
        shipping_method,
        quantity,
        cards (
          id,
          name,
          weight_grams
        ),
        profiles:seller_id (
          id,
          display_name,
          shipping_address,
          shipping_preferences,
          default_shipping_method
        )
      `)
      .in('id', itemIds)
      .eq('status', 'active')

    if (listingsError) {
      console.error('Error fetching listings:', listingsError)
      return res.status(500).json({ error: 'Failed to fetch listing data' })
    }

    // Group items by seller and calculate shipping for each seller
    const sellerGroups = groupItemsBySellerEnhanced(items, listings)
    let totalShippingCost = 0
    const shipmentDetails = []

    for (const [sellerId, sellerData] of Object.entries(sellerGroups)) {
      try {
        const shippingCost = await calculateSellerShippingCost({
          seller: sellerData.seller,
          items: sellerData.items,
          listings: sellerData.listings,
          shipping_address
        })

        totalShippingCost += shippingCost.cost
        
        shipmentDetails.push({
          seller_id: sellerId,
          seller_name: sellerData.seller.display_name,
          shipping_cost: shippingCost.cost,
          shipping_method: shippingCost.method,
          service_name: shippingCost.service_name,
          estimated_delivery_days: shippingCost.estimated_delivery_days,
          items_count: sellerData.items.length,
          weight_grams: shippingCost.weight_grams
        })
      } catch (error) {
        console.error(`Error calculating shipping for seller ${sellerId}:`, error)
        
        // Use fallback shipping cost if EasyPost fails
        const fallbackCost = calculateFallbackShipping(sellerData.items)
        totalShippingCost += fallbackCost
        
        shipmentDetails.push({
          seller_id: sellerId,
          seller_name: sellerData.seller.display_name,
          shipping_cost: fallbackCost,
          shipping_method: 'standard',
          service_name: 'Standard Shipping',
          estimated_delivery_days: 5,
          items_count: sellerData.items.length,
          error: 'Used fallback shipping calculation'
        })
      }
    }

    res.json({
      success: true,
      totalCost: totalShippingCost.toFixed(2),
      currency: 'CAD',
      shipments: shipmentDetails,
      calculation_method: 'mixed', // Can be 'static', 'dynamic', or 'mixed'
      calculated_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Shipping calculation error:', error)
    res.status(500).json({ 
      error: 'Failed to calculate shipping costs',
      message: error.message 
    })
  }
})

// Calculate shipping cost for a specific seller
async function calculateSellerShippingCost({ seller, items, listings, shipping_address }) {
  // Check if seller has shipping preferences set
  const shippingMethod = seller.default_shipping_method || 'dynamic'
  
  // Check if any listings have static shipping fees
  const hasStaticFees = listings.some(listing => 
    listing.static_shipping_fee !== null && listing.static_shipping_fee > 0
  )

  if (shippingMethod === 'static' || hasStaticFees) {
    return calculateStaticShipping(listings, items)
  } else {
    return await calculateDynamicShipping(seller, items, listings, shipping_address)
  }
}

// Calculate static shipping based on listing fees
function calculateStaticShipping(listings, items) {
  let totalCost = 0
  let hasStaticFee = false

  // Find the highest static shipping fee among the listings
  // (Most sellers set one fee that covers all items in an order)
  for (const listing of listings) {
    if (listing.static_shipping_fee && listing.static_shipping_fee > 0) {
      totalCost = Math.max(totalCost, parseFloat(listing.static_shipping_fee))
      hasStaticFee = true
    }
  }

  // If no static fee is set, use platform default
  if (!hasStaticFee) {
    totalCost = 5.99 // Default CAD shipping rate
  }

  return {
    cost: totalCost,
    method: 'static',
    service_name: 'Standard Shipping',
    estimated_delivery_days: 5,
    weight_grams: calculateTotalWeight(items, listings)
  }
}

// Calculate dynamic shipping using EasyPost
async function calculateDynamicShipping(seller, items, listings, shipping_address) {
  if (!seller.shipping_address) {
    throw new Error(`Seller ${seller.display_name} has no shipping address configured`)
  }

  // Calculate total weight
  const totalWeight = calculateTotalWeight(items, listings)
  const weightOz = Math.max(0.1, totalWeight / 28.35) // Convert grams to oz, minimum 0.1 oz

  // Estimate package dimensions for cards
  const cardCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const packageDimensions = estimatePackageDimensions(cardCount)

  try {
    const shipment = await easypost.Shipment.create({
      to_address: {
        name: shipping_address.name,
        street1: shipping_address.street1,
        street2: shipping_address.street2 || undefined,
        city: shipping_address.city,
        state: shipping_address.province || shipping_address.state,
        zip: shipping_address.postalCode || shipping_address.postal_code,
        country: shipping_address.country,
        phone: shipping_address.phone || undefined
      },
      from_address: {
        name: seller.shipping_address.name,
        street1: seller.shipping_address.street1,
        street2: seller.shipping_address.street2 || undefined,
        city: seller.shipping_address.city,
        state: seller.shipping_address.province || seller.shipping_address.state,
        zip: seller.shipping_address.postalCode || seller.shipping_address.postal_code,
        country: seller.shipping_address.country,
        phone: seller.shipping_address.phone || undefined
      },
      parcel: {
        length: packageDimensions.length,
        width: packageDimensions.width,
        height: packageDimensions.height,
        weight: weightOz
      }
    })

    // Get the cheapest available rate
    const carriers = ['USPS', 'CanadaPost', 'UPS', 'FedEx']
    const cheapestRate = shipment.lowestRate(carriers)

    if (!cheapestRate) {
      throw new Error('No shipping rates available')
    }

    return {
      cost: parseFloat(cheapestRate.rate),
      method: 'dynamic',
      service_name: `${cheapestRate.carrier} ${cheapestRate.service}`,
      estimated_delivery_days: cheapestRate.est_delivery_days || 7,
      weight_grams: totalWeight,
      carrier: cheapestRate.carrier,
      service: cheapestRate.service,
      rate_id: cheapestRate.id
    }

  } catch (error) {
    console.error('EasyPost API error:', error)
    throw new Error(`EasyPost shipping calculation failed: ${error.message}`)
  }
}

// Group items by seller with enhanced data
function groupItemsBySellerEnhanced(items, listings) {
  const groups = {}

  for (const item of items) {
    const listing = listings.find(l => l.id === (item.listing_id || item.id))
    if (!listing) continue

    const sellerId = listing.seller_id
    
    if (!groups[sellerId]) {
      groups[sellerId] = {
        seller: listing.profiles,
        items: [],
        listings: []
      }
    }

    groups[sellerId].items.push(item)
    groups[sellerId].listings.push(listing)
  }

  return groups
}

// Calculate total weight of items
function calculateTotalWeight(items, listings) {
  let totalWeight = 0

  for (const item of items) {
    const listing = listings.find(l => l.id === (item.listing_id || item.id))
    if (listing && listing.cards.weight_grams) {
      totalWeight += listing.cards.weight_grams * item.quantity
    } else {
      // Default weight for a Magic card (approximately 1.8 grams)
      totalWeight += 1.8 * item.quantity
    }
  }

  return totalWeight
}

// Estimate package dimensions based on card count
function estimatePackageDimensions(cardCount) {
  // Standard bubble mailer dimensions for cards
  if (cardCount <= 4) {
    return { length: 6, width: 4, height: 0.25 } // Single cards in toploader
  } else if (cardCount <= 20) {
    return { length: 6, width: 4, height: 0.75 } // Small stack
  } else if (cardCount <= 100) {
    return { length: 6, width: 4, height: 2 } // Medium stack
  } else {
    return { length: 8, width: 6, height: 3 } // Large shipment
  }
}

// Fallback shipping calculation when EasyPost fails
function calculateFallbackShipping(items) {
  const cardCount = items.reduce((sum, item) => sum + item.quantity, 0)
  
  if (cardCount <= 4) return 4.99
  if (cardCount <= 20) return 7.99
  if (cardCount <= 100) return 12.99
  return 19.99
}

// Create shipping labels for completed orders
router.post('/create-labels', authenticateUser, async (req, res) => {
  try {
    const { order_id } = req.body

    // Get order details with seller information
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          listings (
            seller_id,
            cards (name, weight_grams)
          )
        )
      `)
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    // Group items by seller
    const sellerGroups = {}
    order.order_items.forEach(item => {
      const sellerId = item.listings.seller_id
      if (!sellerGroups[sellerId]) {
        sellerGroups[sellerId] = []
      }
      sellerGroups[sellerId].push(item)
    })

    const labels = []

    for (const [sellerId, items] of Object.entries(sellerGroups)) {
      // Get seller shipping address
      const { data: seller } = await supabase
        .from('profiles')
        .select('shipping_address, display_name')
        .eq('id', sellerId)
        .single()

      if (!seller || !seller.shipping_address) {
        console.error(`No shipping address for seller ${sellerId}`)
        continue
      }

      // Calculate package weight
      const totalWeight = items.reduce((sum, item) => {
        const weight = item.listings.cards.weight_grams || 1.8
        return sum + (weight * item.quantity)
      }, 0)

      const weightOz = Math.max(0.1, totalWeight / 28.35)
      const packageDimensions = estimatePackageDimensions(
        items.reduce((sum, item) => sum + item.quantity, 0)
      )

      try {
        const shipment = await easypost.Shipment.create({
          to_address: order.shipping_address,
          from_address: seller.shipping_address,
          parcel: {
            length: packageDimensions.length,
            width: packageDimensions.width,
            height: packageDimensions.height,
            weight: weightOz
          }
        })

        const cheapestRate = shipment.lowestRate(['USPS', 'CanadaPost', 'UPS'])
        const label = await shipment.buy(cheapestRate)

        labels.push({
          seller_id: sellerId,
          seller_name: seller.display_name,
          label_url: label.postage_label.label_url,
          tracking_code: label.tracking_code,
          service: `${cheapestRate.carrier} ${cheapestRate.service}`,
          cost: parseFloat(cheapestRate.rate)
        })

        // Update order items with tracking info
        await supabase
          .from('order_items')
          .update({ 
            tracking_number: label.tracking_code,
            shipping_status: 'label_created',
            updated_at: new Date()
          })
          .eq('order_id', order_id)
          .eq('seller_id', sellerId)

      } catch (error) {
        console.error(`Label creation failed for seller ${sellerId}:`, error)
        labels.push({
          seller_id: sellerId,
          seller_name: seller.display_name,
          error: error.message
        })
      }
    }

    res.json({
      success: true,
      labels,
      order_id
    })

  } catch (error) {
    console.error('Label creation error:', error)
    res.status(500).json({ error: 'Failed to create shipping labels' })
  }
})

export default router