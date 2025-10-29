<script setup>
import { ref, onMounted, computed } from "vue";
import { useDocuments } from "../composables/useDocuments.js";
import { useAuth } from "../composables/User.js";
import DocumentList from "./DocList.vue";
import DocumentForm from "./DocForm.vue";

const { documents, fetchDocuments, addDocument, updateDocument, error } = useDocuments();

const selectedDoc = ref({
  _id: null,
  title: "",
  content: "",
  type: "text",
});

const { user, token } = useAuth();
const isLoggedIn = computed(() => !!token.value && !!user.value);

onMounted(async () => {
  if (isLoggedIn.value) {
    await fetchDocuments();
  }
});


const selectDoc = (doc) => {
  selectedDoc.value = { type: "text", ...doc };
};

const saveDoc = async (doc) => {
  try {
    if (doc._id) {
      const updated = await updateDocument(doc._id, doc);
      selectedDoc.value = { ...updated };
    } else {
      const created = await addDocument({
        title: doc.title,
        content: doc.content,
        type: doc.type || "text",
      });
      selectedDoc.value = created && created._id ? { ...created } : null;
    }

    await fetchDocuments();
  } catch (e) {
    console.error(e);
  }
};

const newDoc = () => {
  selectedDoc.value = { _id: null, title: "", content: "", type: "text" };
};
</script>

<template>
  <div id="entire-app">
    <div v-if="isLoggedIn">
      <div class="docs-container">
        <DocumentList
          :documents="documents"
          @select="selectDoc"
          @new-doc="newDoc"
        />

        <DocumentForm
          :key="selectedDoc?._id || 'new'"
          :doc="selectedDoc"
          @save="saveDoc"
        />
      </div>
    </div>

    <div v-else>
      <p>Please log in to see your documents.</p>
    </div>

    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>
