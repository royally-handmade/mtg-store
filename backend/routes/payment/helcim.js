// backend/routes/payment/helcim.js
// HelcimPay.js integration for PCI-compliant payment processing

import express from 'express'
import { supabase } from '../../server.js'
import helcimService from '../../services/helcimService.js'
import paymentRecoveryService from '../../services/paymentRecoveryService.js'
import { authenticateUser } from '../../middleware/auth.js'
import { body, validationResult } from 'express-validator'

const router = express.Router()

// ===== HELCIMPAY.JS INTEGRATION =====

// Initialize HelcimPay.js checkout session
router.post('/initialize', authenticateUser, [
    body('paymentType').isIn(['purchase', 'preauth', 'verify']).withMessage('Valid payment type required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount required'),
    body('currency').optional().isIn(['CAD', 'USD']).withMessage('Currency must be CAD or USD'),
    body('items').isArray({ min: 1 }).withMessage('Items required'),
    body('shipping_address').isObject().withMessage('Shipping address required'),
    body('billing_address').isObject().withMessage('Billing address required')
], async (req, res) => {
    try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Validation failed', details: errors.array() })
        }

        const {
            paymentType = 'purchase',
            amount,
            currency = 'CAD',
            items,
            shipping_address,
            billing_address,
            subtotal,
            shipping_cost,
            tax_amount,
            customer
        } = req.body

        // Validate items are still available
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
            return res.status(500).json({ error: 'Failed to validate items' })
        }

        // Check item availability
        for (const item of items) {
            const listing = listings.find(l => l.id === item.listing_id)
            if (!listing) {
                return res.status(400).json({
                    error: `Item "${item.name}" is no longer available`
                })
            }
            if (listing.quantity < item.quantity) {
                return res.status(400).json({
                    error: `Insufficient quantity for "${listing.cards.name}". Available: ${listing.quantity}`
                })
            }
        }

        // Generate unique order reference for this checkout session
        const orderReference = `checkout_${Date.now()}_${req.user.id}`

        // Create order description
        const itemNames = items.slice(0, 3).map(item => item.name || 'MTG Card')
        const description = `MTG Cards: ${itemNames.join(', ')}${items.length > 3 ? ` +${items.length - 3} more` : ''}`

        // Initialize HelcimPay session using proper service
        const sessionResult = await helcimService.initializeCheckoutSession({
            paymentType: paymentType,
            amount: Math.round((amount + Number.EPSILON) * 100) / 100,
            currency: currency,
            orderNumber: orderReference,
            description: description,

            // Customer information
            customer: {
                customerCode: req.user.id,
                name: customer?.name || shipping_address.name,
                email: customer?.email || req.user.email,
                phone: shipping_address.phone
            },

            // Address information
            billingAddress: {
                name: billing_address.name,
                street1: billing_address.street1,
                street2: billing_address.street2,
                city: billing_address.city,
                province: billing_address.province,
                country: billing_address.country,
                postalCode: billing_address.postalCode,
                phone: shipping_address.phone,
                email: customer?.email || req.user.email
            },

            shippingAddress: {
                name: shipping_address.name,
                street1: shipping_address.street1,
                street2: shipping_address.street2,
                city: shipping_address.city,
                province: shipping_address.province,
                country: shipping_address.country,
                postalCode: shipping_address.postalCode,
                phone: shipping_address.phone
            },

            // Tax information
            taxAmount: Math.round(tax_amount * 100) / 100,

            // UI customization
            uiCustomization: {
                displayName: 'MTG Marketplace',
                logoUrl: process.env.COMPANY_LOGO_URL || '',
                primaryColor: '#059669',
                backgroundColor: '#ffffff'
            }
        })

        // Store checkout session data for later verification
        const { error: sessionError } = await supabase
            .from('checkout_sessions')
            .insert([{
                checkout_token: sessionResult.checkoutToken,
                user_id: req.user.id,
                order_reference: orderReference,
                amount: amount,
                currency: currency,
                status: 'initialized',
                session_data: {
                    items,
                    shipping_address,
                    billing_address,
                    subtotal,
                    shipping_cost,
                    tax_amount,
                    secretToken: sessionResult.secretToken // Store for validation
                },
                expires_at: new Date(Date.now() + 60 * 60 * 1000), // 60 minutes
                created_at: new Date()
            }])

        if (sessionError) {
            console.error('Failed to store checkout session:', sessionError)
            // Continue anyway - not critical for payment processing
        }

        res.json({
            success: true,
            checkoutToken: sessionResult.checkoutToken,
            orderReference: orderReference,
            amount: amount,
            currency: currency,
            expiresIn: sessionResult.expiresIn
        })

    } catch (error) {
        console.error('HelcimPay initialization error:', error)
        res.status(500).json({
            error: 'Failed to initialize secure payment',
            message: error.message
        })
    }
})

