<script setup>
import { ref, onMounted, computed } from "vue";
import { useDocuments } from "../composables/useDocuments.js";
import { useAuth } from "../composables/User.js";
import DocumentList from "./DocList.vue";
import DocumentForm from "./DocForm.vue";

const { documents, fetchDocuments, addDocument, updateDocument, error } = useDocuments();
const selectedDoc = ref(null);

const { user, token } = useAuth();
const isLoggedIn = computed(() => !!token.value && !!user.value);
const userEmail = computed(() => user.value?.email ?? "");

onMounted(async () => {
  if (isLoggedIn.value) {
    await fetchDocuments();
    console.log("Docs in component:", documents.value);
  }
});


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
    console.log("Documents reactive:", documents.value);
  } catch (e) {
    console.error(e);
  }
};
</script>

<template>
  <div id="entire-app">
    <div v-if="isLoggedIn">
      <p>Welcome, {{ userEmail }}</p>
      <DocumentList :documents="documents" @select="selectDoc" />

    
      <DocumentForm
        v-if="selectedDoc"
        :key="selectedDoc._id"
        :doc="selectedDoc"
        @save="saveDoc"
      />

      <div v-else class="placeholder">
        <p>Select a document to start editing.</p>
      </div>
    </div>

    <div v-else>
      <p>Please log in to see your documents.</p>
    </div>

    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>
