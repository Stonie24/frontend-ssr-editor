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
// Watch for doc prop changes
// ---------------------------
watch(
  () => props.doc,
  (v) => {
    if (ydoc) {
      ydoc.destroy();
      ydoc = null;
      ytext = null;
    }

    localDoc.value = v ? { ...v } : { title: "", content: "" };

    if (v && v._id) {
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

  console.log("Received initDoc for", docId);

  // Create Yjs document once
  if (!ydoc) {
    ydoc = new Y.Doc();
    ytext = ydoc.getText("content");

    // --- Send local changes to server ---
    ydoc.on("update", (update) => {
      socket.emit("docChange", { docId: currentDocId, update });
    });

    // --- Receive remote updates ---
    socket.on("docUpdate", ({ docId: incomingId, update }) => {
      if (incomingId === currentDocId) {
        Y.applyUpdate(ydoc, new Uint8Array(update));
      }
    });

    // --- Update the textarea on remote changes ---
    ytext.observe(() => {
      const newValue = ytext.toString();
      const textarea = document.getElementById("content");
      if (textarea && textarea.value !== newValue) {
        textarea.value = newValue;
      }
    });

    // --- Listen to local user input ---
    const textarea = document.getElementById("content");
    textarea.addEventListener("input", (e) => {
      const newValue = e.target.value;
      const oldValue = ytext.toString();

      // Minimal diff: find first and last differing index
      let start = 0;
      while (start < newValue.length && newValue[start] === oldValue[start]) start++;

      let oldEnd = oldValue.length - 1;
      let newEnd = newValue.length - 1;
      while (
        oldEnd >= start &&
        newEnd >= start &&
        oldValue[oldEnd] === newValue[newEnd]
      ) {
        oldEnd--;
        newEnd--;
      }

      // Replace only changed portion
      ytext.delete(start, oldEnd - start + 1);
      ytext.insert(start, newValue.slice(start, newEnd + 1));
    });
  }

  // Apply initial state from server after event listeners exist
  Y.applyUpdate(ydoc, new Uint8Array(update));
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

      <textarea id="content" placeholder="Content" required class="document-body"></textarea>

    </form>
  </div>
</template>

<style src="../style/docs.css" scoped></style>