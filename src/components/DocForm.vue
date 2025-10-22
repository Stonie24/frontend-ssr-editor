<script setup>
import { ref, watch, onUnmounted } from "vue";
import { io } from "socket.io-client";
import * as Y from "yjs";

import ShareButton from "./ShareButton.vue";
import CodeEditor from "./CodeEditor.vue";


const socket = io("https://jsramverk-wisesang-e6hme9cec4d2fybq.northeurope-01.azurewebsites.net/");
const props = defineProps(["doc"]);
const emit = defineEmits(["save"]);
const localDoc = ref({ title: "", content: "", type: "text", _id: null });


let ydoc = null;
let ytext = null;
let currentDocId = null;


watch(
  () => props.doc,
  (v) => {
    localDoc.value = v ? { ...v } : { title: "", content: "", type: "text", _id: null };

    if (v && v._id) {
      console.log("Joining collaborative document:", v._id);
      currentDocId = v._id;
      socket.emit("joinDoc", currentDocId);
    } else {
      // Reset if creating new doc
      currentDocId = null;
      ydoc = null;
      ytext = null;
    }
  },
  { immediate: true }
);

// ---------------------------
// Receive initial document data from server
// ---------------------------
socket.on("initDoc", ({ docId, update }) => {
  if (docId !== currentDocId) return;
  console.log("Received initial Yjs document for", docId);

  // Create Yjs doc only once
  if (!ydoc) {
    ydoc = new Y.Doc();
    ytext = ydoc.getText("content");

    // Update Vue model when Yjs changes
    ytext.observe(() => {
      const newContent = ytext.toString();
      if (localDoc.value.content !== newContent) {
        localDoc.value.content = newContent;
      }
    });

    // Send Yjs updates to server
    ydoc.on("update", (update) => {
      socket.emit("docChange", { docId: currentDocId, update });
    });
  }

  // Apply update from server
  Y.applyUpdate(ydoc, new Uint8Array(update));
});

// ---------------------------
// Handle incoming updates from others
// ---------------------------
socket.on("docUpdate", ({ docId, update }) => {
  if (docId === currentDocId && ydoc) {
    Y.applyUpdate(ydoc, new Uint8Array(update));
  }
});

// ---------------------------
// Server requesting a save (before new user joins)
// ---------------------------
socket.on("requestSave", async ({ docId }) => {
  if (docId !== currentDocId) return;

  console.log("Server requested save before join:", docId);

  const updatedDoc = {
    ...localDoc.value,
    content: ytext ? ytext.toString() : localDoc.value.content,
  };

  try {
    await fetch(`/api/docs/${docId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedDoc),
    });
    console.log("Document saved successfully.");
  } catch (err) {
    console.error("Failed to save document:", err);
  }
});

// ---------------------------
// Sync Vue edits -> Yjs text
// ---------------------------
watch(
  () => localDoc.value.content,
  (newVal) => {
    if (ytext && newVal !== ytext.toString()) {
      ytext.delete(0, ytext.length);
      ytext.insert(0, newVal);
    }
  }
);

// ---------------------------
// Manual save button
// ---------------------------
function submit() {
  const updatedDoc = {
    ...localDoc.value,
    updated_at: new Date().toISOString(),
  };
  emit("save", updatedDoc);
}

// ---------------------------
// Clean up on unmount
// ---------------------------
onUnmounted(() => {
  socket.off("initDoc");
  socket.off("docUpdate");
  socket.off("requestSave");
});
</script>

<template>
  <div class="doc-editor">
    <h2>{{ localDoc._id ? "Edit Document" : "Create Document" }}</h2>

    <!-- Show Share button only if editing existing doc -->
    <ShareButton v-if="localDoc._id" label="Share this document" />

    <form @submit.prevent="submit">
      <button type="submit">{{ localDoc._id ? "Save" : "Create" }}</button>

      <label>Title</label>
      <input v-model="localDoc.title" type="text" placeholder="Title" required />

      <label>Document type</label>
      <select v-model="localDoc.type" :disabled="!!localDoc._id">
        <option value="text">Plain Text</option>
        <option value="code">JavaScript Code</option>
      </select>

      <CodeEditor v-model="localDoc.content" :mode="localDoc.type" />
    </form>
  </div>
</template>

<style scoped src="../style/docs.css"></style>
