<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useDocuments } from "./composables/useDocuments";

const { documents, fetchDocuments, addDocument, error } = useDocuments();
const newDoc = ref({ title: "", content: "" });

onMounted(fetchDocuments);

const createDoc = async () => {
  await addDocument(newDoc.value);
  newDoc.value.title = "";
  newDoc.value.content = "";
};
</script>

<template>
  <div>
    <h1>Documents</h1>
    <div v-if="error">{{ error }}</div>

    <ul>
      <li v-for="d in documents" :key="d.id">{{ d.title }}</li>
    </ul>

    <h2>Add New Document</h2>
    <input v-model="newDoc.title" placeholder="Title" />
    <textarea v-model="newDoc.content" placeholder="Content"></textarea>
    <button @click="createDoc">Add Document</button>
  </div>
</template>
