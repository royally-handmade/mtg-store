import rateLimit from 'express-rate-limit'
import { supabase } from '../server.js'

// Rate limiting for password reset requests
export const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 requests per windowMs
  message: {
    error: 'Too many password reset requests. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Custom key generator to track by IP
  keyGenerator: (req) => req.ip,
  // Skip successful requests (only count failed ones)
  skipSuccessfulRequests: false
})

// Rate limiting for password update attempts
export const updatePasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 password updates per hour
  message: {
    error: 'Too many password update attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip
})

// Security event logging function
export const logSecurityEvent = async (userId, action, metadata = {}) => {
  try {
    await supabase
      .from('security_logs')
      .insert({
        user_id: userId,
        action,
        ip_address: metadata.ip_address,
        user_agent: metadata.user_agent,
        timestamp: new Date(),
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString()
        }
      })
  } catch (error) {
    console.error('Failed to log security event:', error)
    // Don't throw - logging failures shouldn't break the main flow
  }
}

// Middleware to automatically log security events
export const securityLoggingMiddleware = (action) => {
  return async (req, res, next) => {
    // Store original send method
    const originalSend = res.send
    
    // Override send method to log on completion
    res.send = function(data) {
      // Log successful operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logSecurityEvent(req.user?.id, action, {
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          method: req.method,
          path: req.path,
          status_code: res.statusCode
        })
      }
      
      // Call original send
      originalSend.call(this, data)
    }
    
    next()
  }
}

// Enhanced rate limiter with user-specific limits
export const createUserSpecificLimiter = (windowMs, maxAttempts, action) => {
  return rateLimit({
    windowMs,
    max: maxAttempts,
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise fall back to IP
      return req.user?.id || req.ip
    },
    handler: async (req, res) => {
      // Log rate limit violations
      await logSecurityEvent(req.user?.id, `${action}_rate_limited`, {
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        attempted_action: action,
        limit_window: windowMs,
        max_attempts: maxAttempts
      })
      
      res.status(429).json({
        error: `Too many ${action} attempts. Please try again later.`,
        retryAfter: Math.ceil(windowMs / 1000)
      })
    }
  })
}
