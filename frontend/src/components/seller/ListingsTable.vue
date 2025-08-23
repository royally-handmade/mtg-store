<template>
  <div class="overflow-x-auto">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Card
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Price
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Condition
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Quantity
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Status
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Actions
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        <tr v-for="listing in listings" :key="listing.id" class="hover:bg-gray-50">
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center">
              <img :src="listing.cards.image_url" :alt="listing.cards.name" 
                class="h-12 w-8 object-cover rounded mr-3" />
              <div>
                <div class="text-sm font-medium text-gray-900">
                  {{ listing.cards.name }}
                </div>
                <div class="text-sm text-gray-500">
                  {{ listing.cards.set_number }}
                </div>
              </div>
            </div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            ${{ listing.price }} CAD
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            {{ listing.condition.toUpperCase() }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            {{ listing.quantity }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span :class="getStatusColor(listing.status)" 
              class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
              {{ listing.status.toUpperCase() }}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
            <button @click="$emit('edit', listing)" 
              class="text-blue-600 hover:text-blue-900">
              Edit
            </button>
            <button @click="$emit('delete', listing.id)" 
              class="text-red-600 hover:text-red-900">
              Delete
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
defineProps({
  listings: {
    type: Array,
    required: true
  }
})

defineEmits(['edit', 'delete'])

const getStatusColor = (status) => {
  const colors = {
    active: 'bg-green-100 text-green-800',
    sold: 'bg-blue-100 text-blue-800',
    removed: 'bg-red-100 text-red-800'
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}
</script>