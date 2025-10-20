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

// ---------------------------
// Save-on-join listener
// ---------------------------
socket.on("requestSave", async ({ docId }) => {
  if (docId !== currentDocId) return;
  const updatedDoc = { ...localDoc.value };
  try {
    await fetch(`/api/docs/${docId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedDoc),
    });
    console.log("Document saved for joining user.");
  } catch (err) {
    console.error("Failed to save document:", err);
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
      currentDocId = v._id;
      socket.emit("joinDoc", currentDocId);
    }
  },
  { immediate: true }
);

// ---------------------------
// Handle initDoc
// ---------------------------
socket.on("initDoc", ({ docId, update }) => {
  if (docId !== currentDocId) return;

  if (!ydoc) {
    ydoc = new Y.Doc();
    ytext = ydoc.getText("content");

    // Observe changes
    ytext.observe(() => {
      const newContent = ytext.toString();
      if (localDoc.value.content !== newContent) localDoc.value.content = newContent;
    });

    // Emit local changes
    ydoc.on("update", (update) => {
      socket.emit("docChange", { docId: currentDocId, update });
    });
  }

  // Merge the incoming update
  Y.applyUpdate(ydoc, new Uint8Array(update));
});

// ---------------------------
// Incremental updates
// ---------------------------
socket.on("docUpdate", ({ docId, update }) => {
  if (docId === currentDocId && ydoc) Y.applyUpdate(ydoc, new Uint8Array(update));
});

// ---------------------------
// Sync Vue <-> Yjs
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
// Manual save
// ---------------------------
const submit = () => {
  const updatedDoc = { ...localDoc.value, updated_at: new Date().toISOString() };
  emit("save", updatedDoc);
};

// ---------------------------
// Cleanup
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