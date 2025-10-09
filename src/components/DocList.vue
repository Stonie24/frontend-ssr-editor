<script setup>
defineProps(['documents']);
defineEmits(['select']);
</script>

<template>
  <h2>All Documents</h2>
  <div class="all-docs">
    
    <div v-for="d in documents" :key="d._id">
      <h3>
        <a href="#" @click.prevent="$emit('select', d)">{{ d.title }}</a>
      </h3>
    </div>
  </div>
</template>

<style src="../style/docs.css" scoped></style>