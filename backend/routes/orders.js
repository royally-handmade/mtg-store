import express from 'express'
import { supabase, supabaseAdmin } from '../server.js'
import { authenticateUser, authenticateAdmin } from '../middleware/auth.js'
import { marketPriceService } from '../services/marketPriceService.js'
import helcimService from '../services/helcimService.js'
import { body, validationResult } from 'express-validator'

const router = express.Router()

router.get('/', authenticateUser, async (req, res) => {
  try {
    const { 
      status = 'all',
      page = 1,
      limit = 20,
      start_date,
      end_date,
      sort = 'created_at',
      order = 'desc'
    } = req.query

    let query = supabase
      .from('orders')
      .select(`
        *,
        buyer:buyer_id(display_name, email),
        order_items(
          *,
          listings(
            *,
            cards(name, set_name, set_number, card_number, image_url, treatment),
            seller:seller_id(id, display_name)
          )
        )
      `, { count: 'exact' })
      .eq('buyer_id', req.user.id)

    // Apply filters
    if (status !== 'all') {
      query = query.eq('status', status)
    }
    if (start_date) {
      query = query.gte('created_at', start_date)
    }
    if (end_date) {
      query = query.lte('created_at', end_date)
    }

    // Apply sorting
    query = query.order(sort, { ascending: order === 'asc' })

    // Apply pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data: orders, count, error } = await query

    if (error) throw error

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

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
    // ✅ This will now use the materialized view
    const stats = await marketPriceService.getMarketPriceStats()
    
    // Add view metadata
    res.json({
      ...stats,
      source: 'materialized_view',
      note: 'Data is refreshed every 15 minutes'
    })
  } catch (error) {
    console.error('Error getting market price stats:', error)
    res.status(500).json({ error: error.message })
  }
})

