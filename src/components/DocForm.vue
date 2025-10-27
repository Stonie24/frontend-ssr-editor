<script setup>
import { ref, watch, onUnmounted } from "vue";
import { io } from "socket.io-client";
import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness";

const socket = io("https://jsramverk-wisesang-e6hme9cec4d2fybq.northeurope-01.azurewebsites.net/");

const props = defineProps(["doc"]);
const emit = defineEmits(["save"]);

const localDoc = ref({ title: "", content: "" });

let ydoc = null;
let ytext = null;
let awareness = null;
let currentDocId = null;

watch(
  () => props.doc,
  (v) => {
    if (ydoc) {
      ydoc.destroy();
      ydoc = null;
      ytext = null;
      awareness = null;
    }

    localDoc.value = v ? { ...v } : { title: "", content: "" };

    if (v && v._id) {
      currentDocId = v._id;
      socket.emit("joinDoc", currentDocId);
    }
  },
  { immediate: true }
);

socket.on("initDoc", ({ docId, update }) => {
  if (docId !== currentDocId) return;

  if (!ydoc) {
    ydoc = new Y.Doc();
    ytext = ydoc.getText("content");
    awareness = new Awareness(ydoc);

    // Local user info
    const userColor = "#" + Math.floor(Math.random() * 16777215).toString(16);
    const username = "User-" + Math.floor(Math.random() * 1000);
    awareness.setLocalStateField("user", { name: username, color: userColor });

    // Awareness updates
    socket.on("awarenessUpdate", ({ docId: incomingId, update }) => {
      if (incomingId === currentDocId) {
        applyAwarenessUpdate(awareness, new Uint8Array(update));
      }
    });

    awareness.on("update", ({ added, updated, removed }) => {
      const update = encodeAwarenessUpdate(
        awareness,
        added.concat(updated).concat(removed)
      );
      socket.emit("awarenessUpdate", { docId: currentDocId, update });
    });

    // Yjs document updates
    ydoc.on("update", (update) => {
      socket.emit("docChange", { docId: currentDocId, update });
    });

    socket.on("docUpdate", ({ docId: incomingId, update }) => {
      if (incomingId === currentDocId) {
        Y.applyUpdate(ydoc, new Uint8Array(update));
      }
    });

    // --- BIND TEXTAREA TO Yjs ---
    const textarea = document.getElementById("content");

    // Update textarea when Yjs changes
    ytext.observe(() => {
      if (textarea.value !== ytext.toString()) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = ytext.toString();
        textarea.setSelectionRange(start, end); // preserve cursor
      }
    });

    // Update Yjs when user types
    textarea.addEventListener("input", () => {
      const current = ytext.toString();
      const value = textarea.value;
      if (current !== value) {
        // Let Yjs handle merges automatically
        ytext.delete(0, current.length);
        ytext.insert(0, value);
      }
    });

    // Track cursor position in awareness
    const updateCursor = () => {
      awareness.setLocalStateField("cursor", {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      });
    };

    ["select", "keyup", "click"].forEach(evt => textarea.addEventListener(evt, updateCursor));
  }

  // Apply initial state
  Y.applyUpdate(ydoc, new Uint8Array(update));
});

// Save button
const submit = () => {
  const now = new Date().toISOString();
  const updatedDoc = { ...localDoc.value, updated_at: now };
  emit("save", updatedDoc);
};

onUnmounted(() => {
  socket.off("docUpdate");
  socket.off("initDoc");
  socket.off("awarenessUpdate");
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

      <textarea id="content" placeholder="Content" required class="document-body"></textarea>

    </form>
  </div>
</template>

<style src="../style/docs.css" scoped></style>