// Complete order after successful HelcimPay payment
router.post('/complete-order', authenticateUser, [
    body('checkoutToken').notEmpty().withMessage('Checkout token required'),
    body('paymentResponse').isObject().withMessage('Payment response required'),
    body('order_data').isObject().withMessage('Order data required')
], async (req, res) => {
    try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Validation failed', details: errors.array() })
        }

        const { checkoutToken, paymentResponse, order_data } = req.body

        // Retrieve checkout session with secret token
        const { data: session, error: sessionError } = await supabase
            .from('checkout_sessions')
            .select('*')
            .eq('checkout_token', checkoutToken)
            .eq('user_id', req.user.id)
            .eq('status', 'initialized')
            .single()

        if (sessionError || !session) {
            return res.status(400).json({ error: 'Invalid or expired checkout session' })
        }

        // Extract secret token from session data
        const secretToken = session.session_data.secretToken
        if (!secretToken) {
            return res.status(400).json({ error: 'Session missing validation token' })
        }

        // Validate and process payment using proper HelcimService
        const processedTransaction = await helcimService.processTransactionResponse(
            checkoutToken,
            paymentResponse,
            secretToken
        )

        if (!processedTransaction.success) {
            return res.status(400).json({
                error: 'Payment validation failed',
                details: processedTransaction.validation?.error
            })
        }

        const transaction = processedTransaction.transaction

        // Verify transaction status
        if (transaction.status !== 'APPROVED') {
            return res.status(400).json({
                error: 'Payment was not approved',
                status: transaction.status
            })
        }

        // Create order with verified payment information
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert([{
                buyer_id: req.user.id,
                status: 'processing',
                payment_status: 'completed',
                helcim_transaction_id: transaction.transactionId,
                //helcim_checkout_token: checkoutToken,
                subtotal: order_data.subtotal,
                shipping_cost: order_data.shipping_cost,
                tax_amount: order_data.tax_amount,
                total_amount: order_data.total_amount,
                currency: session.currency,
                shipping_address: order_data.shipping_address,
                billing_address: order_data.billing_address,
                // shipping_details: order_data.shipping_details,
                //payment_method: transaction.cardType || 'credit_card',
                //card_last_four: transaction.cardLast4,
                paid_at: new Date(transaction.dateCreated),
                created_at: new Date(),
                updated_at: new Date()
            }])
            .select()
            .single()

        if (orderError) {
            console.error('Order creation failed after successful payment:', orderError)

            // Use payment recovery service for critical error handling
            try {
                await paymentRecoveryService.handlePaymentSuccessOrderFailure({
                    transactionId: transaction.transactionId,
                    userId: req.user.id,
                    amount: order_data.total_amount,
                    currency: session.currency,
                    paymentIntentId: checkoutToken,
                    error: orderError,
                    orderData: order_data
                })
            } catch (recoveryError) {
                console.error('Payment recovery also failed:', recoveryError)
            }

            return res.status(500).json({
                error: 'Order creation failed. Our team has been notified and will resolve this immediately.',
                transactionId: transaction.transactionId,
                critical: true,
                supportMessage: 'Please save your transaction ID and contact support.'
            })
        }

        // Create order items
        try {
            const { data: listings } = await supabase
                .from('listings')
                .select('id, price, seller_id, cards(name)')
                .in('id', order_data.items.map(item => item.listing_id))

            const orderItems = order_data.items.map(item => {
                const listing = listings.find(l => l.id === item.listing_id)
                return {
                    order_id: order.id,
                    listing_id: item.listing_id,
                    quantity: item.quantity,
                    price: listing.price,
                    created_at: new Date()
                }
            })

            console.log(orderItems)

            const items = await supabase.from('order_items').insert(orderItems).select()
            console.log(items)

            // Update listing quantities
            for (const item of orderItems) {


                const { data: ret, error } = await supabase
                    .rpc('reduce_listing_quantity',
                        {
                            "listing_id": item.listing_id,
                            "p_reduce_quantity": item.quantity
                        });

                if (error) { console.log(error) } else { console.log(ret) }
            }

        } catch (itemsError) {
            console.error('Order items creation error:', itemsError)
            // Order exists, mark for manual review
            await supabase
                .from('orders')
                .update({
                    requires_manual_review: true,
                    notes: 'Order items creation failed - requires admin attention'
                })
                .eq('id', order.id)
        }

        // Update checkout session status
        await supabase
            .from('checkout_sessions')
            .update({
                status: 'completed',
                order_id: order.id,
                completed_at: new Date()
            })
            .eq('checkout_token', checkoutToken)

        // Clear user's cart
        try {
            await supabase.from('cart_items').delete().eq('user_id', req.user.id)
        } catch (cartError) {
            console.error('Cart clearing error:', cartError)
            // Non-critical
        }

        res.json({
            success: true,
            order: {
                id: order.id,
                status: order.status,
                payment_status: order.payment_status,
                total_amount: order.total_amount,
                transaction_id: transaction.transactionId,
                card_last_four: transaction.cardLast4,
                payment_method: transaction.cardType
            },
            transaction: {
                id: transaction.transactionId,
                status: transaction.status,
                approvalCode: transaction.approvalCode
            }
        })

    } catch (error) {
        console.error('Order completion error:', error)
        res.status(500).json({
            error: 'Failed to complete order',
            message: error.message
        })
    }
})

