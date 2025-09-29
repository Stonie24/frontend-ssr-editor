<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useDocuments } from "./composables/useDocuments";

const { documents, fetchDocuments, addDocument, error } = useDocuments();
const newDoc = ref({ title: "", content: "" });

onMounted(fetchDocuments);

const createDoc = async () => {
  try {
    await addDocument(newDoc.value);
    newDoc.value.title = "";
    newDoc.value.content = "";
    await fetchDocuments(); // refresh the list
  } catch (err) {
    console.error(err);
  }
};
</script>

<template>
  <div>
    <h1>Documents</h1>
    <div v-if="error">{{ error }}</div>

    <div v-for="d in documents" :key="d._id">
      <h3>
        <a :href="'/' + d._id">{{ d.title }}</a>
      </h3>
    </div>

    <h2>Add New Document</h2>
    <form @submit.prevent="createDoc">
      <label for="title">Title</label>
      <input id="title" v-model="newDoc.title" placeholder="Title" />

      <label for="content">Content</label>
      <textarea id="content" v-model="newDoc.content" placeholder="Content"></textarea>

      <button type="submit">Add Document</button>
    </form>
  </div>
</template>