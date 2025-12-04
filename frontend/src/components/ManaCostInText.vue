<template>
  <span class="mana-text-display">
    <template v-for="(part, index) in parsedContent" :key="index">
      <!-- Regular text -->
      <span v-if="part.type === 'text'" v-html="part.content"></span>
      
      <!-- Mana symbol -->
      <span 
        v-else-if="part.type === 'mana'" 
        class="mana-symbol-inline inline-block align-middle mx-0.5"
        :class="getSymbolClass(part.symbol)"
        :title="getSymbolTooltip(part.symbol)"
      >
        <!-- SVG will be loaded here once you have the files -->
        <img
          v-if="hasSvgFile(part.symbol)"
          :src="getSvgPath(part.symbol)"
          :alt="part.symbol"
          :class="sizeClass"
        />
        <!-- Fallback text display until SVGs are available -->
        <span
          v-else
          class="mana-text-fallback text-xs font-bold rounded text-white inline-flex items-center justify-center"
          :class="sizeClass"
          :style="{ backgroundColor: getSymbolColor(part.symbol) }"
        >
          {{ part.symbol }}
        </span>
      </span>
    </template>
  </span>
</template>

<script setup>
import { computed, defineProps } from 'vue'
import symbolsData from '../symbols.json'

const props = defineProps({
  text: {
    type: String,
    default: '',
    required: true
  },
  size: {
    type: String,
    default: 'small',
    validator: value => ['tiny', 'small', 'medium', 'large'].includes(value)
  },
  svgBasePath: {
    type: String,
    default: '/assets/mana-symbols/'
  },
  preserveNewlines: {
    type: Boolean,
    default: true
  }
})

// Create a lookup map for symbol to SVG URI
const symbolMap = new Map(
  symbolsData.data.map(item => [
    item.symbol.replace(/[{}]/g, ''), // Remove braces from symbol
    item.svg_uri
  ])
)

// Parse text content to separate regular text from mana symbols
const parsedContent = computed(() => {
  if (!props.text) return []
  
  const parts = []
  let currentText = props.text
  
  // Handle newlines if preserveNewlines is true
  if (props.preserveNewlines) {
    currentText = currentText.replace(/\n/g, '<br>')
  }
  
  // Regular expression to find mana symbols like {U}, {2}, {W/U}, etc.
  const manaRegex = /{([^}]+)}/g
  let lastIndex = 0
  let match
  
  while ((match = manaRegex.exec(currentText)) !== null) {
    // Add text before the mana symbol
    if (match.index > lastIndex) {
      const textPart = currentText.slice(lastIndex, match.index)
      if (textPart) {
        parts.push({
          type: 'text',
          content: textPart
        })
      }
    }
    
    // Add the mana symbol
    parts.push({
      type: 'mana',
      symbol: match[1],
      original: match[0]
    })
    
    lastIndex = match.index + match[0].length
  }
  
  // Add remaining text after the last mana symbol
  if (lastIndex < currentText.length) {
    const textPart = currentText.slice(lastIndex)
    if (textPart) {
      parts.push({
        type: 'text',
        content: textPart
      })
    }
  }
  
  return parts
})

// Size classes for different symbol sizes
const sizeClass = computed(() => {
  const sizeClasses = {
    tiny: 'w-3 h-3 min-w-3',
    small: 'w-4 h-4 min-w-4',
    medium: 'w-5 h-5 min-w-5', 
    large: 'w-6 h-6 min-w-6'
  }
  
  return sizeClasses[props.size] || sizeClasses.small
})

// Get CSS class based on symbol type and size
const getSymbolClass = (symbol) => {
  return [
    'mana-symbol-item',
    `mana-${getSymbolType(symbol)}`
  ]
}

// Determine symbol type (colorless, colored, hybrid, etc.)
const getSymbolType = (symbol) => {
  // Colorless numbers
  if (/^\d+$/.test(symbol)) return 'colorless'
  
  // Basic colors
  if (['W', 'U', 'B', 'R', 'G'].includes(symbol)) return 'colored'
  
  // Hybrid mana (like W/U, 2/W, etc.)
  if (symbol.includes('/')) return 'hybrid'
  
  // Special symbols
  if (['C', 'X', 'Y', 'Z'].includes(symbol)) return 'special'
  
  // Phyrexian mana
  if (symbol.includes('P')) return 'phyrexian'
  
  // Energy counters
  if (symbol === 'E') return 'energy'
  
  // Tap/untap symbols
  if (['T', 'Q'].includes(symbol)) return 'tap'
  
  return 'other'
}

