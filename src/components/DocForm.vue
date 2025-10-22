<script setup>
import { ref, onUnmounted } from "vue";
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
// Server save request
// ---------------------------
socket.on("requestSave", async ({ docId }) => {
  if (docId === currentDocId && ytext) {
    try {
      await fetch(`/api/docs/${docId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...localDoc.value, content: ytext.toString() }),
      });
      console.log("Document saved successfully.");
    } catch (err) {
      console.error("Failed to save document:", err);
    }
  }
});

// ---------------------------
// Join document
// ---------------------------
if (props.doc && props.doc._id) {
  currentDocId = props.doc._id;
  localDoc.value = { ...props.doc };
  socket.emit("joinDoc", currentDocId);
}

// ---------------------------
// Init document from server
// ---------------------------
socket.on("initDoc", ({ docId, update }) => {
  if (docId !== currentDocId) return;

  if (!ydoc) {
    ydoc = new Y.Doc();
    ytext = ydoc.getText("content");

    // Sync Yjs → localDoc
    ytext.observe(() => {
      localDoc.value.content = ytext.toString();
    });

    // Broadcast updates
    ydoc.on("update", (update) => {
      socket.emit("docChange", { docId: currentDocId, update: Array.from(update) });
    });
  }

  Y.applyUpdate(ydoc, new Uint8Array(update));
});

// ---------------------------
// Receive updates from other users
// ---------------------------
socket.on("docUpdate", ({ docId, update }) => {
  if (docId === currentDocId && ydoc) {
    Y.applyUpdate(ydoc, new Uint8Array(update));
  }
});

// ---------------------------
// Handle textarea input
// ---------------------------
function onInput(e) {
  if (!ytext) return;
  const val = e.target.value;
  ytext.delete(0, ytext.length);
  ytext.insert(0, val);
}

// ---------------------------
// Manual save
// ---------------------------
function submit() {
  emit("save", { ...localDoc.value, updated_at: new Date().toISOString() });
}

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
        :value="ytext?.toString()"
        @input="onInput"
        placeholder="Content"
        required
        class="document-body"
      ></textarea>
    </form>
  </div>
</template>


<style src="../style/docs.css" scoped></style>