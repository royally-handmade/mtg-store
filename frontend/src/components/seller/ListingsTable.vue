<template>
  <div>
    <!-- Desktop Table View (hidden on mobile) -->
    <div class="hidden md:block overflow-x-auto">
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
          <tr v-for="listing in listings" :key="listing.id" class="hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <img 
                  :src="listing.cards.image_url" 
                  :alt="listing.cards.name" 
                  class="h-12 w-8 object-cover rounded mr-3" 
                />
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
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 uppercase">
              {{ listing.condition }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
              {{ listing.quantity }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span 
                :class="getStatusColor(listing.status)" 
                class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full uppercase"
              >
                {{ listing.status }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
              <button 
                @click="$emit('edit', listing)" 
                class="text-blue-600 hover:text-blue-900 transition-colors"
              >
                Edit
              </button>
              <button 
                @click="$emit('delete', listing.id)" 
                class="text-red-600 hover:text-red-900 transition-colors"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile Card View (shown only on mobile) -->
    <div class="md:hidden space-y-4">
      <div 
        v-for="listing in listings" 
        :key="listing.id"
        class="bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
      >
        <!-- Card Header with Image and Name -->
        <div class="p-4 flex items-start space-x-3">
          <img 
            :src="listing.cards.image_url" 
            :alt="listing.cards.name" 
            class="h-20 w-14 object-cover rounded flex-shrink-0" 
          />
          <div class="flex-1 min-w-0">
            <h3 class="text-base font-semibold text-gray-900 mb-1 truncate">
              {{ listing.cards.name }}
            </h3>
            <p class="text-sm text-gray-500 mb-2">
              {{ listing.cards.set_number }}
            </p>
            <span 
              :class="getStatusColor(listing.status)" 
              class="inline-flex px-2 py-1 text-xs font-semibold rounded-full uppercase"
            >
              {{ listing.status }}
            </span>
          </div>
        </div>

        <!-- Card Details Grid -->
        <div class="px-4 pb-3 grid grid-cols-3 gap-3 border-t border-gray-100 pt-3">
          <div>
            <p class="text-xs text-gray-500 mb-1">Price</p>
            <p class="text-sm font-semibold text-gray-900">${{ listing.price }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 mb-1">Condition</p>
            <p class="text-sm font-semibold text-gray-900 uppercase">{{ listing.condition }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 mb-1">Quantity</p>
            <p class="text-sm font-semibold text-gray-900">{{ listing.quantity }}</p>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="px-4 pb-4 flex gap-2">
          <button 
            @click="$emit('edit', listing)" 
            class="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            Edit
          </button>
          <button 
            @click="$emit('delete', listing.id)" 
            class="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="listings.length === 0" class="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
        <p class="text-gray-500">No listings found</p>
      </div>
    </div>
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
    removed: 'bg-red-100 text-red-800',
    inactive: 'bg-gray-100 text-gray-800'
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}
</script>

<style scoped>
/* Ensure buttons have adequate touch targets on mobile */
@media (max-width: 768px) {
  button {
    min-height: 44px;
  }
}
</style>