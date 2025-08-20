import rateLimit from 'express-rate-limit'
import { supabase } from '../server.js'

// ===== GENERAL API RATE LIMITER =====

export const rateLimitMiddleware = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000) / 1000)
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP address
    return req.user?.id || req.ip
  },
  skip: (req) => {
    // Skip rate limiting for certain endpoints
    const skipPaths = [
      '/api/health',
      '/api/auth/validate-reset-session'
    ]
    return skipPaths.includes(req.path)
  },
  handler: async (req, res) => {
    // Log rate limit violations
    try {
      await supabase
        .from('security_logs')
        .insert({
          user_id: req.user?.id || null,
          action: 'rate_limit_exceeded',
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          metadata: {
            path: req.path,
            method: req.method,
            limit_type: 'general_api',
            timestamp: new Date().toISOString()
          }
        })
    } catch (error) {
      console.error('Failed to log rate limit violation:', error)
    }

    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000) / 1000)
    })
  }
})

// ===== AUTHENTICATION SPECIFIC RATE LIMITER =====

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: {
    error: 'Too many authentication attempts, please try again in 15 minutes.',
    retryAfter: 15 * 60
  },
  keyGenerator: (req) => req.ip,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: async (req, res) => {
    await logRateLimitViolation(req, 'auth_rate_limit')
    res.status(429).json({
      error: 'Too many authentication attempts, please try again in 15 minutes.',
      retryAfter: 15 * 60
    })
  }
})

// ===== API ENDPOINT SPECIFIC RATE LIMITERS =====

// Search rate limiter - prevents search abuse
export const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: {
    error: 'Too many search requests, please slow down.',
    retryAfter: 60
  },
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: async (req, res) => {
    await logRateLimitViolation(req, 'search_rate_limit')
    res.status(429).json({
      error: 'Too many search requests, please slow down.',
      retryAfter: 60
    })
  }
})

// Cart operations rate limiter
export const cartRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 cart operations per minute
  message: {
    error: 'Too many cart operations, please slow down.',
    retryAfter: 60
  },
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: async (req, res) => {
    await logRateLimitViolation(req, 'cart_rate_limit')
    res.status(429).json({
      error: 'Too many cart operations, please slow down.',
      retryAfter: 60
    })
  }
})

// Listing creation rate limiter
export const listingRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 new listings per hour
  message: {
    error: 'Too many listings created, please wait before creating more.',
    retryAfter: 60 * 60
  },
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: async (req, res) => {
    await logRateLimitViolation(req, 'listing_rate_limit')
    res.status(429).json({
      error: 'Too many listings created, please wait before creating more.',
      retryAfter: 60 * 60
    })
  }
})

// Order creation rate limiter
export const orderRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 orders per hour
  message: {
    error: 'Too many orders placed, please wait before placing another order.',
    retryAfter: 60 * 60
  },
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: async (req, res) => {
    await logRateLimitViolation(req, 'order_rate_limit')
    res.status(429).json({
      error: 'Too many orders placed, please wait before placing another order.',
      retryAfter: 60 * 60
    })
  }
})

// Wishlist operations rate limiter
export const wishlistRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15, // 15 wishlist operations per minute
  message: {
    error: 'Too many wishlist operations, please slow down.',
    retryAfter: 60
  },
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: async (req, res) => {
    await logRateLimitViolation(req, 'wishlist_rate_limit')
    res.status(429).json({
      error: 'Too many wishlist operations, please slow down.',
      retryAfter: 60
    })
  }
})

// Email sending rate limiter (for contact forms, etc.)
export const emailRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 emails per hour
  message: {
    error: 'Too many emails sent, please wait before sending another.',
    retryAfter: 60 * 60
  },
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: async (req, res) => {
    await logRateLimitViolation(req, 'email_rate_limit')
    res.status(429).json({
      error: 'Too many emails sent, please wait before sending another.',
      retryAfter: 60 * 60
    })
  }
})

// File upload rate limiter
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 file uploads per hour
  message: {
    error: 'Too many file uploads, please wait before uploading more.',
    retryAfter: 60 * 60
  },
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: async (req, res) => {
    await logRateLimitViolation(req, 'upload_rate_limit')
    res.status(429).json({
      error: 'Too many file uploads, please wait before uploading more.',
      retryAfter: 60 * 60
    })
  }
})

// ===== STRICT RATE LIMITER FOR SENSITIVE OPERATIONS =====

export const strictRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3, // Only 3 attempts per day
  message: {
    error: 'Daily limit exceeded for this operation. Please try again tomorrow.',
    retryAfter: 24 * 60 * 60
  },
  keyGenerator: (req) => req.user?.id || req.ip,
  skipSuccessfulRequests: false,
  handler: async (req, res) => {
    await logRateLimitViolation(req, 'strict_rate_limit')
    res.status(429).json({
      error: 'Daily limit exceeded for this operation. Please try again tomorrow.',
      retryAfter: 24 * 60 * 60
    })
  }
})

