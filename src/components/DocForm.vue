<script setup>
import { ref, watch, onUnmounted } from "vue";
import { io } from "socket.io-client";
import * as Y from "yjs";

const socket = io("https://jsramverk-wisesang-e6hme9cec4d2fybq.northeurope-01.azurewebsites.net/");

const props = defineProps(["doc"]);
const emit = defineEmits(["save"]);

const localDoc = ref({ title: "", content: "" });

let ydoc = null;
let ytext = null;
let currentDocId = null;

// --- Prevent infinite loops ---
let isLocalChange = false;
let isRemoteChange = false;

// ---------------------------
// Listen for server save request
// ---------------------------
socket.on("requestSave", async ({ docId }) => {
  if (docId === currentDocId && ytext) {
    const updatedDoc = { ...localDoc.value, content: ytext.toString() };
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
// Watch for prop doc changes
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
// Init from server
// ---------------------------
socket.on("initDoc", ({ docId, update }) => {
  if (docId !== currentDocId) return;

  console.log("Received initial document state for", docId);

  if (!ydoc) {
    ydoc = new Y.Doc();
    ytext = ydoc.getText("content");

    // Listen to Yjs changes → update Vue
    ytext.observe(() => {
      if (isLocalChange) return; // don't react to our own typing
      isRemoteChange = true;
      const newText = ytext.toString();
      if (localDoc.value.content !== newText) {
        localDoc.value.content = newText;
      }
      isRemoteChange = false;
    });

    // Listen to updates from Yjs → broadcast to others
    ydoc.on("update", (update) => {
      socket.emit("docChange", { docId: currentDocId, update: Array.from(update) });
    });
  }

  Y.applyUpdate(ydoc, new Uint8Array(update));
});

// ---------------------------
// Receive incremental updates
// ---------------------------
socket.on("docUpdate", ({ docId, update }) => {
  if (docId === currentDocId && ydoc) {
    Y.applyUpdate(ydoc, new Uint8Array(update));
  }
});

// ---------------------------
// Watch Vue → update Yjs
// ---------------------------
watch(
  () => localDoc.value.content,
  (newVal) => {
    if (isRemoteChange || !ytext) return;
    const current = ytext.toString();
    if (newVal !== current) {
      isLocalChange = true;
      ytext.delete(0, ytext.length);
      ytext.insert(0, newVal);
      isLocalChange = false;
    }
  }
);

// ---------------------------
// Save button logic
// ---------------------------
const submit = () => {
  const now = new Date().toISOString();
  const updatedDoc = { ...localDoc.value, updated_at: now };
  emit("save", updatedDoc);
};

// ---------------------------
// Cleanup
// ---------------------------
onUnmounted(() => {
  socket.off("docUpdate");
  socket.off("initDoc");
  socket.off("requestSave");
  if (ydoc) ydoc.destroy();
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