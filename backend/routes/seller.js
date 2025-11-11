// backend/routes/seller.js - Enhanced seller routes with approval workflow

import express from 'express'
import { supabase } from '../server.js'
import multer from 'multer'
import csv from 'csv-parser'
import { Readable } from 'stream'
import sharp from 'sharp'
import path from 'path'
import nodemailer from 'nodemailer'

const router = express.Router()

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10 // Max 10 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'text/csv', 'application/vnd.ms-excel']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type'))
    }
  }
})

// Apply for seller status
router.post('/apply', async (req, res) => {
  try {
    const {
      business_name,
      business_type, // individual, business, corporation
      tax_id,
      address,
      phone,
      description,
      experience_years,
      references
    } = req.body

    // Check if user already applied
    const { data: existingApp } = await supabase
      .from('seller_applications')
      .select('*')
      .eq('user_id', req.user.id)
      .single()

    if (existingApp) {
      return res.status(400).json({ error: 'Application already submitted' })
    }

    // Create seller application
    const { data, error } = await supabase
      .from('seller_applications')
      .insert({
        user_id: req.user.id,
        business_name,
        business_type,
        tax_id,
        address,
        phone,
        description,
        experience_years: parseInt(experience_years),
        references,
        status: 'pending',
        submitted_at: new Date()
      })
      .select()

    if (error) throw error

    // Update profile to indicate application submitted
    await supabase
      .from('profiles')
      .update({ 
        seller_application_status: 'pending',
        updated_at: new Date()
      })
      .eq('id', req.user.id)

    res.json({ 
      message: 'Seller application submitted successfully',
      application: data[0]
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Upload verification documents
router.post('/upload-documents', upload.array('documents', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' })
    }

    const documents = []

    for (const file of req.files) {
      // Process and compress image files
      let processedBuffer = file.buffer
      if (file.mimetype.startsWith('image/')) {
        processedBuffer = await sharp(file.buffer)
          .resize(1200, 1600, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer()
      }

      // Upload to Supabase storage
      const fileName = `seller-docs/${req.user.id}/${Date.now()}-${file.originalname}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, processedBuffer, {
          contentType: file.mimetype
        })

      if (uploadError) throw uploadError

      // Save document record
      const { data: docData, error: docError } = await supabase
        .from('seller_documents')
        .insert({
          user_id: req.user.id,
          document_type: req.body.document_types?.[documents.length] || 'other',
          file_name: file.originalname,
          file_path: fileName,
          file_size: file.size,
          mime_type: file.mimetype,
          uploaded_at: new Date()
        })
        .select()

      if (docError) throw docError
      documents.push(docData[0])
    }

    res.json({ 
      message: 'Documents uploaded successfully',
      documents 
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get seller application status
router.get('/application-status', async (req, res) => {
  try {
    const { data: application } = await supabase
      .from('seller_applications')
      .select(`
        *,
        seller_documents(*)
      `)
      .eq('user_id', req.user.id)
      .single()

    if (!application) {
      return res.json({ status: 'not_applied' })
    }

    res.json(application)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Check if seller is approved and can create listings
const requireApprovedSeller = async (req, res, next) => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, approved, seller_application_status')
      .eq('id', req.user.id)
      .single()

    if (profile?.role == 'buyer' || !profile?.approved) {
      return res.status(403).json({ 
        error: 'Seller approval required',
        status: profile?.seller_application_status || 'not_applied'
      })
    }
    next()
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ===== LISTING MANAGEMENT (Requires Approved Seller) =====

// Create new listing
router.post('/listings', requireApprovedSeller, async (req, res) => {
  try {
    const {
      card_id,
      price,
      condition,
      quantity,
      foil
    } = req.body


    // Create listing
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .insert({
        seller_id: req.user.id,
        card_id: card_id,
        condition,
        price,
        quantity,
        status: 'active',
        foil: foil,
        created_at: new Date()
      })
      .select(`
        *,
        cards(name, set_name, card_number),
        profiles(display_name)
      `)
      .single()

    if (listingError) throw listingError

    res.json({
      message: 'Listing created successfully',
      listing
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get seller's listings with filters
router.get('/listings', requireApprovedSeller, async (req, res) => {
  try {
    const { 
      status = 'all',
      condition,
      page = 1,
      limit = 20,
      search,
      sort = 'created_at',
      order = 'desc'
    } = req.query

    let query = supabase
      .from('listings')
      .select(`
        *,
        cards(name, set_name, card_number, rarity, image_url),
        profiles(display_name)
      `, { count: 'exact' })
      .eq('seller_id', req.user.id)

    // Apply filters
    if (status !== 'all') {
      query = query.eq('status', status)
    }
    if (condition) {
      query = query.eq('condition', condition)
    }
    if (search) {
      query = query.ilike('cards.name', `%${search}%`)
    }

    // Apply sorting
    query = query.order(sort, { ascending: order === 'asc' })

    // Apply pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data: listings, count, error } = await query

    if (error) throw error

    res.json({
      listings,
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

// Update listing
router.patch('/listings/:id', requireApprovedSeller, upload.array('images', 10), async (req, res) => {
  try {
    const listingId = req.params.id

    // Verify ownership
    const { data: listing } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .eq('seller_id', req.user.id)
      .single()

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found or access denied' })
    }

    const updateData = {}
    const allowedFields = ['condition', 'quantity', 'price', 'description', 'status', 'language', 'foil', 'signed', 'altered']
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'quantity') {
          updateData[field] = parseInt(req.body[field])
        } else if (field === 'price') {
          updateData[field] = parseFloat(req.body[field])
        } else if (['foil', 'signed', 'altered'].includes(field)) {
          updateData[field] = req.body[field] === 'true'
        } else {
          updateData[field] = req.body[field]
        }
      }
    })

    // Handle new images if uploaded
    if (req.files && req.files.length > 0) {
      const newImageUrls = []
      for (const file of req.files) {
        const processedBuffer = await sharp(file.buffer)
          .resize(672, 936, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer()

        const fileName = `listings/${req.user.id}/${Date.now()}-${file.originalname}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('card-images')
          .upload(fileName, processedBuffer, {
            contentType: 'image/jpeg'
          })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('card-images')
          .getPublicUrl(fileName)

        newImageUrls.push(publicUrl)
      }

      // Combine with existing images or replace
      if (req.body.replace_images === 'true') {
        updateData.images = newImageUrls
      } else {
        updateData.images = [...(listing.images || []), ...newImageUrls]
      }
    }

    updateData.updated_at = new Date()

    const { data: updatedListing, error } = await supabase
      .from('listings')
      .update(updateData)
      .eq('id', listingId)
      .select(`
        *,
        cards(name, set_name, card_number),
        profiles(display_name)
      `)
      .single()

    if (error) throw error

    res.json({
      message: 'Listing updated successfully',
      listing: updatedListing
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete listing
router.delete('/listings/:id', requireApprovedSeller, async (req, res) => {
  try {
    const listingId = req.params.id

    // Verify ownership and no pending orders
    const { data: listing } = await supabase
      .from('listings')
      .select(`
        *,
        order_items!inner(order_id, orders!inner(status))
      `)
      .eq('id', listingId)
      .eq('seller_id', req.user.id)
      .single()

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found or access denied' })
    }

    // Check for pending orders
    const hasPendingOrders = listing.order_items.some(item => 
      ['pending', 'processing'].includes(item.orders.status)
    )

    if (hasPendingOrders) {
      return res.status(400).json({ 
        error: 'Cannot delete listing with pending or processing orders' 
      })
    }

    // Soft delete - mark as deleted instead of removing
    const { error } = await supabase
      .from('listings')
      .update({ 
        status: 'deleted',
        deleted_at: new Date(),
        updated_at: new Date()
      })
      .eq('id', listingId)

    if (error) throw error

    res.json({ message: 'Listing deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Bulk upload listings via CSV
router.post('/listings/bulk-upload', requireApprovedSeller, upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' })
    }

    const listings = []
    const errors = []
    let rowIndex = 0

    const stream = Readable.from(req.file.buffer)

    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', async (row) => {
          rowIndex++
          try {
            // Validate required fields
            const requiredFields = ['card_name', 'set_name', 'condition', 'quantity', 'price']
            const missingFields = requiredFields.filter(field => !row[field]?.trim())
            
            if (missingFields.length > 0) {
              errors.push({
                row: rowIndex,
                error: `Missing required fields: ${missingFields.join(', ')}`
              })
              return
            }

            // Find or create card
            let { data: card } = await supabase
              .from('cards')
              .select('*')
              .eq('name', row.card_name.trim())
              .eq('set_name', row.set_name.trim())
              .eq('card_number', row.card_number?.trim() || '')
              .single()

            if (!card) {
              const { data: newCard, error: cardError } = await supabase
                .from('cards')
                .insert({
                  name: row.card_name.trim(),
                  set_name: row.set_name.trim(),
                  card_number: row.card_number?.trim() || '',
                  set_number: row.set_number?.trim() || '',
                  created_at: new Date()
                })
                .select()
                .single()

              if (cardError) throw cardError
              card = newCard
            }

            listings.push({
              seller_id: req.user.id,
              card_id: card.id,
              condition: row.condition.trim(),
              language: row.language?.trim() || 'English',
              foil: row.foil?.toLowerCase() === 'true',
              signed: row.signed?.toLowerCase() === 'true',
              altered: row.altered?.toLowerCase() === 'true',
              quantity: parseInt(row.quantity),
              price: parseFloat(row.price),
              description: row.description?.trim() || '',
              status: 'active',
              created_at: new Date()
            })
          } catch (error) {
            errors.push({
              row: rowIndex,
              error: error.message
            })
          }
        })
        .on('end', resolve)
        .on('error', reject)
    })

    // Insert valid listings
    let insertedListings = []
    if (listings.length > 0) {
      const { data, error } = await supabase
        .from('listings')
        .insert(listings)
        .select()

      if (error) throw error
      insertedListings = data
    }

    res.json({
      message: 'Bulk upload completed',
      inserted: insertedListings.length,
      errors: errors.length,
      details: {
        listings: insertedListings,
        errors
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ===== ORDER MANAGEMENT =====

// Get seller orders
router.get('/orders', requireApprovedSeller, async (req, res) => {
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
            cards(name, set_name, card_number)
          )
        )
      `, { count: 'exact' })
      .eq('order_items.listings.seller_id', req.user.id)

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

// Update order status
router.patch('/orders/:id/status', requireApprovedSeller, async (req, res) => {
  try {
    const orderId = req.params.id
    const { status, tracking_number, notes } = req.body

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    // Verify ownership
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('seller_id', req.user.id)
      .single()

    if (!order) {
      return res.status(404).json({ error: 'Order not found or access denied' })
    }

    const updateData = {
      status,
      updated_at: new Date()
    }

    if (tracking_number) {
      updateData.tracking_number = tracking_number
    }
    if (notes) {
      updateData.seller_notes = notes
    }
    if (status === 'shipped') {
      updateData.shipped_at = new Date()
    }
    if (status === 'delivered') {
      updateData.delivered_at = new Date()
    }

    const { data: updatedOrder, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select(`
        *,
        buyer:buyer_id(display_name, email),
        order_items(
          *,
          listings(
            *,
            cards(name, set_name, card_number)
          )
        )
      `)
      .single()

    if (error) throw error

    // Send notification to buyer (implement notification service)
    // await NotificationService.sendOrderUpdate(updatedOrder)

    res.json({
      message: 'Order updated successfully',
      order: updatedOrder
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ===== ANALYTICS & STATS =====

// Get seller dashboard stats
router.get('/stats', requireApprovedSeller, async (req, res) => {
  try {
    const sellerId = req.user.id
    
    const [listingsRes, ordersRes, salesRes, reviewsRes] = await Promise.all([
      supabase
        .from('listings')
        .select('*', { count: 'exact' })
        .eq('seller_id', sellerId)
        .eq('status', 'active'),
      supabase
        .from('orders')
        .select(`
        *,
        buyer:buyer_id(display_name, email),
        order_items(
          *,
          listings(
            *,
            cards(name, set_name, card_number)
          )
        )
      `, { count: 'exact' })
        .eq('order_items.listings.seller_id', sellerId)
        .in('status', ['pending', 'processing']),
      supabase
        .from('orders')
        .select(`total_amount, subtotal, created_at,
           order_items(
          *,
          listings(
            *
          )
        )`)
        .eq('order_items.listings.seller_id', sellerId)
        .eq('status', 'completed'),
      supabase
        .from('seller_reviews')
        .select('rating')
        .eq('seller_id', sellerId)
    ])
    
    const totalSales = salesRes.data?.reduce((sum, order) => sum + order.subtotal, 0) || 0
    const salesCount = salesRes.data?.length || 0
    const averageRating = reviewsRes.data?.length > 0 
      ? reviewsRes.data.reduce((sum, review) => sum + review.rating, 0) / reviewsRes.data.length 
      : 0

    // Calculate monthly sales trend
    const monthlySales = {}
    salesRes.data?.forEach(order => {
      const month = new Date(order.created_at).toISOString().slice(0, 7)
      monthlySales[month] = (monthlySales[month] || 0) + order.subtotal
    })

    res.json({
      activeListings: listingsRes.count,
      pendingOrders: ordersRes.count,
      totalSales: totalSales.toFixed(2),
      salesCount,
      averageRating: averageRating.toFixed(1),
      reviewCount: reviewsRes.data?.length || 0,
      monthlySales
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Email transporter setup
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

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

// ===== SELLER APPLICATION MANAGEMENT =====

// Get all seller applications
router.get('/seller-applications', async (req, res) => {
  try {
    const { 
      status = 'all',
      page = 1,
      limit = 20,
      sort = 'submitted_at',
      order = 'desc'
    } = req.query

    let query = supabase
      .from('seller_applications')
      .select(`
        *,
        profiles(display_name, email, created_at),
        seller_documents(*)
      `, { count: 'exact' })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    query = query.order(sort, { ascending: order === 'asc' })

    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data: applications, count, error } = await query

    if (error) throw error

    res.json({
      applications,
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

// Get specific seller application details
router.get('/seller-applications/:id', async (req, res) => {
  try {
    const { data: application, error } = await supabase
      .from('seller_applications')
      .select(`
        *,
        profiles(
          display_name, 
          email, 
          created_at,
          last_login_at,
          avatar_url
        ),
        seller_documents(*),
        seller_reviews(rating, comment, created_at)
      `)
      .eq('id', req.params.id)
      .single()

    if (error) throw error
    if (!application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    // Get user's activity stats
    const { data: orderCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('buyer_id', application.user_id)

    const { data: loginHistory } = await supabase
      .from('auth_logs')
      .select('created_at, ip_address')
      .eq('user_id', application.user_id)
      .order('created_at', { ascending: false })
      .limit(10)

    res.json({
      ...application,
      activity_stats: {
        order_count: orderCount,
        login_history: loginHistory
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Download seller document
router.get('/seller-applications/:id/documents/:docId', async (req, res) => {
  try {
    const { data: document } = await supabase
      .from('seller_documents')
      .select('*')
      .eq('id', req.params.docId)
      .single()

    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    const { data: fileData, error } = await supabase.storage
      .from('documents')
      .download(document.file_path)

    if (error) throw error

    res.setHeader('Content-Type', document.mime_type)
    res.setHeader('Content-Disposition', `attachment; filename="${document.file_name}"`)
    res.send(fileData)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Approve seller application
router.post('/seller-applications/:id/approve', async (req, res) => {
  try {
    const applicationId = req.params.id
    const { notes, seller_tier = 'standard' } = req.body

    // Get application details
    const { data: application } = await supabase
      .from('seller_applications')
      .select(`
        *,
        profiles(email, display_name)
      `)
      .eq('id', applicationId)
      .single()

    if (!application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    // Start transaction-like operations
    try {
      // Update application status
      await supabase
        .from('seller_applications')
        .update({
          status: 'approved',
          approved_at: new Date(),
          approved_by: req.user.id,
          admin_notes: notes
        })
        .eq('id', applicationId)

      // Update user profile to seller
      await supabase
        .from('profiles')
        .update({
          role: 'seller',
          approved: true,
          seller_tier: seller_tier,
          seller_application_status: 'approved',
          approved_at: new Date(),
          updated_at: new Date()
        })
        .eq('id', application.user_id)

      // Create seller settings record
      await supabase
        .from('seller_settings')
        .insert({
          user_id: application.user_id,
          business_name: application.business_name,
          business_type: application.business_type,
          tax_id: application.tax_id,
          payout_method: 'bank_transfer',
          payout_threshold: 25.00,
          auto_payout: false,
          created_at: new Date()
        })

      // Log admin action
      await supabase
        .from('admin_actions')
        .insert({
          admin_id: req.user.id,
          action_type: 'seller_approved',
          target_user_id: application.user_id,
          details: {
            application_id: applicationId,
            seller_tier: seller_tier,
            notes: notes
          },
          created_at: new Date()
        })

      // Send approval email
      if (application.profiles?.email) {
        await transporter.sendMail({
          from: process.env.FROM_EMAIL,
          to: application.profiles.email,
          subject: 'Seller Application Approved - MTG Marketplace',
          html: `
            <h2>Congratulations! Your seller application has been approved.</h2>
            <p>Hi ${application.profiles.display_name},</p>
            <p>We're excited to let you know that your seller application has been approved!</p>
            <p><strong>Seller Tier:</strong> ${seller_tier}</p>
            <p>You can now:</p>
            <ul>
              <li>Create and manage card listings</li>
              <li>Receive and process orders</li>
              <li>Access seller analytics and tools</li>
              <li>Set up your payout preferences</li>
            </ul>
            <p>Get started by visiting your <a href="${process.env.FRONTEND_URL}/seller">Seller Dashboard</a></p>
            <p>Welcome to the MTG Marketplace community!</p>
            ${notes ? `<p><strong>Additional Notes:</strong> ${notes}</p>` : ''}
          `
        })
      }

      res.json({
        message: 'Seller application approved successfully',
        seller_tier: seller_tier
      })
    } catch (error) {
      throw new Error(`Failed to approve seller: ${error.message}`)
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Reject seller application
router.post('/seller-applications/:id/reject', async (req, res) => {
  try {
    const applicationId = req.params.id
    const { reason, notes } = req.body

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' })
    }

    // Get application details
    const { data: application } = await supabase
      .from('seller_applications')
      .select(`
        *,
        profiles(email, display_name)
      `)
      .eq('id', applicationId)
      .single()

    if (!application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    // Update application status
    await supabase
      .from('seller_applications')
      .update({
        status: 'rejected',
        rejected_at: new Date(),
        rejected_by: req.user.id,
        rejection_reason: reason,
        admin_notes: notes
      })
      .eq('id', applicationId)

    // Update user profile
    await supabase
      .from('profiles')
      .update({
        seller_application_status: 'rejected',
        updated_at: new Date()
      })
      .eq('id', application.user_id)

    // Log admin action
    await supabase
      .from('admin_actions')
      .insert({
        admin_id: req.user.id,
        action_type: 'seller_rejected',
        target_user_id: application.user_id,
        details: {
          application_id: applicationId,
          reason: reason,
          notes: notes
        },
        created_at: new Date()
      })

    // Send rejection email
    if (application.profiles?.email) {
      await transporter.sendMail({
        from: process.env.FROM_EMAIL,
        to: application.profiles.email,
        subject: 'Seller Application Update - MTG Marketplace',
        html: `
          <h2>Seller Application Update</h2>
          <p>Hi ${application.profiles.display_name},</p>
          <p>Thank you for your interest in becoming a seller on MTG Marketplace.</p>
          <p>After reviewing your application, we are unable to approve it at this time.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          ${notes ? `<p><strong>Additional Notes:</strong> ${notes}</p>` : ''}
          <p>You may reapply after addressing the concerns mentioned above.</p>
          <p>If you have any questions, please contact our support team.</p>
        `
      })
    }

    res.json({
      message: 'Seller application rejected',
      reason: reason
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Request additional information from applicant
router.post('/seller-applications/:id/request-info', async (req, res) => {
  try {
    const applicationId = req.params.id
    const { message, required_documents } = req.body

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    // Get application details
    const { data: application } = await supabase
      .from('seller_applications')
      .select(`
        *,
        profiles(email, display_name)
      `)
      .eq('id', applicationId)
      .single()

    if (!application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    // Update application status
    await supabase
      .from('seller_applications')
      .update({
        status: 'info_requested',
        info_requested_at: new Date(),
        info_requested_by: req.user.id,
        admin_message: message,
        required_documents: required_documents
      })
      .eq('id', applicationId)

    // Log admin action
    await supabase
      .from('admin_actions')
      .insert({
        admin_id: req.user.id,
        action_type: 'seller_info_requested',
        target_user_id: application.user_id,
        details: {
          application_id: applicationId,
          message: message,
          required_documents: required_documents
        },
        created_at: new Date()
      })

    // Send info request email
    if (application.profiles?.email) {
      const docList = required_documents && required_documents.length > 0 
        ? `<ul>${required_documents.map(doc => `<li>${doc}</li>`).join('')}</ul>`
        : ''

      await transporter.sendMail({
        from: process.env.FROM_EMAIL,
        to: application.profiles.email,
        subject: 'Additional Information Required - Seller Application',
        html: `
          <h2>Additional Information Required</h2>
          <p>Hi ${application.profiles.display_name},</p>
          <p>We're reviewing your seller application and need some additional information:</p>
          <p>${message}</p>
          ${docList ? `<p><strong>Required Documents:</strong></p>${docList}` : ''}
          <p>Please log in to your account and upload the requested information to continue the review process.</p>
          <p><a href="${process.env.FRONTEND_URL}/seller/application">Update Application</a></p>
        `
      })
    }

    res.json({
      message: 'Information request sent successfully'
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ===== SELLER MANAGEMENT =====

// Get all sellers with stats
router.get('/sellers', async (req, res) => {
  try {
    const { 
      status = 'all',
      tier = 'all',
      page = 1,
      limit = 20,
      sort = 'created_at',
      order = 'desc',
      search
    } = req.query
    let query = supabase
      .from('profiles')
      //average rating should be a column on the sellers table that is updated everytime a new review is placed. A db trigger needs to be created to manage that. 
      // _avg_rating:seller_reviews!seller_reviews_seller_id_fkey1(rating.avg())
      .select(`
        *,
        seller_settings(business_name, business_type, payout_method),
        _count_listings:listings(count),
        _count_orders:orders(count)
      `, { count: 'exact' })
      .eq('role', 'seller')

    if (status === 'approved') {
      query = query.eq('approved', true)
    } else if (status === 'pending') {
      query = query.eq('approved', false)
    }

    if (tier !== 'all') {
      query = query.eq('seller_tier', tier)
    }

    if (search) {
      query = query.or(`display_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    query = query.order(sort, { ascending: order === 'asc' })

    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data: sellers, count, error } = await query

    if (error) throw error

    res.json({
      sellers,
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

// Suspend seller
router.post('/sellers/:id/suspend', async (req, res) => {
  try {
    const sellerId = req.params.id
    const { reason, duration_days } = req.body

    if (!reason) {
      return res.status(400).json({ error: 'Suspension reason is required' }) 
    }

    const suspendedUntil = duration_days 
      ? new Date(Date.now() + duration_days * 24 * 60 * 60 * 1000)
      : null

    // Update seller status
    await supabase
      .from('profiles')
      .update({
        suspended: true,
        suspended_until: suspendedUntil,
        suspension_reason: reason,
        updated_at: new Date()
      })
      .eq('id', sellerId)

    // Deactivate all listings
    await supabase
      .from('listings')
      .update({
        status: 'suspended',
        updated_at: new Date()
      })
      .eq('seller_id', sellerId)
      .eq('status', 'active')

    // Log admin action
    await supabase
      .from('admin_actions')
      .insert({
        admin_id: req.user.id,
        action_type: 'seller_suspended',
        target_user_id: sellerId,
        details: {
          reason: reason,
          duration_days: duration_days,
          suspended_until: suspendedUntil
        },
        created_at: new Date()
      })

    res.json({
      message: 'Seller suspended successfully',
      suspended_until: suspendedUntil
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Unsuspend seller
router.post('/sellers/:id/unsuspend', async (req, res) => {
  try {
    const sellerId = req.params.id
    const { notes } = req.body

    // Update seller status
    await supabase
      .from('profiles')
      .update({
        suspended: false,
        suspended_until: null,
        suspension_reason: null,
        updated_at: new Date()
      })
      .eq('id', sellerId)

    // Reactivate suspended listings (admin can choose which ones)
    await supabase
      .from('listings')
      .update({
        status: 'active',
        updated_at: new Date()
      })
      .eq('seller_id', sellerId)
      .eq('status', 'suspended')

    // Log admin action
    await supabase
      .from('admin_actions')
      .insert({
        admin_id: req.user.id,
        action_type: 'seller_unsuspended',
        target_user_id: sellerId,
        details: {
          notes: notes
        },
        created_at: new Date()
      })

    res.json({
      message: 'Seller unsuspended successfully'
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router