// Manual price recalculation endpoint (admin only)
// Manual refresh of market price stats (admin only)
router.post('/admin/refresh-market-price-stats', authenticateAdmin, async (req, res) => {
  try {
    console.log('🔄 Manual refresh of market_price_stats triggered by admin...')
    
    const startTime = Date.now()
    
    // Trigger refresh
    const { error } = await supabase.rpc('refresh_market_price_stats_view')
    
    if (error) throw error
    
    const duration = Date.now() - startTime
    
    // Get fresh stats
    const stats = await marketPriceService.getMarketPriceStats()
    
    res.json({
      message: 'Market price stats refreshed successfully',
      duration_ms: duration,
      stats
    })
    
  } catch (error) {
    console.error('Error refreshing market price stats:', error)
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

router.post('/process-and-create-order', authenticateUser, [
  body('payment_intent_id').notEmpty().withMessage('Payment intent ID required'),
  body('card_number').notEmpty().withMessage('Card number required'),
  body('expiry_month').isInt({ min: 1, max: 12 }).withMessage('Valid expiry month required'),
  body('expiry_year').isInt({ min: 2024, max: 2040 }).withMessage('Valid expiry year required'),
  body('cvc').notEmpty().withMessage('CVC required'),
  body('cardholder_name').notEmpty().withMessage('Cardholder name required'),
  body('order_data').isObject().withMessage('Order data required')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() })
    }

    const {
      payment_intent_id,
      card_number,
      expiry_month,
      expiry_year,
      cvc,
      cardholder_name,
      order_data
    } = req.body

    const {
      items,
      shipping_address,
      billing_address,
      subtotal,
      shipping_cost,
      tax_amount,
      total_amount,
      shipping_details
    } = order_data

    // Validate all items exist and are available BEFORE processing payment
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

    // Validate items availability
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

    // Process payment FIRST - no order created yet
    let paymentResult
    try {
      paymentResult = await helcimService.processPayment({
        paymentIntentId: payment_intent_id,
        cardNumber: card_number,
        expiryMonth: expiry_month,
        expiryYear: expiry_year,
        cvc: cvc,
        cardholderName: cardholder_name,
        amount: total_amount
      })

      if (!paymentResult.success) {
        // Payment failed - return error without creating order
        return res.status(400).json({
          success: false,
          error: paymentResult.error || 'Payment failed',
          paymentStatus: paymentResult.status
        })
      }
    } catch (paymentError) {
      console.error('Payment processing error:', paymentError)
      return res.status(500).json({
        success: false,
        error: 'Payment processing failed',
        details: paymentError.message
      })
    }

    // Payment successful - now create order
    let order
    try {
      const { data: createdOrder, error: orderError } = await supabase
        .from('orders')
        .insert([{
          buyer_id: req.user.id,
          status: 'processing', // Start as processing since payment is already successful
          payment_status: 'completed',
          helcim_transaction_id: paymentResult.transactionId,
          subtotal: subtotal,
          shipping_cost: shipping_cost,
          tax_amount: tax_amount,
          total_amount: total_amount,
          currency: 'CAD',
          shipping_address: shipping_address,
          billing_address: billing_address,
          shipping_details: shipping_details,
          paid_at: new Date(),
          created_at: new Date(),
          updated_at: new Date()
        }])
        .select()
        .single()

      if (orderError) {
        console.error('Error creating order after successful payment:', orderError)

        // Use recovery service to handle this critical situation
        await paymentRecoveryService.handlePaymentSuccessOrderFailure({
          transactionId: paymentResult.transactionId,
          userId: req.user.id,
          amount: total_amount,
          currency: 'CAD',
          paymentIntentId: payment_intent_id,
          error: orderError
        })

        return res.status(500).json({
          error: 'Order creation failed after payment. Our team has been notified and will resolve this immediately.',
          transactionId: paymentResult.transactionId,
          critical: true,
          supportMessage: 'Please save your transaction ID and contact support if you need immediate assistance.'
        })
      }

      order = createdOrder
    } catch (orderCreationError) {
      console.error('Order creation error:', orderCreationError)

      // Handle critical error with recovery service
      await paymentRecoveryService.handlePaymentSuccessOrderFailure({
        transactionId: paymentResult.transactionId,
        userId: req.user.id,
        amount: total_amount,
        currency: 'CAD',
        paymentIntentId: payment_intent_id,
        error: orderCreationError
      })

      return res.status(500).json({
        error: 'Technical issue occurred after payment processing. Our team is resolving this now.',
        transactionId: paymentResult.transactionId,
        critical: true,
        supportMessage: 'Your payment was successful. Please keep this transaction ID for reference.'
      })
    }

    // Create order items
    try {
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
        // Order and payment already successful, so we need to handle this gracefully
        // Could mark order as needing manual review
        await supabase
          .from('orders')
          .update({
            status: 'needs_review',
            notes: 'Order items creation failed - requires manual review',
            updated_at: new Date()
          })
          .eq('id', order.id)

        return res.status(500).json({
          error: 'Order created but items processing failed. Support has been notified.',
          orderId: order.id,
          transactionId: paymentResult.transactionId
        })
      }
    } catch (itemsCreationError) {
      console.error('Order items creation error:', itemsCreationError)
      return res.status(500).json({
        error: 'Order created but items processing failed',
        orderId: order.id,
        transactionId: paymentResult.transactionId
      })
    }

    // Update listing quantities
    try {
      for (const item of items) {
        await supabase
          .from('listings')
          .update({
            quantity: supabase.sql`quantity - ${item.quantity}`,
            updated_at: new Date()
          })
          .eq('id', item.listing_id)
      }
    } catch (quantityUpdateError) {
      console.error('Error updating listing quantities:', quantityUpdateError)
      // Non-critical - order is created, we can handle this later
    }

    // Clear user's cart
    try {
      await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', req.user.id)
    } catch (cartClearError) {
      console.error('Error clearing cart:', cartClearError)
      // Non-critical - user can manually clear cart
    }

    // Return success response
    res.json({
      success: true,
      order: {
        id: order.id,
        status: order.status,
        payment_status: order.payment_status,
        transaction_id: paymentResult.transactionId,
        total_amount: order.total_amount,
        created_at: order.created_at
      },
      payment: {
        transaction_id: paymentResult.transactionId,
        amount: paymentResult.amount,
        status: paymentResult.status
      }
    })

  } catch (error) {
    console.error('Payment and order creation error:', error)
    res.status(500).json({ error: 'Internal server error during checkout' })
  }
})

