# SEO Implementation - Updated Guide

## Overview

The SEO implementation for MTG Marketplace uses a **custom pre-rendering solution** with Puppeteer and dynamic meta tags via @unhead/vue.

## What Changed

**Previous approach**: Attempted to use `vite-plugin-prerender` (had ES module compatibility issues)

**Current approach**: Custom post-build prerendering script with Puppeteer

## Features Implemented

### 1. Custom Pre-rendering Script

**Location**: `scripts/prerender.js`

**How it works**:
1. Runs **after** Vite builds the production bundle
2. Starts a temporary HTTP server serving the `dist` folder
3. Uses Puppeteer to visit each route in headless Chrome
4. Waits for content to load (`networkidle0` + 500ms for Vue hydration)
5. Captures fully-rendered HTML with all dynamic meta tags
6. Writes static HTML files to appropriate locations in `dist/`

**Advantages**:
- ✅ No build-time complexity
- ✅ Works with ES modules
- ✅ Dev mode unaffected
- ✅ Captures all dynamic meta tags from @unhead/vue
- ✅ Simple, maintainable code

### 2. Dynamic Meta Tags with @unhead/vue

**Location**: `src/composables/useSeo.js`

Three composables available:

#### `useSeo(options)`
General purpose SEO meta tags for any page:
```javascript
useSeo({
  title: 'Page Title',
  description: 'Page description',
  keywords: 'keyword1, keyword2',
  image: '/image.jpg',
  url: '/current-page'
})
```

#### `useCardSeo(card)`
Card-specific SEO with Product schema (JSON-LD):
```javascript
const cardForSeo = computed(() => ({
  ...card.value,
  lowest_price: cheapestListing.value?.price,
  listing_count: listings.value.length,
  in_stock: true
}))

useCardSeo(cardForSeo)
```

#### `useProductSeo(product)`
Add structured data only (used internally by `useCardSeo`)

**Pages with SEO**:
- ✅ Home page (`views/Home.vue`)
- ✅ Cards browse (`views/Cards.vue`)
- ✅ Card detail (`views/CardDetail.vue`)

### 3. Route Generation

**Location**: `scripts/generate-routes.js`

Fetches card IDs from the backend API endpoint `GET /api/cards/all-ids` and generates a JSON file with routes to pre-render.

**Configuration**:
```javascript
const cardLimit = 500 // Adjust this to pre-render more/fewer cards
```

**Fallback**: If API is unavailable, uses static routes only (`/`, `/cards`, `/auth`, `/cart`)

### 4. Backend API Endpoint

**Endpoint**: `GET /api/cards/all-ids`
**Location**: `backend/routes/cards.js:1284`

Returns:
```json
{
  "data": [
    {
      "id": 123,
      "name": "Black Lotus",
      "set_number": "alpha",
      "slug": "123-black-lotus",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ],
  "count": 1234
}
```

### 5. SEO Assets

- `frontend/public/robots.txt` - Search engine crawl rules
- `frontend/index.html` - Base meta tags and performance hints
- `frontend/src/composables/useSeo.js` - SEO helper functions

## Build Commands

```bash
# Development (NO pre-rendering, fast)
npm run dev

# Production build WITH pre-rendering
npm run build
# This runs: generate-routes → vite build → prerender

# Production build WITHOUT pre-rendering (faster for testing)
npm run build:no-prerender

# Generate routes only
npm run generate-routes

# Prerender only (requires existing dist folder)
npm run prerender

# Preview production build
npm run preview
```

## Build Process Flow

```
npm run build
  ↓
1. npm run generate-routes
   - Fetches card IDs from API
   - Writes prerender-routes.json
  ↓
2. vite build
   - Compiles Vue app
   - Outputs to dist/
  ↓
3. npm run prerender
   - Starts local server
   - Visits each route with Puppeteer
   - Captures & saves pre-rendered HTML
   - Shuts down server
  ↓
Done! dist/ contains pre-rendered static files
```

## Configuration

### Adjust number of cards to pre-render

Edit `frontend/scripts/generate-routes.js`:
```javascript
const cardLimit = 500 // Line 29 - change this value
```

**Recommendations**:
- 100 cards: ~2-3 minutes build time
- 500 cards: ~8-12 minutes build time
- 1000+ cards: ~20-30 minutes build time

### Update site domain

Edit `frontend/src/composables/useSeo.js` and update all `siteUrl` constants:
```javascript
const siteUrl = 'https://your-actual-domain.com'
```

Also update `frontend/public/robots.txt`:
```txt
Sitemap: https://your-actual-domain.com/sitemap.xml
```

## Adding SEO to New Pages

```vue
<script setup>
import { useSeo } from '@/composables/useSeo'

useSeo({
  title: 'Your Page Title | MTG Marketplace',
  description: 'Your page description for search engines',
  keywords: 'relevant, keywords, here'
})

// Your component code...
</script>
```

