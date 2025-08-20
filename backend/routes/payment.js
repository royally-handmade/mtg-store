import express from 'express'
import Stripe from 'stripe'
import { supabase } from '../server.js'

const router = express.Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Create payment intent for Helcim integration
router.post('/create-intent', async (req, res) => {
  try {
    const { amount, currency = 'cad', order_id } = req.body
    
    // This would integrate with Helcim API
    // For now, using Stripe as placeholder
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata: {
        order_id: order_id
      }
    })
    
    res.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Handle payment confirmation
router.post('/confirm', async (req, res) => {
  try {
    const { payment_intent_id, order_id } = req.body
    
    // Verify payment with Helcim/Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id)
    
    if (paymentIntent.status === 'succeeded') {
      // Update order status
      const { data, error } = await supabase
        .from('orders')
        .update({ 
          status: 'processing',
          payment_intent_id: payment_intent_id,
          updated_at: new Date()
        })
        .eq('id', order_id)
        .select()
      
      if (error) throw error
      
      // Update listing quantities
      await updateListingQuantities(order_id)
      
      res.json({ success: true, order: data[0] })
    } else {
      res.status(400).json({ error: 'Payment not successful' })
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Process seller payouts
router.post('/process-payouts', async (req, res) => {
  try {
    // Get all completed orders that haven't been paid out
    const { data: orders } = await supabase
      .from('orders')
      .select(`
        *,
        seller:seller_id(id, display_name),
        payout_settings:seller_id(*)
      `)
      .eq('status', 'delivered')
      .eq('payout_processed', false)
    
    const payoutResults = []
    
    for (const order of orders) {
      const sellerAmount = order.subtotal * 0.975 // 97.5% after 2.5% platform fee
      
      if (sellerAmount >= 25) { // Minimum payout threshold
        // Process payout via configured method
        const payoutResult = await processSinglePayout(order.seller_id, sellerAmount, order.payout_settings)
        payoutResults.push(payoutResult)
        
        // Mark order as paid out
        await supabase
          .from('orders')
          .update({ payout_processed: true, payout_date: new Date() })
          .eq('id', order.id)
      }
    }
    
    res.json({ processed: payoutResults.length, results: payoutResults })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

async function updateListingQuantities(orderId) {
  try {
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('listing_id, quantity')
      .eq('order_id', orderId)
    
    for (const item of orderItems) {
      await supabase.rpc('decrease_listing_quantity', {
        listing_id: item.listing_id,
        quantity_sold: item.quantity
      })
    }
  } catch (error) {
    console.error('Error updating listing quantities:', error)
  }
}

async function processSinglePayout(sellerId, amount, payoutSettings) {
  try {
    // This would integrate with actual payout services
    // For now, just logging the payout
    console.log(`Processing payout: ${sellerId} - ${amount}`)
    
    return {
      seller_id: sellerId,
      amount: amount,
      status: 'success',
      transaction_id: `payout_${Date.now()}`
    }
  } catch (error) {
    return {
      seller_id: sellerId,
      amount: amount,
      status: 'failed',
      error: error.message
    }
  }
}

export default router