// Webhook endpoint for HelcimPay notifications
router.post('/webhook', async (req, res) => {
    try {
        const signature = req.headers['helcim-signature'] || req.headers['x-helcim-signature']
        const payload = JSON.stringify(req.body)

        // Verify webhook signature using proper HelcimService
        if (!helcimService.verifyWebhookSignature(payload, signature)) {
            console.error('Invalid webhook signature received')
            return res.status(401).json({ error: 'Invalid signature' })
        }

        // Process webhook using HelcimService
        await helcimService.processWebhook(req.body)

        res.json({ received: true })

    } catch (error) {
        console.error('Webhook processing error:', error)
        res.status(500).json({ error: 'Webhook processing failed' })
    }
})

// Validate transaction endpoint (for additional verification)
router.post('/validate', authenticateUser, [
    body('transactionData').isObject().withMessage('Transaction data required'),
    body('secretToken').notEmpty().withMessage('Secret token required'),
    body('helcimHash').notEmpty().withMessage('Helcim hash required')
], async (req, res) => {
    try {
        const { transactionData, secretToken, helcimHash } = req.body

        const validation = helcimService.validateTransactionResponse(
            transactionData,
            secretToken,
            helcimHash
        )

        res.json({
            success: true,
            isValid: validation.isValid,
            validation: validation
        })

    } catch (error) {
        console.error('Transaction validation error:', error)
        res.status(500).json({
            error: 'Validation failed',
            message: error.message
        })
    }
})

export default router