<script setup>
import { ref, watch, onUnmounted } from "vue";
import { io } from "socket.io-client";
import * as Y from "yjs";

const socket = io("https://jsramverk-wisesang-e6hme9cec4d2fybq.northeurope-01.azurewebsites.net/");

const props = defineProps(["doc"]);
const emit = defineEmits(["save"]);

const localDoc = ref({ title: "", content: "" });

// Yjs document and shared text
let ydoc = null;
let ytext = null;

// Track the docId we're currently editing
let currentDocId = null;

// ---------------------------
// Listen for save requests from server (save-on-join)
// ---------------------------
socket.on("requestSave", async ({ docId }) => {
  if (docId === currentDocId) {
    console.log("Server requested save before new user joins.");

    const updatedDoc = {
      ...localDoc.value,
      content: localDoc.value.content,
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
  }
});

// ---------------------------
// Watch for doc prop changes
// ---------------------------
watch(
  () => props.doc,
  (v) => {
    localDoc.value = v ? { ...v } : { title: "", content: "" };

    if (v && v._id) {
      console.log("Joining collaborative document:", v._id);

      currentDocId = v._id;
      socket.emit("joinDoc", currentDocId);
    }
  },
  { immediate: true }
);

// ---------------------------
// Handle initial document state from server
// ---------------------------
socket.on("initDoc", ({ docId, update }) => {
  if (docId !== currentDocId) return;

  console.log("Received initial document state for", docId);

  // Destroy old Yjs doc to avoid ghost text
  if (ydoc) ydoc.destroy();

  // Create a fresh Yjs doc
  ydoc = new Y.Doc();
  ytext = ydoc.getText("content");

  // Apply the update from server
  Y.applyUpdate(ydoc, new Uint8Array(update));

  // Observe Yjs changes and sync to localDoc
  ytext.observe(() => {
    const newContent = ytext.toString();
    if (localDoc.value.content !== newContent) {
      localDoc.value.content = newContent;
    }
  });

  // Emit local changes to other clients
  ydoc.on("update", (update) => {
    socket.emit("docChange", { docId: currentDocId, update });
  });
});

// ---------------------------
// Receive incremental updates from other users
// ---------------------------
socket.on("docUpdate", ({ docId, update }) => {
  if (docId === currentDocId && ydoc) {
    Y.applyUpdate(ydoc, new Uint8Array(update));
  }
});

// ---------------------------
// Watch local Vue model and update Yjs text
// ---------------------------
watch(
  () => localDoc.value.content,
  (newValue) => {
    if (ytext && newValue !== ytext.toString()) {
      ytext.delete(0, ytext.length);
      ytext.insert(0, newValue);
    }
  }
);

// ---------------------------
// Save button logic (manual save)
// ---------------------------
const submit = () => {
  const now = new Date().toISOString();
  const updatedDoc = { ...localDoc.value, updated_at: now };
  emit("save", updatedDoc);
};

// ---------------------------
// Clean up socket listeners on unmount
// ---------------------------
onUnmounted(() => {
  socket.off("docUpdate");
  socket.off("initDoc");
  socket.off("requestSave");
});
</script>



<template>
  <div class="doc-form">
    <h2>{{ localDoc._id ? "Edit Document" : "Add New Document" }}</h2>
    <form @submit.prevent="submit" class="new-doc">
      <div id="doc-header">
        <label for="title"><h3>Title</h3></label>
        <input
          id="title"
          v-model="localDoc.title"
          placeholder="Title"
          required
        />
        <button type="submit">
          {{ localDoc._id ? "Save" : "Create" }}
        </button>
      </div>

      <textarea
        id="content"
        v-model="localDoc.content"
        placeholder="Content"
        required
        class="document-body"
      ></textarea>
    </form>
  </div>
</template>

<style src="../style/docs.css" scoped></style>