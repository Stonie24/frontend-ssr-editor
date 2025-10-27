<script setup>
import { ref, watch, onUnmounted, onMounted } from "vue";
import { io } from "socket.io-client";
import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness";
import * as YTextarea from "y-textarea";

const TextareaBinding = YTextarea.TextareaBinding || YTextarea;

// --- Socket setup ---
const socket = io("https://jsramverk-wisesang-e6hme9cec4d2fybq.northeurope-01.azurewebsites.net/");

// --- Props & emits ---
const props = defineProps(["doc"]);
const emit = defineEmits(["save"]);

const localDoc = ref({ title: "", content: "" });

// --- Yjs state ---
let ydoc = null;
let ytext = null;
let awareness = null;
let binding = null;
let currentDocId = null;

// --- React to document change from parent ---
watch(
  () => props.doc,
  (v) => {
    // Cleanup old doc
    if (ydoc) {
      ydoc.destroy();
      ydoc = null;
      ytext = null;
      awareness = null;
      binding = null;
    }

    localDoc.value = v ? { ...v } : { title: "", content: "" };

    if (v && v._id) {
      currentDocId = v._id;
      socket.emit("joinDoc", currentDocId);
    }
  },
  { immediate: true }
);

// --- Socket.io -> Yjs wiring ---
socket.on("initDoc", ({ docId, update }) => {
  if (docId !== currentDocId) return;

  // Create new Y.Doc instance
  ydoc = new Y.Doc();
  ytext = ydoc.getText("content");
  awareness = new Awareness(ydoc);

  // Identify local user
  const userColor = "#" + Math.floor(Math.random() * 16777215).toString(16);
  const username = "User-" + Math.floor(Math.random() * 1000);
  awareness.setLocalStateField("user", { name: username, color: userColor });

  // --- Awareness sync ---
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

  // --- Document updates ---
  // Send updates
  ydoc.on("update", (update) => {
    console.log("LOCAL Y UPDATE SENT");
    socket.emit("docChange", { docId: currentDocId, update });
  });

  // Receive updates
  socket.on("docUpdate", ({ docId: incomingId, update }) => {
    if (incomingId === currentDocId) {
      console.log("REMOTE Y UPDATE RECEIVED");
      Y.applyUpdate(ydoc, new Uint8Array(update));
    }
  });

  // Apply initial state BEFORE binding
  Y.applyUpdate(ydoc, new Uint8Array(update));

  // --- Bind Yjs to textarea ---
  onMounted(() => {
    const textarea = document.getElementById("content");
    binding = new TextareaBinding(ytext, textarea, awareness);
  });
});

// --- Manual save ---
const submit = () => {
  const now = new Date().toISOString();
  const updatedDoc = { ...localDoc.value, updated_at: now };
  emit("save", updatedDoc);
};

// --- Cleanup ---
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