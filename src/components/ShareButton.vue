<template>
  <button class="my-button" @click="handleClick">
    {{ label }}
  </button>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  label: {
    type: String,
    default: ''
  }
})


const emit = defineEmits(['click'])

function handleClick() {
  emit('click')
}
</script>
<style scoped>
.my-button {
    padding: 10px 20px;
    background-color: green;
    color: white;
    border-radius: 10px;
}
</style>
