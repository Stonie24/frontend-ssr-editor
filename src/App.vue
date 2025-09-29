<template>
  <div>
    <ul>
      <li v-for="doc in docs" :key="doc.id">{{ doc.title }}</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { getDocs } from "@/api/docs";

const docs = ref([]);

onMounted(async () => {
  const data = await getDocs();
  if (data) docs.value = data;
});
</script>
