import Joi from 'joi'

export const validateUpdateProfile = (req, res, next) => {
  const schema = Joi.object({
    display_name: Joi.string().min(1).max(100).optional(),
    phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).optional().allow(''),
    timezone: Joi.string().optional().allow(''),
    bio: Joi.string().max(1000).optional().allow(''),
    shipping_address: Joi.object({
      name: Joi.string().required(),
      company: Joi.string().optional().allow(''),
      street1: Joi.string().required(),
      street2: Joi.string().optional().allow(''),
      city: Joi.string().required(),
      state: Joi.string().required(),
      zip: Joi.string().required(),
      country: Joi.string().length(2).required()
    }).optional(),
    email_preferences: Joi.object({
      order_updates: Joi.boolean().optional(),
      price_alerts: Joi.boolean().optional(),
      marketing: Joi.boolean().optional(),
      security: Joi.boolean().optional()
    }).optional()
  }).min(1) // At least one field must be provided
  
  const { error } = schema.validate(req.body)
  if (error) {
    return res.status(400).json({ error: error.details[0].message })
  }
  next()
}

export const validatePasswordChange = (req, res, next) => {
  const schema = Joi.object({
    current_password: Joi.string().required(),
    new_password: Joi.string().min(6).required()
  })
  
  const { error } = schema.validate(req.body)
  if (error) {
    return res.status(400).json({ error: error.details[0].message })
  }
  next()
}

export const validateListing = (req, res, next) => {
  const schema = Joi.object({
    card_id: Joi.string().uuid().required(),
    price: Joi.number().positive().precision(2).required(),
    condition: Joi.string().valid('nm', 'lp', 'mp', 'hp', 'dmg').required(),
    quantity: Joi.number().integer().min(1).required()
  })
  
  const { error } = schema.validate(req.body)
  if (error) {
    return res.status(400).json({ error: error.details[0].message })
  }
  next()
}

export const validateOrder = (req, res, next) => {
  const schema = Joi.object({
    cart_items: Joi.array().items(
      Joi.object({
        listing_id: Joi.string().uuid().required(),
        quantity: Joi.number().integer().min(1).required()
      })
    ).min(1).required(),
    shipping_address: Joi.object({
      name: Joi.string().required(),
      street1: Joi.string().required(),
      street2: Joi.string().allow(''),
      city: Joi.string().required(),
      state: Joi.string().required(),
      zip: Joi.string().required(),
      country: Joi.string().required()
    }).required(),
    payment_method: Joi.string().required()
  })
  
  const { error } = schema.validate(req.body)
  if (error) {
    return res.status(400).json({ error: error.details[0].message })
  }
  next()
}

export const validateCardUpload = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().required(),
    set_number: Joi.string().required(),
    card_number: Joi.string().allow(''),
    mana_cost: Joi.string().allow(''),
    rarity: Joi.string().valid('common', 'uncommon', 'rare', 'mythic').required(),
    treatment: Joi.string().allow(''),
    image_url: Joi.string().uri().allow(''),
    type_line: Joi.string().allow(''),
    market_price: Joi.number().positive().precision(2).allow(null)
  })
  
  const { error } = schema.validate(req.body)
  if (error) {
    return res.status(400).json({ error: error.details[0].message })
  }
  next()
}
