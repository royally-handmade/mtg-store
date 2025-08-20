<template>
  <div class="bg-white rounded-lg shadow p-6">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-gray-600">{{ title }}</p>
        <p class="text-2xl font-bold text-gray-900">{{ value }}</p>
      </div>
      <div class="p-3 rounded-full" :class="iconBgColor">
        <component :is="iconComponent" class="h-6 w-6" :class="iconColor" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { 
  HeartIcon, 
  ShoppingCartIcon, 
  TruckIcon, 
  CurrencyDollarIcon,
  UserGroupIcon,
  DocumentTextIcon
} from '@heroicons/vue/24/outline'

const props = defineProps({
  title: String,
  value: [String, Number],
  icon: {
    type: String,
    default: 'document'
  }
})

const iconComponent = computed(() => {
  const icons = {
    heart: HeartIcon,
    'shopping-cart': ShoppingCartIcon,
    truck: TruckIcon,
    'currency-dollar': CurrencyDollarIcon,
    'user-group': UserGroupIcon,
    document: DocumentTextIcon
  }
  return icons[props.icon] || DocumentTextIcon
})

const iconBgColor = computed(() => {
  const colors = {
    heart: 'bg-red-100',
    'shopping-cart': 'bg-blue-100',
    truck: 'bg-green-100',
    'currency-dollar': 'bg-yellow-100',
    'user-group': 'bg-purple-100',
    document: 'bg-gray-100'
  }
  return colors[props.icon] || 'bg-gray-100'
})

const iconColor = computed(() => {
  const colors = {
    heart: 'text-red-600',
    'shopping-cart': 'text-blue-600',
    truck: 'text-green-600',
    'currency-dollar': 'text-yellow-600',
    'user-group': 'text-purple-600',
    document: 'text-gray-600'
  }
  return colors[props.icon] || 'text-gray-600'
})
</script>