import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function prerenderRoutes() {
  const distPath = path.resolve(__dirname, '..', 'dist')
  const routesFile = path.resolve(__dirname, 'prerender-routes.json')

  // Load routes
  let routes = ['/']
  try {
    const routesData = fs.readFileSync(routesFile, 'utf-8')
    routes = JSON.parse(routesData)
    console.log(`📄 Loaded ${routes.length} routes to prerender`)
  } catch (error) {
    console.warn('⚠️  Could not load routes file, using default ["/"]')
  }

  // Check if dist directory exists
  if (!fs.existsSync(distPath)) {
    console.error('❌ Dist directory not found. Run `npm run build` first.')
    process.exit(1)
  }

  console.log('🚀 Starting prerendering...')

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  let successCount = 0
  let errorCount = 0

  try {
    // Start a simple HTTP server to serve the dist folder
    const { default: handler } = await import('serve-handler')
    const http = await import('http')

    const server = http.createServer((request, response) => {
      return handler(request, response, {
        public: distPath,
        cleanUrls: true,
        rewrites: [
          { source: '**', destination: '/index.html' }
        ]
      })
    })

    await new Promise((resolve) => {
      server.listen(3333, () => {
        console.log('📡 Test server running on http://localhost:3333')
        resolve()
      })
    })

    // Prerender each route
    for (let i = 0; i < routes.length; i++) {
      const route = routes[i]
      try {
        console.log(`[${i + 1}/${routes.length}] Prerendering ${route}...`)

        const page = await browser.newPage()

        // Navigate to the route
        await page.goto(`http://localhost:3333${route}`, {
          waitUntil: 'networkidle0',
          timeout: 30000
        })

        // Wait a bit for Vue to hydrate
        await page.waitForTimeout(500)

        // Get the HTML
        const html = await page.content()

        // Determine output path
        let outputPath
        if (route === '/') {
          outputPath = path.join(distPath, 'index.html')
        } else {
          // Create directory for route
          const routePath = path.join(distPath, route)
          if (!fs.existsSync(routePath)) {
            fs.mkdirSync(routePath, { recursive: true })
          }
          outputPath = path.join(routePath, 'index.html')
        }

        // Write prerendered HTML
        fs.writeFileSync(outputPath, html)

        await page.close()
        successCount++
      } catch (error) {
        console.error(`❌ Error prerendering ${route}:`, error.message)
        errorCount++
      }
    }

    server.close()
  } finally {
    await browser.close()
  }

  console.log('\n✅ Prerendering complete!')
  console.log(`   Success: ${successCount} routes`)
  console.log(`   Errors: ${errorCount} routes`)

  if (errorCount > 0) {
    console.log('\n⚠️  Some routes failed to prerender')
  }
}

prerenderRoutes().catch(error => {
  console.error('💥 Prerendering failed:', error)
  process.exit(1)
})
