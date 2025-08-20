<template>
  <span 
    v-if="treatment && treatment !== 'normal'"
    :class="badgeClasses"
    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide"
  >
    <component 
      v-if="badgeIcon" 
      :is="badgeIcon" 
      class="w-3 h-3 mr-1" 
    />
    {{ displayText }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { 
  SparklesIcon,
  StarIcon,
  GiftIcon,
  CommandLineIcon,
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
    icon: GiftIcon
  },
  borderless: {
    text: 'Borderless',
    bgColor: 'bg-gradient-to-r from-indigo-500 to-blue-600',
    textColor: 'text-white',
    icon: CommandLineIcon
  },
  'extended-art': {
    text: 'Extended Art',
    bgColor: 'bg-gradient-to-r from-emerald-500 to-teal-600',
    textColor: 'text-white',
    icon: ShieldCheckIcon
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

const config = computed(() => {
  return treatmentConfig[props.treatment?.toLowerCase()] || {
    text: props.treatment,
    bgColor: 'bg-gray-500',
    textColor: 'text-white',
    icon: null
  }
})

const displayText = computed(() => config.value.text)
const badgeIcon = computed(() => config.value.icon)

const sizeClasses = computed(() => {
  const sizes = {
    xs: 'px-2 py-0.5 text-xs',
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1 text-base'
  }
  return sizes[props.size]
})

const badgeClasses = computed(() => {
  return [
    config.value.bgColor,
    config.value.textColor,
    sizeClasses.value,
    'shadow-sm',
    'border border-opacity-20 border-white'
  ].join(' ')
})
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

/* Hover effects */
span:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease-in-out;
}
</style>