import axios from 'axios'
import fs from 'fs'
import path from 'path'

const API_BASE_URL = process.env.VITE_API_URL || 'https://mtg-store-api.onrender.com'

async function generateRoutes() {
  try {
    console.log('🔍 Fetching card IDs from API...')
    console.log(`   API URL: ${API_BASE_URL}/api/cards/all-ids`)

    const response = await axios.get(`${API_BASE_URL}/api/cards/all-ids`, {
      timeout: 15000
    })

    const cards = response.data.data || []
    console.log(`✅ Found ${cards.length} cards`)

    // Static routes that should always be pre-rendered
    const staticRoutes = [
      '/',
      '/cards',
      '/auth',
      '/cart'
    ]

    // Generate card detail routes (limit to most important cards to avoid excessive build time)
    // You can adjust the limit or add filtering logic
    const cardLimit = 500
    const cardRoutes = cards
      .slice(0, cardLimit) // Limit to first 500 cards to keep build time reasonable
      .map(card => `/card/${card.id}`)

    const allRoutes = [...staticRoutes, ...cardRoutes]

    // Write routes to a JSON file that Vite can import
    const outputPath = path.resolve(process.cwd(), 'scripts', 'prerender-routes.json')
    fs.writeFileSync(outputPath, JSON.stringify(allRoutes, null, 2))

    console.log(`✅ Generated ${allRoutes.length} routes for pre-rendering`)
    console.log(`   - ${staticRoutes.length} static routes`)
    console.log(`   - ${cardRoutes.length} card routes (limited to ${cardLimit})`)
    console.log(`   Routes written to: ${outputPath}`)

    return allRoutes
  } catch (error) {
    console.error('❌ Error generating routes:', error.message)

    if (error.code === 'ECONNREFUSED') {
      console.warn('⚠️  Cannot connect to API server. Is it running?')
    } else if (error.response) {
      console.warn(`⚠️  API responded with status: ${error.response.status}`)
    }

    // Fallback to static routes only if API fails
    const fallbackRoutes = ['/', '/cards', '/auth', '/cart']
    const outputPath = path.resolve(process.cwd(), 'scripts', 'prerender-routes.json')
    fs.writeFileSync(outputPath, JSON.stringify(fallbackRoutes, null, 2))

    console.log('⚠️  Using fallback routes (static pages only)')
    console.log(`   Generated ${fallbackRoutes.length} routes`)
    console.log(`   Tip: Start the backend API before building to pre-render card pages`)

    return fallbackRoutes
  }
}

// Run if executed directly
// Note: This check works differently in Node.js, so we'll just run it
generateRoutes().catch(error => {
  console.error('Failed to generate routes:', error)
  process.exit(1)
})

export default generateRoutes
