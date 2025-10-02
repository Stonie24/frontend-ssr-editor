<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useDocuments } from "../composables/useDocuments";
import DocumentList from "../components/DocList.vue";
import DocumentForm from "../components/DocForm.vue";

type DocType = { _id?: string; title: string; content: string; created_at?: string };

const { documents, fetchDocuments, addDocument, updateDocument, error } = useDocuments();
const selectedDoc = ref<DocType | null>(null);

onMounted(fetchDocuments);

const selectDoc = (doc: DocType) => {
  selectedDoc.value = { ...doc };
};

const saveDoc = async (doc: DocType) => {
  try {
    if (doc._id) {
      await updateDocument(doc._id, doc);
    } else {
      await addDocument(doc);
    }
    selectedDoc.value = null;
    await fetchDocuments();
  } catch (e) {
    console.error(e);
  }
};
</script>

<template>
  <div id="entire-app">
    <h1>Documents</h1>
    <div v-if="error">{{ error }}</div>

    <DocumentList :documents="documents" @select="selectDoc" />
    <DocumentForm :doc="selectedDoc" @save="saveDoc" />
  </div>
</template>
