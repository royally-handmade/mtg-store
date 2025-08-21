<!-- frontend/src/components/seller/SalesChart.vue -->
<template>
  <div class="w-full h-64">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted } from 'vue'
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

// Register Chart.js components
Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const props = defineProps({
  data: {
    type: Object,
    required: true,
    default: () => ({})
  },
  type: {
    type: String,
    default: 'sales', // 'sales', 'revenue', 'orders'
    validator: (value) => ['sales', 'revenue', 'orders'].includes(value)
  },
  period: {
    type: String,
    default: 'monthly', // 'daily', 'weekly', 'monthly'
    validator: (value) => ['daily', 'weekly', 'monthly'].includes(value)
  }
})

const chartCanvas = ref(null)
let chartInstance = null

const getChartConfig = () => {
  const labels = Object.keys(props.data).sort()
  const values = labels.map(label => props.data[label] || 0)

  // Generate colors based on chart type
  const getColor = (type) => {
    const colors = {
      sales: {
        background: 'rgba(59, 130, 246, 0.1)',
        border: 'rgba(59, 130, 246, 1)',
        point: 'rgba(59, 130, 246, 1)'
      },
      revenue: {
        background: 'rgba(16, 185, 129, 0.1)',
        border: 'rgba(16, 185, 129, 1)',
        point: 'rgba(16, 185, 129, 1)'
      },
      orders: {
        background: 'rgba(245, 158, 11, 0.1)',
        border: 'rgba(245, 158, 11, 1)',
        point: 'rgba(245, 158, 11, 1)'
      }
    }
    return colors[type] || colors.sales
  }

  const colorScheme = getColor(props.type)

  // Format labels based on period
  const formatLabel = (label) => {
    const date = new Date(label + '-01') // Assuming YYYY-MM format
    
    switch (props.period) {
      case 'daily':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      case 'weekly':
        return `Week ${label}`
      case 'monthly':
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      default:
        return label
    }
  }

  // Format values for display
  const formatValue = (value) => {
    if (props.type === 'revenue') {
      return `$${value.toFixed(2)}`
    }
    return value.toString()
  }

  return {
    type: 'line',
    data: {
      labels: labels.map(formatLabel),
      datasets: [{
        label: getDatasetLabel(),
        data: values,
        borderColor: colorScheme.border,
        backgroundColor: colorScheme.background,
        pointBackgroundColor: colorScheme.point,
        pointBorderColor: colorScheme.border,
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: colorScheme.border,
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: colorScheme.border,
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return formatValue(context.parsed.y)
            }
          }
        }
      },
      scales: {
        x: {
          display: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.1)',
            borderDash: [2, 2]
          },
          ticks: {
            color: '#6B7280',
            font: {
              size: 12
            }
          }
        },
        y: {
          display: true,
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.1)',
            borderDash: [2, 2]
          },
          ticks: {
            color: '#6B7280',
            font: {
              size: 12
            },
            callback: function(value) {
              if (props.type === 'revenue') {
                return '$' + value.toLocaleString()
              }
              return value.toLocaleString()
            }
          }
        }
      },
      elements: {
        point: {
          hoverRadius: 8
        }
      },
      animation: {
        duration: 750,
        easing: 'easeInOutQuart'
      }
    }
  }
}

const getDatasetLabel = () => {
  const labels = {
    sales: 'Sales',
    revenue: 'Revenue',
    orders: 'Orders'
  }
  return labels[props.type] || 'Data'
}

const createChart = () => {
  if (chartInstance) {
    chartInstance.destroy()
  }

  const ctx = chartCanvas.value?.getContext('2d')
  if (!ctx) return

  chartInstance = new Chart(ctx, getChartConfig())
}

const updateChart = () => {
  if (!chartInstance) return

  const config = getChartConfig()
  chartInstance.data = config.data
  chartInstance.options = config.options
  chartInstance.update('active')
}

// Watch for data changes
watch([() => props.data, () => props.type, () => props.period], () => {
  if (chartInstance) {
    updateChart()
  } else {
    createChart()
  }
}, { deep: true })

onMounted(() => {
  // Small delay to ensure canvas is ready
  setTimeout(() => {
    createChart()
  }, 100)
})

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
})
</script>

<style scoped>
canvas {
  max-height: 300px;
}

/* Ensure chart container has proper dimensions */
.chart-container {
  position: relative;
  height: 256px; /* h-64 equivalent */
  width: 100%;
}
</style>