// Simplified payment intent creation (no order dependency)
router.post('/create-intent', [
  body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount required'),
  body('currency').optional().isIn(['CAD', 'USD']).withMessage('Currency must be CAD or USD'),
  body('items').isArray({ min: 1 }).withMessage('Items required for intent creation')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() })
    }

    const {
      amount,
      currency = 'CAD',
      billing_address,
      shipping_address,
      items,
      subtotal,
      shipping_cost,
      tax_amount
    } = req.body

    // Generate a temporary order ID for the payment intent
    const tempOrderId = `temp_${Date.now()}_${req.user.id}`

    // Create description from items
    const itemNames = items.slice(0, 3).map(item => `Item ${item.listing_id}`)
    const description = `MTG Cards: ${itemNames.join(', ')}${items.length > 3 ? ` +${items.length - 3} more` : ''}`

    // Create payment intent with Helcim
    const paymentIntent = await helcimService.createPaymentIntent({
      amount: amount,
      currency: currency,
      orderId: tempOrderId,
      buyerId: req.user.id,
      description: description,
      billingAddress: billing_address,
      shippingAddress: shipping_address
    })

    res.json({
      success: true,
      payment_intent: paymentIntent,
      summary: {
        subtotal,
        shipping_cost,
        tax_amount,
        total_amount: amount,
        currency
      }
    })
  } catch (error) {
    console.error('Payment intent creation failed:', error)
    res.status(500).json({ error: error.message })
  }
})

