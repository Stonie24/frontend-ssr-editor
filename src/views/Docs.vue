<script setup>
import { ref, onMounted } from "vue";
import { useDocuments } from "../composables/useDocuments";
import DocumentList from "../components/DocList.vue";
import DocumentForm from "../components/DocForm.vue";

const { documents, fetchDocuments, addDocument, updateDocument, error } = useDocuments();
const selectedDoc = ref(null);

onMounted(fetchDocuments);

const selectDoc = (doc) => {
  selectedDoc.value = { ...doc };
};

const saveDoc = async (doc) => {
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

    <div v-if="error">{{ error }}</div>

    <DocumentList :documents="documents" @select="selectDoc" />
    <DocumentForm :doc="selectedDoc" @save="saveDoc" />
  </div>
</template>

<style src="../style/docs.css" scoped></style>
