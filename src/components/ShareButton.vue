<template>
  <div>
    <button class="button" @click="openModal">
      {{ label }}
    </button>

    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <h3>Share document</h3>
        <label>
          Email
          <input v-model="email" type="email" placeholder="example@example.com" />
        </label>
        <div class="modal-actions">
          <button class="btn cancel" @click="closeModal">Cancel</button>
          <button class="btn send" @click="sendShare">Send</button>
        </div>
        <p class="error" v-if="error">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  label: {
    type: String,
    default: ''
  },
  docId: {
    type: [String, Number],
    required: false,
  }
})

const emit = defineEmits(['click', 'share'])

const showModal = ref(false)
const email = ref('')
const error = ref('')

import { useDocuments } from '../composables/useDocuments.js'
const { shareDocument } = useDocuments()

function openModal() {
  error.value = ''
  showModal.value = true
  emit('click')
}

function closeModal() {
  showModal.value = false
  email.value = ''
  error.value = ''
}

function validateEmail(e) {
  if (!e) return false
  const re = /^\S+@\S+\.\S+$/
  return re.test(e)
}

async function sendShare() {
  error.value = ''
  if (!validateEmail(email.value)) {
    error.value = 'Please enter a valid email address.'
    return
  }

  if (props.docId) {
    const result = await shareDocument(props.docId, email.value)
    if (!result) {
      error.value = 'Failed to share document. Please try again.'
      return
    }

    closeModal()
    return
  }


  closeModal()
}
</script>

<style src="../style/modal.css" scoped></style>