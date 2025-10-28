<script setup>
import { ref, watch, onUnmounted, nextTick } from "vue";
import { io } from "socket.io-client";
import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness";
import { createRelativePositionFromTypeIndex, createAbsolutePositionFromRelativePosition } from "yjs";

//  Props and emits
const props = defineProps(["doc"]);
const emit = defineEmits(["save"]);

// Remove cursor overlay refs and user identity
const localDoc = ref({ title: "", content: "" });
const contentRef = ref(null);

// Keep core Yjs state
let ydoc = null;
let ytext = null;
let awareness = null;
let currentDocId = null;
let isApplyingLocal = false;

// Socket
const socket = io(
  "https://jsramverk-wisesang-e6hme9cec4d2fybq.northeurope-01.azurewebsites.net/"
);

// --- Watch document changes ---
watch(
  () => props.doc,
  (v) => {
    cleanupYjs();
    localDoc.value = v ? { ...v } : { title: "", content: "" };
    if (v && v._id) {
      currentDocId = v._id;
      socket.emit("joinDoc", currentDocId);
    }
  },
  { immediate: true }
);

// --- Server init ---
socket.on("initDoc", ({ docId, update }) => {
  if (docId !== currentDocId) return;
  setupYjs(update);
});

// --- Setup Yjs ---
async function setupYjs(initialUpdate) {
  if (ydoc) return;

  ydoc = new Y.Doc();
  ytext = ydoc.getText("content");
  awareness = new Awareness(ydoc);

  // Keep only core cursor position syncing
  socket.off("awarenessUpdate");
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

  // Yjs doc update listeners
  ydoc.on("update", (update) => {
    socket.emit("docChange", { docId: currentDocId, update });
  });

  socket.off("docUpdate");
  socket.on("docUpdate", ({ docId: incomingId, update }) => {
    if (incomingId === currentDocId) {
      Y.applyUpdate(ydoc, new Uint8Array(update));
    }
  });

  if (initialUpdate) {
    Y.applyUpdate(ydoc, new Uint8Array(initialUpdate));
  }

  await nextTick();
  const textarea = contentRef.value;
  if (!textarea) return;

  textarea.value = ytext.toString();

  // --- Local input → Yjs ---
  const handleInput = (e) => {
    const value = e.target.value;
    const current = ytext.toString();
    if (value === current) return;

    let start = 0;
    const curLen = current.length;
    const valLen = value.length;
    while (start < curLen && start < valLen && current[start] === value[start]) start++;

    let curSuffix = curLen - 1;
    let valSuffix = valLen - 1;
    while (curSuffix >= start && valSuffix >= start && current[curSuffix] === value[valSuffix]) {
      curSuffix--;
      valSuffix--;
    }

    const deleteLen = Math.max(0, curSuffix - start + 1);
    const insertText = value.slice(start, valLen - (valLen - 1 - valSuffix) - 0);

    isApplyingLocal = true;
    ydoc.transact(() => {
      if (deleteLen > 0) ytext.delete(start, deleteLen);
      if (insertText.length > 0) ytext.insert(start, insertText);
    }, "local");
    isApplyingLocal = false;
  };
  textarea.addEventListener("input", handleInput);

  // --- Cursor tracking with relative positions ---
  const updateCursor = () => {
    if (!awareness || !ytext || !textarea) return;
    awareness.setLocalStateField("cursor", {
      start: createRelativePositionFromTypeIndex(ytext, textarea.selectionStart),
      end: createRelativePositionFromTypeIndex(ytext, textarea.selectionEnd),
    });
  };
  textarea.addEventListener("select", updateCursor);
  textarea.addEventListener("keyup", updateCursor);
  textarea.addEventListener("click", updateCursor);

  // Keep cursor position syncing in ytext observer
  ytext.observe(() => {
    if (isApplyingLocal || !textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = ytext.toString();
    
    const state = awareness.getLocalState();
    if (state?.cursor) {
      const absStart = createAbsolutePositionFromRelativePosition(state.cursor.start, ydoc);
      const absEnd = createAbsolutePositionFromRelativePosition(state.cursor.end, ydoc);
      if (absStart && absEnd) {
        textarea.setSelectionRange(absStart.index, absEnd.index);
      }
    }
  });
}


// --- Save ---
function submit() {
  const now = new Date().toISOString();
  const content = ytext ? ytext.toString() : localDoc.value.content;
  const updatedDoc = { ...localDoc.value, content, updated_at: now };
  emit("save", updatedDoc);
}

// --- Cleanup ---
function cleanupYjs() {
  if (ydoc) {
    ydoc._cleanup?.();
    ydoc.destroy();
  }
  ydoc = null;
  ytext = null;
  awareness = null;
}

onUnmounted(() => {
  cleanupYjs();
  socket.off("docUpdate");
  socket.off("initDoc");
  socket.off("awarenessUpdate");
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
        ref="contentRef"
        id="content"
        placeholder="Content"
        required
        class="document-body"
      ></textarea>
    </form>
  </div>
</template>

<style scoped>
.remote-cursor {
  position: absolute;
  font-size: 14px;
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
}
.document-body {
  position: relative;
  z-index: 1;
}
</style>
