<script setup>
defineProps(['documents']);
const emit = defineEmits(['select', 'new-doc']);
</script>

<template>
  <div class="doc-list">
    <div class="header">
    
      <h2>All Documents</h2>
        <button @click="emit('new-doc')" class="plusbtn-all"> <img src="/public/plus.svg" id="plusbtn" alt="plus icon" height="50px" width="50px"></button>
    </div>

    <div class="test">
      <div v-for="d in documents" :key="d._id">
        <h3>
          <a href="#" @click.prevent="emit('select', d)">{{ d.title }}</a>
        </h3>
      </div>
    </div>
  </div>
</template>

<style src="../style/docs.css" scoped></style>