router.get('/:orderId', authenticateUser, async (req, res) => {
  try {
    const { orderId } = req.params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID format' })
    }

    // Fetch order with all related data
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          listings (
            *,
            cards (
              id,
              name,
              set_name,
              image_url,
              rarity
            ),
            profiles:seller_id (
              id,
              display_name,
              rating
            )
          )
        )
      `)
      .eq('id', orderId)
      .eq('buyer_id', req.user.id) // Ensure user can only see their own orders
      .single()
      
      console.log(order)

    if (orderError) {
      console.error('Order fetch error:', orderError)
      if (orderError.code === 'PGRST116') { // No rows returned
        return res.status(404).json({ error: 'Order not found' })
      }
      return res.status(500).json({ error: 'Failed to fetch order details' })
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    // Transform the order data for frontend consumption
    const transformedOrder = {
      id: order.id,
      number: order.order_number,
      status: order.status,
      payment_status: order.payment_status,
      subtotal: parseFloat(order.subtotal || 0),
      shipping_cost: parseFloat(order.shipping_cost || 0),
      tax_amount: parseFloat(order.tax_amount || 0),
      total_amount: parseFloat(order.total_amount || 0),
      currency: order.currency,
      shipping_address: order.shipping_address,
      billing_address: order.billing_address,
      payment_method: order.payment_method,
      card_last_four: order.card_last_four,
      helcim_transaction_id: order.helcim_transaction_id,
      tracking_number: order.tracking_number,
      created_at: order.created_at,
      updated_at: order.updated_at,
      paid_at: order.paid_at,
      shipped_at: order.shipped_at,
      delivered_at: order.delivered_at,
      notes: order.notes,
      requires_manual_review: order.requires_manual_review,

      // Transform order items with full details
      order_items: (order.order_items || []).map(item => ({
        id: item.id,
        quantity: item.quantity,
        price_at_time: parseFloat(item.price_at_time || 0),
        created_at: item.created_at,
        listings: item.listings ? {
          id: item.listings.id,
          condition: item.listings.condition,
          language: item.listings.language,
          foil: item.listings.foil,
          signed: item.listings.signed,
          cards: item.listings.cards ? {
            id: item.listings.cards.id,
            name: item.listings.cards.name,
            set_name: item.listings.cards.set_name,
            image_url: item.listings.cards.image_url,
            rarity: item.listings.cards.rarity
          } : null,
          profiles: item.listings.profiles ? {
            id: item.listings.profiles.id,
            display_name: item.listings.profiles.display_name,
            rating: item.listings.profiles.rating
          } : null
        } : null
      }))
    }

    res.json({
      success: true,
      order: transformedOrder
    })

  } catch (error) {
    console.error('Error fetching single order:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Alternative endpoint for admin access (can view any order)
router.get('/admin/:orderId', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID format' })
    }

    // Fetch order with buyer information (admin can see any order)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        buyer:buyer_id (
          id,
          display_name,
          email,
          created_at
        ),
        order_items (
          *,
          listings (
            *,
            cards (
              id,
              name,
              set_name,
              image_url,
              rarity
            ),
            profiles:seller_id (
              id,
              display_name,
              rating
            )
          )
        )
      `)
      .eq('id', orderId)
      .single()

    if (orderError) {
      console.error('Admin order fetch error:', orderError)
      if (orderError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Order not found' })
      }
      return res.status(500).json({ error: 'Failed to fetch order details' })
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    // Transform order data (similar to user endpoint but includes buyer info)
    const transformedOrder = {
      id: order.id,
      status: order.status,
      payment_status: order.payment_status,
      subtotal: parseFloat(order.subtotal || 0),
      shipping_cost: parseFloat(order.shipping_cost || 0),
      tax_amount: parseFloat(order.tax_amount || 0),
      total_amount: parseFloat(order.total_amount || 0),
      currency: order.currency,
      shipping_address: order.shipping_address,
      billing_address: order.billing_address,
      payment_method: order.payment_method,
      card_last_four: order.card_last_four,
      helcim_transaction_id: order.helcim_transaction_id,
      tracking_number: order.tracking_number,
      created_at: order.created_at,
      updated_at: order.updated_at,
      paid_at: order.paid_at,
      shipped_at: order.shipped_at,
      delivered_at: order.delivered_at,
      notes: order.notes,
      requires_manual_review: order.requires_manual_review,

      // Include buyer information for admin
      buyer: order.buyer ? {
        id: order.buyer.id,
        display_name: order.buyer.display_name,
        email: order.buyer.email,
        created_at: order.buyer.created_at
      } : null,

      // Transform order items
      order_items: (order.order_items || []).map(item => ({
        id: item.id,
        quantity: item.quantity,
        price_at_time: parseFloat(item.price_at_time || 0),
        seller_id: item.seller_id,
        created_at: item.created_at,
        listings: item.listings ? {
          id: item.listings.id,
          condition: item.listings.condition,
          language: item.listings.language,
          foil: item.listings.foil,
          signed: item.listings.signed,
          price: item.listings.price,
          cards: item.listings.cards ? {
            id: item.listings.cards.id,
            name: item.listings.cards.name,
            set_name: item.listings.cards.set_name,
            image_url: item.listings.cards.image_url,
            rarity: item.listings.cards.rarity
          } : null,
          profiles: item.listings.profiles ? {
            id: item.listings.profiles.id,
            display_name: item.listings.profiles.display_name,
            rating: item.listings.profiles.rating
          } : null
        } : null
      }))
    }

    res.json({
      success: true,
      order: transformedOrder
    })

  } catch (error) {
    console.error('Error fetching admin order:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Middleware function for admin requirement
function requireAdmin(req, res, next) {
  // This should be implemented based on your auth system
  // Example implementation:
  if (req.user && req.user.role === 'admin') {
    next()
  } else {
    res.status(403).json({ error: 'Admin access required' })
  }
}


export default router