// Get tooltip text for accessibility
const getSymbolTooltip = (symbol) => {
  const colorNames = {
    'W': 'White',
    'U': 'Blue', 
    'B': 'Black',
    'R': 'Red',
    'G': 'Green',
    'C': 'Colorless'
  }
  
  const specialNames = {
    'T': 'Tap',
    'Q': 'Untap',
    'E': 'Energy',
    'X': 'X mana',
    'Y': 'Y mana',
    'Z': 'Z mana'
  }
  
  if (colorNames[symbol]) {
    return `${colorNames[symbol]} mana`
  }
  
  if (specialNames[symbol]) {
    return specialNames[symbol]
  }
  
  if (/^\d+$/.test(symbol)) {
    return `${symbol} generic mana`
  }
  
  if (symbol.includes('/')) {
    const parts = symbol.split('/')
    if (parts.length === 2) {
      const first = colorNames[parts[0]] || parts[0]
      const second = colorNames[parts[1]] || parts[1]
      return `${first}/${second} hybrid mana`
    }
  }
  
  if (symbol.includes('P')) {
    const baseSymbol = symbol.replace('P', '')
    const baseName = colorNames[baseSymbol] || baseSymbol
    return `Phyrexian ${baseName} mana`
  }
  
  return `${symbol} mana`
}

// Check if SVG file exists using the symbol map
const hasSvgFile = (symbol) => {
  return symbolMap.has(symbol)
}

// Get SVG URL from the symbol map
const getSvgPath = (symbol) => {
  return symbolMap.get(symbol) || ''
}

// Fallback colors for text display
const getSymbolColor = (symbol) => {
  const colors = {
    'W': '#fffbd5',
    'U': '#0e68ab', 
    'B': '#150b00',
    'R': '#d3202a',
    'G': '#00733e',
    'C': '#ccc2c0',
    'T': '#666',
    'Q': '#666',
    'E': '#FFD700',
    'X': '#ccc2c0',
    'Y': '#ccc2c0',
    'Z': '#ccc2c0'
  }
  
  if (colors[symbol]) return colors[symbol]
  
  if (/^\d+$/.test(symbol)) return '#ccc2c0' // Colorless
  
  if (symbol.includes('/')) {
    // For hybrid, use a gradient or the first color
    const firstColor = symbol.split('/')[0]
    return colors[firstColor] || '#999'
  }
  
  if (symbol.includes('P')) {
    // Phyrexian symbols - darker version of base color
    const baseSymbol = symbol.replace('P', '')
    const baseColor = colors[baseSymbol]
    if (baseColor) {
      // Darken the color for Phyrexian
      return baseColor === '#fffbd5' ? '#e6d700' : baseColor
    }
  }
  
  return '#666'
}

// Expose computed properties for parent components
const hasManaCosts = computed(() => {
  return parsedContent.value.some(part => part.type === 'mana')
})

const manaSymbolCount = computed(() => {
  return parsedContent.value.filter(part => part.type === 'mana').length
})

defineExpose({
  hasManaCosts,
  manaSymbolCount
})
</script>

<style scoped>
.mana-text-display {
  display: inline;
  line-height: inherit;
}

.mana-symbol-inline {
  display: inline-block;
  vertical-align: middle;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  margin: 0 1px;
}

.mana-text-fallback {
  border-radius: 50%;
  font-size: 0.625rem;
  line-height: 1;
  font-weight: 700;
  text-shadow: 0 1px 1px rgba(0,0,0,0.3);
}

/* Size-specific adjustments */
.w-3.mana-text-fallback {
  font-size: 0.5rem;
}

.w-4.mana-text-fallback {
  font-size: 0.625rem;
}

.w-5.mana-text-fallback {
  font-size: 0.75rem;
}

.w-6.mana-text-fallback {
  font-size: 0.875rem;
}

/* Hover effects for better UX */
.mana-symbol-inline:hover {
  transform: scale(1.1);
  transition: transform 0.1s ease;
  z-index: 10;
  position: relative;
}

/* Special styling for different mana types */
.mana-hybrid {
  position: relative;
  background: linear-gradient(45deg, transparent 45%, rgba(255,255,255,0.3) 50%, transparent 55%);
}

.mana-phyrexian {
  border: 1px solid rgba(0,0,0,0.3);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);
}

.mana-tap, .mana-energy {
  border: 1px solid rgba(0,0,0,0.2);
}

/* Ensure proper alignment in text */
.mana-symbol-inline img,
.mana-symbol-inline .mana-text-fallback {
  vertical-align: baseline;
  position: relative;
  top: -1px; /* Fine-tune alignment */
}
</style>