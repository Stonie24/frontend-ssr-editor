<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useDocuments } from "./composables/useDocuments";

const { documents, fetchDocuments, addDocument, updateDocument, error } = useDocuments();
const selectedDoc = ref<{ _id?: string; title: string; content: string } | null>({
  title: "",
  content: "",
});

// Load all documents on mount
onMounted(fetchDocuments);

// Select a document for editing
const selectDoc = (doc: any) => {
  selectedDoc.value = { ...doc };
};

// Create or update document
const saveDoc = async () => {
  if (!selectedDoc.value) return;

  try {
    if (selectedDoc.value._id) {
      await updateDocument(selectedDoc.value._id, selectedDoc.value);
    } else {
      await addDocument(selectedDoc.value);
    }

    // Reset form
    selectedDoc.value = { title: "", content: "" };
    await fetchDocuments();
  } catch (err) {
    console.error(err);
  }
};
</script>

<template>
  <div>
    <h1>Documents</h1>
    <div v-if="error">{{ error }}</div>

    <h2>All Documents</h2>
    <div v-for="d in documents" :key="d._id">
      <h3>
        <a href="#" @click.prevent="selectDoc(d)">{{ d.title }}</a>
      </h3>
    </div>

    <h2>{{ selectedDoc && selectedDoc._id ? 'Edit Document' : 'Add New Document' }}</h2>
    <form @submit.prevent="saveDoc" class="new-doc">
      <div id="doc-header">
         <label for="title"> <h3>Title</h3></label>
          <input id="title" v-model="selectedDoc.title" placeholder="Title" required />
          <button type="submit">
            {{ selectedDoc && selectedDoc._id ? 'Save' : 'Create' }}
          </button>
      </div>
     
      <textarea id="content" v-model="selectedDoc.content" placeholder="Content" required class="document-body"></textarea>

      
    </form>
  </div>
</template>
