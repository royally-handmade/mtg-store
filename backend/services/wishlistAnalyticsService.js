import { supabase } from '../server.js'

export class WishlistAnalyticsService {
  // Get popular wishlist cards
  static async getPopularWishlistCards(limit = 20) {
    try {
      const { data, error } = await supabase
        .from('wishlists')
        .select(`
          card_id,
          cards (name, image_url, set_number, market_price, rarity),
          count:card_id
        `)
        .group('card_id')
        .order('count', { ascending: false })
        .limit(limit)
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error getting popular wishlist cards:', error)
      return []
    }
  }

  // Get wishlist trends over time
  static async getWishlistTrends(days = 30) {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      
      const { data, error } = await supabase
        .from('wishlist_activity_log')
        .select('action, timestamp')
        .gte('timestamp', since)
        .order('timestamp', { ascending: true })
      
      if (error) throw error
      
      // Group by day and action
      const trends = {}
      data.forEach(log => {
        const date = new Date(log.timestamp).toISOString().split('T')[0]
        if (!trends[date]) trends[date] = {}
        trends[date][log.action] = (trends[date][log.action] || 0) + 1
      })
      
      return trends
    } catch (error) {
      console.error('Error getting wishlist trends:', error)
      return {}
    }
  }

  // Get user wishlist insights
  static async getUserWishlistInsights(userId) {
    try {
      const [wishlistData, activityData] = await Promise.all([
        supabase
          .from('wishlists')
          .select(`
            *,
            cards (market_price, rarity, type_line)
          `)
          .eq('user_id', userId),
        supabase
          .from('wishlist_activity_log')
          .select('action, timestamp')
          .eq('user_id', userId)
          .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      ])
      
      const wishlist = wishlistData.data || []
      const activity = activityData.data || []
      
      return {
        total_items: wishlist.length,
        total_value: wishlist.reduce((sum, item) => sum + (parseFloat(item.cards.market_price) || 0), 0),
        average_card_price: wishlist.length > 0 ? 
          wishlist.reduce((sum, item) => sum + (parseFloat(item.cards.market_price) || 0), 0) / wishlist.length : 0,
        price_alerts_set: wishlist.filter(item => item.max_price).length,
        rarity_distribution: this.calculateRarityDistribution(wishlist),
        activity_last_30_days: activity.length,
        most_common_activity: this.getMostCommonActivity(activity)
      }
    } catch (error) {
      console.error('Error getting user wishlist insights:', error)
      return null
    }
  }

  static calculateRarityDistribution(wishlist) {
    const distribution = { common: 0, uncommon: 0, rare: 0, mythic: 0, other: 0 }
    wishlist.forEach(item => {
      const rarity = item.cards.rarity
      if (distribution.hasOwnProperty(rarity)) {
        distribution[rarity]++
      } else {
        distribution.other++
      }
    })
    return distribution
  }

  static getMostCommonActivity(activity) {
    const activityCounts = {}
    activity.forEach(log => {
      activityCounts[log.action] = (activityCounts[log.action] || 0) + 1
    })
    
    return Object.entries(activityCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none'
  }
}
