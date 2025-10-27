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
    let isApplyingLocal = false;

    // Update textarea when Yjs changes
    ytext.observe(() => {
      // skip updates caused by our own local transaction application
      if (isApplyingLocal) return;
      const newText = ytext.toString();
      if (textarea.value !== newText) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = newText;
        textarea.setSelectionRange(start, end); // preserve cursor
      }
    });

    // Update Yjs when user types
    textarea.addEventListener("input", () => {
      const current = ytext.toString();
      const value = textarea.value;
      if (current === value) return;

      // Compute minimal edit (first/last diff) to avoid clobbering caret
      let start = 0;
      const curLen = current.length;
      const valLen = value.length;
      while (start < curLen && start < valLen && current[start] === value[start]) {
        start++;
      }

      // If everything after start is equal, simple replacement of suffix handles it
      let curSuffix = curLen - 1;
      let valSuffix = valLen - 1;
      while (curSuffix >= start && valSuffix >= start && current[curSuffix] === value[valSuffix]) {
        curSuffix--;
        valSuffix--;
      }

      const deleteLen = Math.max(0, curSuffix - start + 1);
      const insertText = value.slice(start, valLen - (valLen - 1 - valSuffix) - 0);

      // Preserve selection relative to the edit
      const selStart = textarea.selectionStart;
      const selEnd = textarea.selectionEnd;

      // Apply minimal edit as a local transaction to Yjs
      isApplyingLocal = true;
      ydoc.transact(() => {
        if (deleteLen > 0) ytext.delete(start, deleteLen);
        if (insertText.length > 0) ytext.insert(start, insertText);
      }, "local");
      isApplyingLocal = false;

      // Update selection to account for the edit delta
      const delta = insertText.length - deleteLen;
      const newSelStart = selStart > start ? Math.max(start, selStart + delta) : selStart;
      const newSelEnd = selEnd > start ? Math.max(start, selEnd + delta) : selEnd;
      textarea.setSelectionRange(newSelStart, newSelEnd);
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