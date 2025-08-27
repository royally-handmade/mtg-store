import express from 'express'
import { supabase } from '../server.js'
import { authenticateUser, authenticateAdmin } from '../middleware/auth.js'
import { marketPriceService } from '../services/marketPriceService.js'
import helcimService from '../services/helcimService.js'
import { body, validationResult } from 'express-validator'

const router = express.Router()

router.patch('/:id/status', authenticateUser, async (req, res) => {
  try {
    const { status } = req.body
    const orderId = req.params.id

    if (!status) {
      return res.status(400).json({ error: 'Status is required' })
    }

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'completed', 'cancelled']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    // Get current order to check permissions
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(
          *,
          listings(seller_id, cards(id, name))
        )
      `)
      .eq('id', orderId)
      .single()

    if (orderError) throw orderError

    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    // Check permissions (buyer, seller, or admin can update status)
    const isBuyer = order.buyer_id === req.user.id
    const isSeller = order.order_items.some(item => item.listings.seller_id === req.user.id)
    const isAdmin = req.user.role === 'admin'

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to update this order' })
    }

    // Update the order status
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...(status === 'completed' && { completed_at: new Date().toISOString() })
      })
      .eq('id', orderId)
      .select()
      .single()

    if (updateError) throw updateError

    // If order was marked as completed, trigger market price recalculation
    if (status === 'completed' && order.status !== 'completed') {
      console.log(`📊 Order ${orderId} marked as completed, triggering price recalculation...`)
      
      // Run price recalculation in background (don't await to avoid blocking response)
      marketPriceService.onOrderCompleted(orderId).catch(error => {
        console.error(`❌ Error in background price recalculation for order ${orderId}:`, error)
      })
    }

    res.json({
      message: 'Order status updated successfully',
      order: updatedOrder
    })

  } catch (error) {
    console.error('Error updating order status:', error)
    res.status(500).json({ error: error.message })
  }
})

// Bulk complete orders endpoint (for admin/seller use)
router.post('/bulk-complete', authenticateUser, async (req, res) => {
  try {
    const { order_ids } = req.body

    if (!order_ids || !Array.isArray(order_ids)) {
      return res.status(400).json({ error: 'order_ids array is required' })
    }

    // Get orders to check permissions
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        buyer_id,
        status,
        order_items(
          listings(seller_id)
        )
      `)
      .in('id', order_ids)

    if (ordersError) throw ordersError

    // Filter orders user has permission to complete
    const allowedOrderIds = []
    
    orders.forEach(order => {
      const isBuyer = order.buyer_id === req.user.id
      const isSeller = order.order_items.some(item => item.listings.seller_id === req.user.id)
      const isAdmin = req.user.role === 'admin'

      if (isBuyer || isSeller || isAdmin) {
        allowedOrderIds.push(order.id)
      }
    })

    if (allowedOrderIds.length === 0) {
      return res.status(403).json({ error: 'No orders found that you can complete' })
    }

    // Update all allowed orders to completed
    const { data: updatedOrders, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .in('id', allowedOrderIds)
      .neq('status', 'completed') // Only update orders that aren't already completed
      .select()

    if (updateError) throw updateError

    // Trigger price recalculation for all completed orders
    if (updatedOrders && updatedOrders.length > 0) {
      console.log(`📊 ${updatedOrders.length} orders marked as completed, triggering price recalculations...`)
      
      updatedOrders.forEach(order => {
        marketPriceService.onOrderCompleted(order.id).catch(error => {
          console.error(`❌ Error in background price recalculation for order ${order.id}:`, error)
        })
      })
    }

    res.json({
      message: `${updatedOrders.length} orders marked as completed`,
      updated_orders: updatedOrders
    })

  } catch (error) {
    console.error('Error bulk completing orders:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get market price statistics (admin endpoint)
router.get('/admin/market-price-stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = await marketPriceService.getMarketPriceStats()
    res.json(stats)
  } catch (error) {
    console.error('Error getting market price stats:', error)
    res.status(500).json({ error: error.message })
  }
})

// Manual price recalculation endpoint (admin only)
router.post('/admin/recalculate-prices', authenticateAdmin, async (req, res) => {
  try {
    const { 
      card_ids = null, 
      only_cards_with_sales = false,
      batch_size = 50 
    } = req.body

    console.log('🔄 Manual price recalculation triggered by admin...')

    const result = await marketPriceService.calculateAllMarketPrices({
      cardIds: card_ids,
      onlyCardsWithSales: only_cards_with_sales,
      batchSize: batch_size
    })

    res.json({
      message: 'Price recalculation completed',
      ...result
    })

  } catch (error) {
    console.error('Error in manual price recalculation:', error)
    res.status(500).json({ error: error.message })
  }
})

// Trigger daily snapshots manually (admin only)
router.post('/admin/create-price-snapshots', authenticateAdmin, async (req, res) => {
  try {
    console.log('📸 Manual price snapshot creation triggered by admin...')
    
    const result = await marketPriceService.createDailyPriceSnapshots()

    res.json({
      message: 'Price snapshots created successfully',
      ...result
    })

  } catch (error) {
    console.error('Error creating price snapshots:', error)
    res.status(500).json({ error: error.message })
  }
})

router.post('/', authenticateUser, [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('shipping_address').isObject().withMessage('Shipping address is required'),
  body('billing_address').isObject().withMessage('Billing address is required'),
  body('subtotal').isFloat({ min: 0 }).withMessage('Valid subtotal required'),
  body('shipping_cost').isFloat({ min: 0 }).withMessage('Valid shipping cost required'),
  body('tax_amount').isFloat({ min: 0 }).withMessage('Valid tax amount required'),
  body('total_amount').isFloat({ min: 0.01 }).withMessage('Valid total amount required')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() })
    }

    const {
      items,
      shipping_address,
      billing_address,
      subtotal,
      shipping_cost,
      tax_amount,
      total_amount
    } = req.body

    // Validate all items exist and are available
    const itemIds = items.map(item => item.listing_id)
    const { data: listings, error: listingError } = await supabase
      .from('listings')
      .select(`
        id,
        price,
        quantity,
        status,
        seller_id,
        cards(id, name)
      `)
      .in('id', itemIds)
      .eq('status', 'active')

    if (listingError) {
      console.error('Error fetching listings:', listingError)
      return res.status(500).json({ error: 'Failed to validate items' })
    }

    // Check if all items are still available
    for (const item of items) {
      const listing = listings.find(l => l.id === item.listing_id)
      if (!listing) {
        return res.status(400).json({ 
          error: `Item is no longer available`,
          unavailableItem: item.listing_id 
        })
      }
      if (listing.quantity < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient quantity for ${listing.cards.name}. Available: ${listing.quantity}, Requested: ${item.quantity}` 
        })
      }
      if (listing.seller_id === req.user.id) {
        return res.status(400).json({ 
          error: 'Cannot purchase your own items' 
        })
      }
    }

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        buyer_id: req.user.id,
        status: 'pending',
        payment_status: 'pending',
        subtotal: subtotal,
        shipping_cost: shipping_cost,
        tax_amount: tax_amount,
        total_amount: total_amount,
        currency: 'CAD',
        shipping_address: shipping_address,
        billing_address: billing_address,
        created_at: new Date(),
        updated_at: new Date()
      }])
      .select()
      .single()

    if (orderError) {
      console.error('Error creating order:', orderError)
      return res.status(500).json({ error: 'Failed to create order' })
    }

    // Create order items
    const orderItems = items.map(item => {
      const listing = listings.find(l => l.id === item.listing_id)
      return {
        order_id: order.id,
        listing_id: item.listing_id,
        quantity: item.quantity,
        price_at_time: listing.price,
        seller_id: listing.seller_id,
        created_at: new Date()
      }
    })

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      console.error('Error creating order items:', itemsError)
      // Rollback order creation
      await supabase.from('orders').delete().eq('id', order.id)
      return res.status(500).json({ error: 'Failed to create order items' })
    }

    res.status(201).json({
      success: true,
      order: {
        id: order.id,
        status: order.status,
        total_amount: order.total_amount,
        currency: order.currency
      }
    })
  } catch (error) {
    console.error('Order creation error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Process payment for an order
router.post('/process-payment', authenticateUser, [
  body('payment_intent_id').notEmpty().withMessage('Payment intent ID required'),
  body('order_id').isUUID().withMessage('Valid order ID required'),
  body('card_number').notEmpty().withMessage('Card number required'),
  body('expiry_month').isInt({ min: 1, max: 12 }).withMessage('Valid expiry month required'),
  body('expiry_year').isInt({ min: 2024, max: 2040 }).withMessage('Valid expiry year required'),
  body('cvc').notEmpty().withMessage('CVC required'),
  body('cardholder_name').notEmpty().withMessage('Cardholder name required')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() })
    }

    const {
      payment_intent_id,
      order_id,
      card_number,
      expiry_month,
      expiry_year,
      cvc,
      cardholder_name
    } = req.body

    // Verify order belongs to user and is pending
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .eq('buyer_id', req.user.id)
      .eq('status', 'pending')
      .eq('payment_status', 'pending')
      .single()

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found or not eligible for payment' })
    }

    // Process payment with Helcim
    try {
      const paymentResult = await helcimService.processPayment({
        paymentIntentId: payment_intent_id,
        cardNumber: card_number,
        expiryMonth: expiry_month,
        expiryYear: expiry_year,
        cvc: cvc,
        cardholderName: cardholder_name,
        amount: order.total_amount
      })

      if (paymentResult.success) {
        // Update order status
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: 'processing',
            payment_status: 'completed',
            helcim_transaction_id: paymentResult.transactionId,
            paid_at: new Date(),
            updated_at: new Date()
          })
          .eq('id', order_id)

        if (updateError) {
          console.error('Error updating order:', updateError)
          return res.status(500).json({ error: 'Payment processed but order update failed' })
        }

        // Update listing quantities
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('listing_id, quantity')
          .eq('order_id', order_id)

        for (const item of orderItems) {
          await supabase
            .from('listings')
            .update({
              quantity: supabase.sql`quantity - ${item.quantity}`,
              updated_at: new Date()
            })
            .eq('id', item.listing_id)
        }

        // Clear user's cart
        await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', req.user.id)

        res.json({
          success: true,
          order: {
            id: order.id,
            status: 'processing',
            payment_status: 'completed',
            transaction_id: paymentResult.transactionId
          }
        })
      } else {
        // Payment failed
        res.status(400).json({
          success: false,
          error: paymentResult.error || 'Payment failed'
        })
      }
    } catch (paymentError) {
      console.error('Helcim payment error:', paymentError)
      res.status(500).json({
        success: false,
        error: 'Payment processing failed'
      })
    }
  } catch (error) {
    console.error('Payment processing error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})


export default router