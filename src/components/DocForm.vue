<script setup>
import { ref, watch, onMounted, onUnmounted } from "vue";
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

// Watch when the prop `doc` changes
watch(
  () => props.doc,
  (v) => {
    localDoc.value = v ? { ...v } : { title: "", content: "" };

    if (v && v._id) {
      console.log("Joining collaborative document:", v._id);

      currentDocId = v._id;
      socket.emit("joinDoc", currentDocId);

      // Create new Yjs doc
      ydoc = new Y.Doc();
      ytext = ydoc.getText("content");

      // When Yjs changes locally, emit an update to the backend
      ydoc.on("update", (update) => {
        socket.emit("docChange", { docId: currentDocId, update });
      });

      // When the Yjs shared text changes, update the local Vue model
      ytext.observe(() => {
        const newContent = ytext.toString();
        if (localDoc.value.content !== newContent) {
          localDoc.value.content = newContent;
        }
      });
    }
  },
  { immediate: true }
);

// Receive initial doc state from backend
socket.on("initDoc", ({ docId, update }) => {
  if (docId === currentDocId && ydoc) {
    console.log("Received initial document state for", docId);
    Y.applyUpdate(ydoc, new Uint8Array(update));
  }
});

// Receive incremental updates from other users
socket.on("docUpdate", ({ docId, update }) => {
  if (docId === currentDocId && ydoc) {
    Y.applyUpdate(ydoc, new Uint8Array(update));
  }
});

// Watch for local text edits
watch(
  () => localDoc.value.content,
  (newValue, oldValue) => {
    // Prevent feedback loop: only update Yjs if change originated locally
    if (ytext && newValue !== ytext.toString()) {
      // Replace full text (for simplicity)
      ytext.delete(0, ytext.length);
      ytext.insert(0, newValue);
    }
  }
);

// Save button logic
const submit = () => {
  const now = new Date().toISOString();
  const updatedDoc = { ...localDoc.value, created_at: now };
  emit("save", updatedDoc);
};

// Clean up when leaving component
onUnmounted(() => {
  socket.off("docUpdate");
  socket.off("initDoc");
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