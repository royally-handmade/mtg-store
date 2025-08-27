import express from 'express'
import { supabase, supabaseAdmin } from '../server.js'
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


export default router