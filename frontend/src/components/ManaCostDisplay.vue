<template>
  <div class="mana-cost-display flex items-center gap-1">
    <div
      v-for="(symbol, index) in manaSymbols"
      :key="index"
      class="mana-symbol inline-block"
      :class="getSymbolClass(symbol)"
      :title="getSymbolTooltip(symbol)"
    >
      <!-- SVG will be loaded here once you have the files -->
      <img
        v-if="hasSvgFile(symbol)"
        :src="getSvgPath(symbol)"
        :alt="symbol"
        class="w-5 h-5"
      />
      <!-- Fallback text display until SVGs are available -->
      <span
        v-else
        class="mana-text text-xs font-bold px-1 py-0.5 rounded text-white"
        :style="{ backgroundColor: getSymbolColor(symbol) }"
      >
        {{ symbol }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed, defineProps } from 'vue'
import symbolsData from '../symbols.json'

const props = defineProps({
  manaCost: {
    type: String,
    default: '',
    required: true
  },
  size: {
    type: String,
    default: 'medium',
    validator: value => ['small', 'medium', 'large'].includes(value)
  },
  svgBasePath: {
    type: String,
    default: '/assets/mana-symbols/'
  }
})

// Create a lookup map for symbol to SVG URI
const symbolMap = new Map(
  symbolsData.data.map(item => [
    item.symbol.replace(/[{}]/g, ''), // Remove braces from symbol
    item.svg_uri
  ])
)

// Parse mana cost string like "{2}{R}{W}" into individual symbols
const manaSymbols = computed(() => {
  if (!props.manaCost) return []
  
  // Extract mana symbols from curly braces
  const matches = props.manaCost.match(/{[^}]+}/g) || []
  return matches.map(match => match.slice(1, -1)) // Remove { and }
})

// Get CSS class based on symbol type and size
const getSymbolClass = (symbol) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-5 h-5', 
    large: 'w-6 h-6'
  }
  
  return [
    'mana-symbol-item',
    sizeClasses[props.size],
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
  
  if (colorNames[symbol]) {
    return `${colorNames[symbol]} mana`
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
    'C': '#ccc2c0'
  }
  
  if (colors[symbol]) return colors[symbol]
  
  if (/^\d+$/.test(symbol)) return '#ccc2c0' // Colorless
  
  if (symbol.includes('/')) {
    // For hybrid, use a gradient or the first color
    const firstColor = symbol.split('/')[0]
    return colors[firstColor] || '#999'
  }
  
  return '#666'
}

// Expose method for parent components to check if component has symbols
const hasSymbols = computed(() => manaSymbols.value.length > 0)

defineExpose({
  hasSymbols,
  symbolCount: computed(() => manaSymbols.value.length)
})
</script>

<style scoped>
.mana-cost-display {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
}

.mana-symbol {
  display: inline-block;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.mana-text {
  border-radius: 50%;
  min-width: 1.25rem;
  height: 1.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  line-height: 1;
}

/* Size variations */
.mana-cost-display.size-small .mana-text {
  min-width: 1rem;
  height: 1rem;
  font-size: 0.625rem;
}

.mana-cost-display.size-large .mana-text {
  min-width: 1.5rem;
  height: 1.5rem;
  font-size: 0.875rem;
}

/* Hover effects */
.mana-symbol:hover {
  transform: scale(1.1);
  transition: transform 0.1s ease;
}

/* Special styling for different mana types */
.mana-hybrid {
  position: relative;
}

.mana-phyrexian {
  border: 1px solid #666;
}
</style>