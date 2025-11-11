<template>
  <div class="inline-flex items-center gap-1 flex-wrap">
    <span
      v-for="(singleTreatment, index) in filteredTreatments"
      :key="index"
      :class="getBadgeClasses(singleTreatment)"
      :title="condensed ? getDisplayText(singleTreatment) : undefined"
      class="inline-flex items-center rounded-full font-medium uppercase tracking-wide"
    >
      <component
        v-if="getBadgeIcon(singleTreatment)"
        :is="getBadgeIcon(singleTreatment)"
        :class="condensed ? 'w-3 h-3' : 'w-3 h-3 mr-1'"
      />
      <span v-if="!condensed">{{ getDisplayText(singleTreatment) }}</span>
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { 
  SparklesIcon,
  StarIcon,
  StopIcon,
  ShieldCheckIcon
} from '@heroicons/vue/24/solid'

const props = defineProps({
  treatment: {
    type: String,
    required: true
  },
  size: {
    type: String,
    default: 'sm',
    validator: (value) => ['xs', 'sm', 'md', 'lg'].includes(value)
  },
  condensed: {
    type: Boolean,
    default: false
  }
})

const treatmentConfig = {
  foil: {
    text: 'Foil',
    bgColor: 'bg-gradient-to-r from-yellow-400 to-yellow-600',
    textColor: 'text-white',
    icon: SparklesIcon
  },
  'foil-etched': {
    text: 'Foil Etched',
    bgColor: 'bg-gradient-to-r from-amber-500 to-orange-600',
    textColor: 'text-white',
    icon: StarIcon
  },
  showcase: {
    text: 'Showcase',
    bgColor: 'bg-gradient-to-r from-purple-500 to-purple-700',
    textColor: 'text-white',
    icon: StarIcon
  },
  borderless: {
    text: 'Borderless',
    bgColor: 'bg-gradient-to-r from-indigo-500 to-blue-600',
    textColor: 'text-white',
    icon: StopIcon
  },
  'extended-art': {
    text: 'Extended Art',
    bgColor: 'bg-gradient-to-r from-emerald-500 to-teal-600',
    textColor: 'text-white',
    icon: StarIcon
  },
  retro: {
    text: 'Retro',
    bgColor: 'bg-gradient-to-r from-orange-500 to-red-600',
    textColor: 'text-white',
    icon: StarIcon
  },
  serialized: {
    text: 'Serialized',
    bgColor: 'bg-gradient-to-r from-gray-800 to-black',
    textColor: 'text-white',
    icon: ShieldCheckIcon
  },
  gilded: {
    text: 'Gilded',
    bgColor: 'bg-gradient-to-r from-yellow-600 to-amber-700',
    textColor: 'text-white',
    icon: SparklesIcon
  }
}

/**
 * Split comma-separated treatments, trim whitespace, and filter out invalid values
 * This computed property handles all filtering, so the template can be simpler
 */
const filteredTreatments = computed(() => {
  if (!props.treatment) return []
  
  return props.treatment
  .replace('-',' ')
    .split(',')
    .map(t => t.trim())
    .filter(t => {
      // Filter out empty strings and 'normal' treatment
      return t.length > 0 && t.toLowerCase() !== 'normal' && t.toLocaleLowerCase() !== 'foil'
    })
})

// Get config for a specific treatment
const getConfig = (treatment) => {
  return treatmentConfig[treatment?.toLowerCase()] || {
    text: treatment,
    bgColor: 'bg-gradient-to-r from-yellow-400 to-yellow-600',
    textColor: 'text-white',
    icon: SparklesIcon
  }
}

const getDisplayText = (treatment) => {
  return getConfig(treatment).text
}

const getBadgeIcon = (treatment) => {
  return getConfig(treatment).icon
}

const sizeClasses = computed(() => {
  if (props.condensed) {
    const condensedSizes = {
      xs: 'p-1',
      sm: 'p-1',
      md: 'p-1.5',
      lg: 'p-2'
    }
    return condensedSizes[props.size]
  }

  const sizes = {
    xs: 'px-2 py-0.5 text-xs',
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1 text-base'
  }
  return sizes[props.size]
})

const getBadgeClasses = (treatment) => {
  const config = getConfig(treatment)
  return [
    config.bgColor,
    config.textColor,
    sizeClasses.value,
    'shadow-sm',
    'border border-opacity-20 border-white'
  ].join(' ')
}
</script>

<style scoped>
/* Add some shine effect for foil treatments */
.bg-gradient-to-r.from-yellow-400 {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 25%, #fbbf24 50%, #f59e0b 75%, #fbbf24 100%);
  background-size: 200% 200%;
  animation: shine 3s ease-in-out infinite;
}

.bg-gradient-to-r.from-amber-500 {
  background: linear-gradient(135deg, #f59e0b 0%, #ea580c 25%, #f59e0b 50%, #ea580c 75%, #f59e0b 100%);
  background-size: 200% 200%;
  animation: shine 3s ease-in-out infinite;
}

@keyframes shine {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
</style>