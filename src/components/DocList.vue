<script setup>
defineProps(['documents']);
defineEmits(['select']);
</script>

<template>
  <div class="all-docs">
    <h2>All Documents</h2>
    <div v-for="d in documents" :key="d._id">
      <h3>
        <a href="#" @click.prevent="$emit('select', d)">{{ d.title }}</a>
      </h3>
    </div>
  </div>
</template>