## Structured Data (JSON-LD)

Card pages automatically include Product schema for Google Shopping:

```json
{
  "@context": "https://schema.org/",
  "@type": "Product",
  "name": "Card Name - Set Name",
  "image": "https://...",
  "description": "...",
  "brand": { "@type": "Brand", "name": "Wizards of the Coast" },
  "offers": {
    "@type": "AggregateOffer",
    "lowPrice": "1.99",
    "highPrice": "5.99",
    "priceCurrency": "CAD",
    "offerCount": 5,
    "availability": "https://schema.org/InStock"
  }
}
```

## Testing Pre-rendered Pages

### 1. Build the project
```bash
cd frontend
npm run build
```

### 2. Check output
Look in `frontend/dist/` - you should see:
```
dist/
  index.html              (pre-rendered home page)
  cards/
    index.html            (pre-rendered /cards)
  card/
    123/
      index.html          (pre-rendered /card/123)
    456/
      index.html          (pre-rendered /card/456)
  ...
```

### 3. Verify HTML content
Open any `index.html` file and verify:
- ✅ Title tag has correct content
- ✅ Meta description is present
- ✅ Open Graph tags exist
- ✅ JSON-LD script tag for products
- ✅ Page content is rendered (not empty)

### 4. Test with Google tools
- [Rich Results Test](https://search.google.com/test/rich-results)
- [Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)
- [PageSpeed Insights](https://pagespeed.web.dev/)

## Troubleshooting

### Dev server won't start
**Solution**: The vite config is now clean with no prerendering during dev. Run `npm run dev` - it should work.

### "Cannot find module" during build
**Solution**:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Prerender script hangs
**Possible causes**:
1. Route takes too long to load (increase timeout in `prerender.js` line 56)
2. Dist folder doesn't exist (run `vite build` first)
3. Port 3333 already in use (change port in script)

**Fix**: Edit `scripts/prerender.js`:
```javascript
await page.goto(`http://localhost:3333${route}`, {
  waitUntil: 'networkidle0',
  timeout: 60000 // Increase from 30000
})
```

### Pre-rendered pages are blank
**Check**:
1. Is Vue Router in history mode? ✅ (it is)
2. Are API calls failing? Check browser console
3. Increase wait time: `await page.waitForTimeout(1000)` (line 61)

### Routes not being generated
**Check if backend is accessible**:
```bash
curl https://mtg-store-api.onrender.com/api/cards/all-ids
```

If it times out, the script will use fallback routes (static pages only).

## Next Steps for Full SEO

### 1. XML Sitemap (TODO)
Create backend endpoint:
```javascript
// backend/routes/sitemap.js
router.get('/sitemap.xml', async (req, res) => {
  const cards = await getAllCards()
  const xml = generateSitemapXML(cards)
  res.header('Content-Type', 'application/xml')
  res.send(xml)
})
```

### 2. Google Shopping Feed (TODO)
Create backend endpoint:
```javascript
// backend/routes/feed.js
router.get('/google-shopping.xml', async (req, res) => {
  const listings = await getActiveListings()
  const feed = generateProductFeed(listings)
  res.header('Content-Type', 'application/xml')
  res.send(feed)
})
```

### 3. Image Optimization
- Add descriptive `alt` attributes to all card images
- Use responsive images with `srcset`
- Lazy load images below the fold

### 4. Performance
- Implement caching headers
- Use CDN for static assets
- Monitor Core Web Vitals

### 5. Google Accounts Setup
- Google Search Console
- Google Merchant Center
- Submit product feed

## Performance Benchmarks

**Build times** (approximate):
- Vite build only: ~20-30 seconds
- + Generate routes (500 cards): ~10-15 seconds
- + Prerender 4 static pages: ~5-10 seconds
- **Total (no cards)**: ~45 seconds

**With card prerendering**:
- + Prerender 100 cards: ~2-3 minutes
- + Prerender 500 cards: ~10-15 minutes
- **Total (500 cards)**: ~12-16 minutes

**Development**:
- Hot reload: Instant
- Full restart: ~2 seconds
- No prerendering in dev mode

## Resources

- [Google Search Central](https://developers.google.com/search)
- [Schema.org Product](https://schema.org/Product)
- [Unhead Documentation](https://unhead.unjs.io/)
- [Puppeteer Docs](https://pptr.dev/)

## Summary

✅ **What works**:
- Dev mode runs normally with no prerendering
- Production builds generate static HTML for all routes
- Dynamic meta tags inject on all pages
- Structured data (JSON-LD) included on product pages
- Fallback to static routes if API unavailable

✅ **Ready for**:
- Google Search indexing
- Google Shopping (with feed implementation)
- Social media sharing (Open Graph tags)
- SEO tools and validators
