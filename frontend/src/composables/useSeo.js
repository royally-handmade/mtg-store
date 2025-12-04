import { useHead } from '@unhead/vue'
import { computed } from 'vue'

export function useSeo(options) {
  const defaultTitle = 'MTG Marketplace - Buy and Sell Magic: The Gathering Cards'
  const defaultDescription = 'Buy and sell Magic: The Gathering cards on MTG Marketplace. Browse thousands of singles, build decks, and connect with trusted sellers.'
  const defaultImage = '/og-image.jpg'
  const siteUrl = 'https://yourdomain.com' // Replace with your actual domain

  const seoOptions = computed(() => {
    const title = options.title?.value || options.title || defaultTitle
    const description = options.description?.value || options.description || defaultDescription
    const image = options.image?.value || options.image || defaultImage
    const url = options.url?.value || options.url || siteUrl
    const type = options.type?.value || options.type || 'website'

    return {
      title,
      description,
      image: image.startsWith('http') ? image : `${siteUrl}${image}`,
      url: url.startsWith('http') ? url : `${siteUrl}${url}`,
      type
    }
  })

  useHead(() => ({
    title: seoOptions.value.title,
    meta: [
      // Basic meta tags
      {
        name: 'description',
        content: seoOptions.value.description
      },
      {
        name: 'keywords',
        content: options.keywords?.value || options.keywords || 'Magic The Gathering, MTG, cards, singles, marketplace, buy cards, sell cards'
      },

      // Open Graph meta tags
      {
        property: 'og:title',
        content: seoOptions.value.title
      },
      {
        property: 'og:description',
        content: seoOptions.value.description
      },
      {
        property: 'og:image',
        content: seoOptions.value.image
      },
      {
        property: 'og:url',
        content: seoOptions.value.url
      },
      {
        property: 'og:type',
        content: seoOptions.value.type
      },
      {
        property: 'og:site_name',
        content: 'MTG Marketplace'
      },

      // Twitter Card meta tags
      {
        name: 'twitter:card',
        content: options.twitterCard?.value || options.twitterCard || 'summary_large_image'
      },
      {
        name: 'twitter:title',
        content: seoOptions.value.title
      },
      {
        name: 'twitter:description',
        content: seoOptions.value.description
      },
      {
        name: 'twitter:image',
        content: seoOptions.value.image
      }
    ],
    link: [
      {
        rel: 'canonical',
        href: seoOptions.value.url
      }
    ]
  }))
}

export function useProductSeo(product) {
  const siteUrl = 'https://yourdomain.com' // Replace with your actual domain

  const productData = computed(() => {
    if (!product.value) return null

    return {
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: `${product.value.name} - ${product.value.set_name || 'MTG'}`,
      image: product.value.image_url,
      description: product.value.type_line || `Magic: The Gathering card ${product.value.name} from ${product.value.set_name || 'various sets'}`,
      brand: {
        '@type': 'Brand',
        name: 'Wizards of the Coast'
      },
      category: 'Trading Card Games > Magic: The Gathering > Singles',
      sku: `card-${product.value.id}`,
      offers: {
        '@type': 'AggregateOffer',
        lowPrice: product.value.lowest_price || product.value.market_price || 0,
        highPrice: product.value.highest_price || product.value.market_price || 0,
        priceCurrency: 'CAD',
        offerCount: product.value.listing_count || 1,
        availability: product.value.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url: `${siteUrl}/card/${product.value.id}`,
        seller: {
          '@type': 'Organization',
          name: 'MTG Marketplace'
        }
      }
    }
  })

  useHead(() => ({
    script: product.value && productData.value ? [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(productData.value)
      }
    ] : []
  }))
}

export function useCardSeo(card) {
  const siteUrl = 'https://yourdomain.com' // Replace with your actual domain

  const cardMeta = computed(() => {
    if (!card.value) {
      return {
        title: 'Card Not Found - MTG Marketplace',
        description: 'This card could not be found.',
        url: siteUrl,
        image: '/og-image.jpg'
      }
    }

    const title = `${card.value.name} - ${card.value.set_name || 'MTG'} | MTG Marketplace`
    const description = `Buy ${card.value.name} from ${card.value.set_name || 'various sets'}. ${
      card.value.type_line || ''
    }. Starting at $${card.value.market_price || 'N/A'} CAD. Fast shipping and trusted sellers.`
    const url = `${siteUrl}/card/${card.value.id}`
    const image = card.value.image_url || '/og-image.jpg'

    return { title, description, url, image, type: 'product' }
  })

  useSeo(cardMeta)
  useProductSeo(card)
}
