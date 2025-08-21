<!-- frontend/src/components/admin/ApplicationDetailModal.vue -->
<template>
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" @click="closeModal">
    <div class="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 xl:w-2/3 shadow-lg rounded-lg bg-white max-h-[90vh] overflow-y-auto" @click.stop>
      <div class="flex justify-between items-center mb-6">
        <h3 class="text-xl font-semibold text-gray-900">
          Seller Application Review
        </h3>
        <button @click="closeModal" class="text-gray-400 hover:text-gray-600">
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>

      <div class="space-y-8">
        <!-- Application Status Banner -->
        <div :class="getStatusBannerClass(application.status)" class="rounded-lg p-4">
          <div class="flex items-center">
            <component :is="getStatusIcon(application.status)" class="h-6 w-6 mr-3" />
            <div>
              <h4 class="font-medium">
                {{ getStatusTitle(application.status) }}
              </h4>
              <p class="text-sm mt-1">
                Submitted {{ formatDate(application.submitted_at) }}
                <span v-if="application.reviewed_by && application.status !== 'pending'">
                  • Reviewed {{ formatDate(application.approved_at || application.rejected_at || application.info_requested_at) }}
                </span>
              </p>
            </div>
          </div>
          <div v-if="application.admin_message" class="mt-3 text-sm">
            <strong>Admin Message:</strong> {{ application.admin_message }}
          </div>
          <div v-if="application.rejection_reason" class="mt-3 text-sm">
            <strong>Rejection Reason:</strong> {{ application.rejection_reason }}
          </div>
        </div>

        <!-- Quick Actions -->
        <div v-if="application.status === 'pending'" class="flex justify-end space-x-3">
          <button
            @click="showApprovalForm = true"
            class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center"
          >
            <CheckIcon class="h-4 w-4 mr-2" />
            Approve
          </button>
          <button
            @click="showInfoRequestForm = true"
            class="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 flex items-center"
          >
            <InformationCircleIcon class="h-4 w-4 mr-2" />
            Request Info
          </button>
          <button
            @click="showRejectionForm = true"
            class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center"
          >
            <XMarkIcon class="h-4 w-4 mr-2" />
            Reject
          </button>
        </div>

        <!-- Applicant Information -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Personal/Business Information -->
          <div class="bg-gray-50 rounded-lg p-6">
            <h4 class="text-lg font-medium text-gray-900 mb-4">Applicant Information</h4>
            <div class="space-y-4">
              <div class="flex items-center space-x-4">
                <div v-if="application.profiles?.avatar_url" class="flex-shrink-0">
                  <img :src="application.profiles.avatar_url" :alt="application.profiles.display_name" 
                    class="h-12 w-12 rounded-full object-cover">
                </div>
                <div v-else class="flex-shrink-0">
                  <div class="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center">
                    <UserIcon class="h-6 w-6 text-gray-600" />
                  </div>
                </div>
                <div>
                  <h5 class="font-medium text-gray-900">{{ application.profiles?.display_name || 'N/A' }}</h5>
                  <p class="text-sm text-gray-600">{{ application.profiles?.email }}</p>
                  <p class="text-xs text-gray-500">
                    Member since {{ formatDate(application.profiles?.created_at) }}
                  </p>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-3 text-sm">
                <div>
                  <span class="font-medium text-gray-700">Business Name:</span>
                  <span class="ml-2 text-gray-900">{{ application.business_name }}</span>
                </div>
                <div>
                  <span class="font-medium text-gray-700">Business Type:</span>
                  <span class="ml-2 text-gray-900 capitalize">{{ application.business_type }}</span>
                </div>
                <div v-if="application.tax_id">
                  <span class="font-medium text-gray-700">Tax ID:</span>
                  <span class="ml-2 text-gray-900">{{ application.tax_id }}</span>
                </div>
                <div>
                  <span class="font-medium text-gray-700">Experience:</span>
                  <span class="ml-2 text-gray-900">{{ application.experience_years }} years</span>
                </div>
                <div>
                  <span class="font-medium text-gray-700">Phone:</span>
                  <span class="ml-2 text-gray-900">{{ application.phone }}</span>
                </div>
              </div>

              <!-- Address -->
              <div v-if="application.address">
                <span class="font-medium text-gray-700 block mb-1">Address:</span>
                <div class="text-sm text-gray-900 ml-2">
                  <div>{{ application.address.street }}</div>
                  <div>{{ application.address.city }}, {{ application.address.province }}</div>
                  <div>{{ application.address.postal_code }}, {{ application.address.country }}</div>
                </div>
              </div>

              <!-- Description -->
              <div v-if="application.description">
                <span class="font-medium text-gray-700 block mb-1">Description:</span>
                <p class="text-sm text-gray-900 ml-2">{{ application.description }}</p>
              </div>

              <!-- References -->
              <div v-if="application.references && application.references.length > 0">
                <span class="font-medium text-gray-700 block mb-1">References:</span>
                <ul class="text-sm text-gray-900 ml-2 space-y-1">
                  <li v-for="(reference, index) in application.references" :key="index">
                    • {{ reference }}
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Activity & Stats -->
          <div class="bg-gray-50 rounded-lg p-6">
            <h4 class="text-lg font-medium text-gray-900 mb-4">Activity & Statistics</h4>
            <div class="space-y-4">
              <!-- Account Activity -->
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-white rounded-lg p-3 text-center">
                  <div class="text-2xl font-bold text-blue-600">{{ application.activity_stats?.order_count || 0 }}</div>
                  <div class="text-xs text-gray-600">Orders Placed</div>
                </div>
                <div class="bg-white rounded-lg p-3 text-center">
                  <div class="text-2xl font-bold text-green-600">
                    {{ application.seller_reviews?.length || 0 }}
                  </div>
                  <div class="text-xs text-gray-600">Reviews</div>
                </div>
              </div>

              <!-- Last Login -->
              <div v-if="application.profiles?.last_login_at">
                <span class="font-medium text-gray-700">Last Login:</span>
                <span class="ml-2 text-gray-900 text-sm">
                  {{ formatDateTime(application.profiles.last_login_at) }}
                </span>
              </div>

              <!-- Recent Login History -->
              <div v-if="application.activity_stats?.login_history">
                <span class="font-medium text-gray-700 block mb-2">Recent Logins:</span>
                <div class="space-y-1">
                  <div v-for="login in application.activity_stats.login_history.slice(0, 5)" 
                    :key="login.created_at" class="text-xs text-gray-600 ml-2">
                    {{ formatDateTime(login.created_at) }}
                    <span class="text-gray-400">from {{ login.ip_address }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Documents Section -->
        <div v-if="application.seller_documents && application.seller_documents.length > 0">
          <h4 class="text-lg font-medium text-gray-900 mb-4">Submitted Documents</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="document in application.seller_documents" :key="document.id"
              class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
              <div class="flex items-center justify-between">
                <div>
                  <h5 class="font-medium text-gray-900 capitalize">
                    {{ document.document_type.replace('_', ' ') }}
                  </h5>
                  <p class="text-sm text-gray-600">{{ document.file_name }}</p>
                  <p class="text-xs text-gray-500">
                    Uploaded {{ formatDate(document.uploaded_at) }}
                  </p>
                  <p class="text-xs text-gray-500">
                    {{ formatFileSize(document.file_size) }}
                  </p>
                </div>
                <div class="flex space-x-2">
                  <button
                    @click="downloadDocument(document)"
                    class="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    <ArrowDownTrayIcon class="h-4 w-4" />
                  </button>
                  <button
                    @click="viewDocument(document)"
                    class="text-gray-600 hover:text-gray-800 text-sm"
                  >
                    <EyeIcon class="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Additional Information Requests -->
        <div v-if="application.required_documents && application.required_documents.length > 0">
          <h4 class="text-lg font-medium text-gray-900 mb-4">Required Documents</h4>
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <ul class="list-disc list-inside space-y-1">
              <li v-for="doc in application.required_documents" :key="doc" class="text-sm text-yellow-800">
                {{ doc }}
              </li>
            </ul>
          </div>
        </div>

        <!-- Admin Notes -->
        <div v-if="application.admin_notes">
          <h4 class="text-lg font-medium text-gray-900 mb-4">Admin Notes</h4>
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p class="text-sm text-blue-800">{{ application.admin_notes }}</p>
          </div>
        </div>

        <!-- Action Forms -->
        <!-- Approval Form -->
        <div v-if="showApprovalForm" class="bg-green-50 border border-green-200 rounded-lg p-6">
          <h4 class="text-lg font-medium text-green-800 mb-4">Approve Application</h4>
          <form @submit.prevent="approveApplication" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Seller Tier
              </label>
              <select v-model="approvalForm.seller_tier" required
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500">
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea v-model="approvalForm.notes" rows="3"
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                placeholder="Add any notes for the seller..."></textarea>
            </div>
            <div class="flex justify-end space-x-3">
              <button type="button" @click="showApprovalForm = false"
                class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" :disabled="processing"
                class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50">
                {{ processing ? 'Approving...' : 'Approve Application' }}
              </button>
            </div>
          </form>
        </div>

        <!-- Info Request Form -->
        <div v-if="showInfoRequestForm" class="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h4 class="text-lg font-medium text-yellow-800 mb-4">Request Additional Information</h4>
          <form @submit.prevent="requestInfo" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Message to Applicant *
              </label>
              <textarea v-model="infoRequestForm.message" rows="4" required
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                placeholder="Explain what additional information is needed..."></textarea>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Required Documents
              </label>
              <div class="space-y-2">
                <label class="flex items-center">
                  <input type="checkbox" v-model="infoRequestForm.required_documents" value="Government ID"
                    class="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500">
                  <span class="ml-2 text-sm">Government ID</span>
                </label>
                <label class="flex items-center">
                  <input type="checkbox" v-model="infoRequestForm.required_documents" value="Business License"
                    class="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500">
                  <span class="ml-2 text-sm">Business License</span>
                </label>
                <label class="flex items-center">
                  <input type="checkbox" v-model="infoRequestForm.required_documents" value="Tax Documents"
                    class="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500">
                  <span class="ml-2 text-sm">Tax Documents</span>
                </label>
                <label class="flex items-center">
                  <input type="checkbox" v-model="infoRequestForm.required_documents" value="Bank Statements"
                    class="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500">
                  <span class="ml-2 text-sm">Bank Statements</span>
                </label>
              </div>
            </div>
            <div class="flex justify-end space-x-3">
              <button type="button" @click="showInfoRequestForm = false"
                class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" :disabled="processing"
                class="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50">
                {{ processing ? 'Sending...' : 'Request Information' }}
              </button>
            </div>
          </form>
        </div>

        <!-- Rejection Form -->
        <div v-if="showRejectionForm" class="bg-red-50 border border-red-200 rounded-lg p-6">
          <h4 class="text-lg font-medium text-red-800 mb-4">Reject Application</h4>
          <form @submit.prevent="rejectApplication" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Rejection Reason *
              </label>
              <select v-model="rejectionForm.reason" required
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 mb-2">
                <option value="">Select a reason</option>
                <option value="incomplete_application">Incomplete Application</option>
                <option value="insufficient_documentation">Insufficient Documentation</option>
                <option value="business_verification_failed">Business Verification Failed</option>
                <option value="risk_assessment_failed">Risk Assessment Failed</option>
                <option value="policy_violation">Policy Violation</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes
              </label>
              <textarea v-model="rejectionForm.notes" rows="4"
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                placeholder="Provide specific details about the rejection..."></textarea>
            </div>
            <div class="flex justify-end space-x-3">
              <button type="button" @click="showRejectionForm = false"
                class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" :disabled="processing"
                class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
                {{ processing ? 'Rejecting...' : 'Reject Application' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import {
  XMarkIcon,
  CheckIcon,
  InformationCircleIcon,
  UserIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/vue/24/outline'
import api from '@/lib/api'

const props = defineProps({
  application: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'approved', 'rejected', 'info-requested'])

// Reactive data
const showApprovalForm = ref(false)
const showInfoRequestForm = ref(false)
const showRejectionForm = ref(false)
const processing = ref(false)

const approvalForm = ref({
  seller_tier: 'standard',
  notes: ''
})

const infoRequestForm = ref({
  message: '',
  required_documents: []
})

const rejectionForm = ref({
  reason: '',
  notes: ''
})

// Methods
const closeModal = () => {
  emit('close')
}

const approveApplication = async () => {
  processing.value = true
  try {
    await api.post(`/admin/seller-applications/${props.application.id}/approve`, approvalForm.value)
    emit('approved')
    closeModal()
  } catch (error) {
    console.error('Error approving application:', error)
    alert('Error approving application: ' + (error.response?.data?.error || error.message))
  } finally {
    processing.value = false
  }
}

const requestInfo = async () => {
  processing.value = true
  try {
    await api.post(`/admin/seller-applications/${props.application.id}/request-info`, infoRequestForm.value)
    emit('info-requested')
    closeModal()
  } catch (error) {
    console.error('Error requesting info:', error)
    alert('Error requesting information: ' + (error.response?.data?.error || error.message))
  } finally {
    processing.value = false
  }
}

const rejectApplication = async () => {
  processing.value = true
  try {
    await api.post(`/admin/seller-applications/${props.application.id}/reject`, rejectionForm.value)
    emit('rejected')
    closeModal()
  } catch (error) {
    console.error('Error rejecting application:', error)
    alert('Error rejecting application: ' + (error.response?.data?.error || error.message))
  } finally {
    processing.value = false
  }
}

const downloadDocument = async (document) => {
  try {
    const response = await api.get(
      `/admin/seller-applications/${props.application.id}/documents/${document.id}`,
      { responseType: 'blob' }
    )
    
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', document.file_name)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error downloading document:', error)
    alert('Error downloading document')
  }
}

const viewDocument = (document) => {
  // This would open document in a new tab or modal
  alert('Document viewer would be implemented here')
}

// Formatting methods
const formatDate = (date) => {
  return new Date(date).toLocaleDateString()
}

const formatDateTime = (date) => {
  return new Date(date).toLocaleString()
}

const formatFileSize = (bytes) => {
  if (!bytes) return 'Unknown size'
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

const getStatusBannerClass = (status) => {
  const classes = {
    'pending': 'bg-yellow-100 border border-yellow-200 text-yellow-800',
    'info_requested': 'bg-blue-100 border border-blue-200 text-blue-800',
    'approved': 'bg-green-100 border border-green-200 text-green-800',
    'rejected': 'bg-red-100 border border-red-200 text-red-800'
  }
  return classes[status] || 'bg-gray-100 border border-gray-200 text-gray-800'
}

const getStatusTitle = (status) => {
  const titles = {
    'pending': 'Application Pending Review',
    'info_requested': 'Additional Information Requested',
    'approved': 'Application Approved',
    'rejected': 'Application Rejected'
  }
  return titles[status] || 'Application Status'
}

const getStatusIcon = (status) => {
  const icons = {
    'pending': ClockIcon,
    'info_requested': InformationCircleIcon,
    'approved': CheckCircleIcon,
    'rejected': ExclamationTriangleIcon
  }
  return icons[status] || ClockIcon
}
</script>