// ===== PROGRESSIVE RATE LIMITER (increases delay with violations) =====

class ProgressiveRateLimiter {
  constructor() {
    this.violations = new Map() // Track violations per IP/user
  }

  createLimiter(baseWindowMs = 60000, baseMax = 10) {
    return rateLimit({
      windowMs: baseWindowMs,
      max: (req) => {
        const key = req.user?.id || req.ip
        const violationCount = this.violations.get(key) || 0
        
        // Reduce max requests based on violation history
        return Math.max(1, baseMax - violationCount * 2)
      },
      keyGenerator: (req) => req.user?.id || req.ip,
      handler: async (req, res) => {
        const key = req.user?.id || req.ip
        const currentViolations = this.violations.get(key) || 0
        this.violations.set(key, currentViolations + 1)
        
        // Clean up old violations after 24 hours
        setTimeout(() => {
          this.violations.delete(key)
        }, 24 * 60 * 60 * 1000)
        
        await logRateLimitViolation(req, 'progressive_rate_limit', {
          violation_count: currentViolations + 1
        })
        
        const retryAfter = baseWindowMs * (currentViolations + 1) / 1000
        res.status(429).json({
          error: 'Rate limit exceeded. Subsequent violations will result in longer delays.',
          retryAfter: Math.ceil(retryAfter),
          violationCount: currentViolations + 1
        })
      }
    })
  }
}

export const progressiveRateLimiter = new ProgressiveRateLimiter()

// ===== HELPER FUNCTIONS =====

// Log rate limit violations for monitoring
const logRateLimitViolation = async (req, limitType, additionalMetadata = {}) => {
  try {
    await supabase
      .from('security_logs')
      .insert({
        user_id: req.user?.id || null,
        action: 'rate_limit_violation',
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        metadata: {
          limit_type: limitType,
          path: req.path,
          method: req.method,
          headers: {
            'x-forwarded-for': req.get('X-Forwarded-For'),
            'x-real-ip': req.get('X-Real-IP')
          },
          timestamp: new Date().toISOString(),
          ...additionalMetadata
        }
      })
  } catch (error) {
    console.error('Failed to log rate limit violation:', error)
  }
}

// Get current rate limit status for a user/IP
export const getRateLimitStatus = async (identifier, limitType) => {
  try {
    const { data, error } = await supabase
      .from('security_logs')
      .select('*')
      .eq('action', 'rate_limit_violation')
      .eq('metadata->>limit_type', limitType)
      .or(`user_id.eq.${identifier},ip_address.eq.${identifier}`)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    return {
      violations: data.length,
      lastViolation: data[0]?.created_at || null,
      isBlocked: data.length >= 10 // Block after 10 violations in 24h
    }
  } catch (error) {
    console.error('Error checking rate limit status:', error)
    return { violations: 0, lastViolation: null, isBlocked: false }
  }
}

// Whitelist specific IPs or users (for admin/internal use)
export const createWhitelistedLimiter = (whitelist = []) => {
  return rateLimit({
    windowMs: 60 * 1000,
    max: 1000, // High limit for whitelisted
    skip: (req) => {
      const identifier = req.user?.id || req.ip
      return whitelist.includes(identifier)
    },
    keyGenerator: (req) => req.user?.id || req.ip
  })
}

// ===== MONITORING AND ANALYTICS =====

// Get rate limit statistics
export const getRateLimitStats = async (timeframe = '24h') => {
  try {
    const hoursBack = timeframe === '1h' ? 1 : timeframe === '24h' ? 24 : 168 // 1 week
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()
    
    const { data, error } = await supabase
      .from('security_logs')
      .select('metadata, created_at')
      .eq('action', 'rate_limit_violation')
      .gte('created_at', since)
    
    if (error) throw error
    
    // Analyze violations by type, IP, path, etc.
    const stats = {
      totalViolations: data.length,
      byType: {},
      byPath: {},
      byHour: {},
      topIPs: {}
    }
    
    data.forEach(log => {
      const metadata = log.metadata
      const hour = new Date(log.created_at).getHours()
      
      // Count by limit type
      stats.byType[metadata.limit_type] = (stats.byType[metadata.limit_type] || 0) + 1
      
      // Count by path
      stats.byPath[metadata.path] = (stats.byPath[metadata.path] || 0) + 1
      
      // Count by hour
      stats.byHour[hour] = (stats.byHour[hour] || 0) + 1
      
      // Count by IP
      const ip = metadata.headers?.['x-real-ip'] || 'unknown'
      stats.topIPs[ip] = (stats.topIPs[ip] || 0) + 1
    })
    
    return stats
  } catch (error) {
    console.error('Error getting rate limit stats:', error)
    return null
  }
}

// Export default rate limiter
export default rateLimitMiddleware