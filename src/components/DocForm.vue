<script setup>
import { ref, watch, onMounted, onUnmounted } from "vue";
import { io } from "socket.io-client";
import * as Y from "yjs";
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
} from "y-protocols/awareness";

// ✅ 1. Props and emits
const props = defineProps(["doc"]);
const emit = defineEmits(["save"]);

// ✅ 2. Local reactive state
const localDoc = ref({ title: "", content: "" });
const contentRef = ref(null);
const cursorsContainer = ref(null);

// --- Yjs-related state ---
let ydoc = null;
let ytext = null;
let awareness = null;
let currentDocId = null;

// ✅ 3. Persistent user identity across docs
const username =
  localStorage.getItem("username") ||
  (() => {
    const name = "User-" + Math.floor(Math.random() * 1000);
    localStorage.setItem("username", name);
    return name;
  })();

const userColor =
  localStorage.getItem("userColor") ||
  (() => {
    const color = "#" + Math.floor(Math.random() * 16777215).toString(16);
    localStorage.setItem("userColor", color);
    return color;
  })();

// ✅ 4. Single socket instance (per session)
const socket = io(
  "https://jsramverk-wisesang-e6hme9cec4d2fybq.northeurope-01.azurewebsites.net/"
);

// --- Watch for document prop changes ---
watch(
  () => props.doc,
  (v) => {
    cleanupYjs(); // ✅ clean before switching doc
    localDoc.value = v ? { ...v } : { title: "", content: "" };

    if (v && v._id) {
      currentDocId = v._id;
      socket.emit("joinDoc", currentDocId);
    }
  },
  { immediate: true }
);

// --- Handle server init ---
socket.on("initDoc", ({ docId, update }) => {
  if (docId !== currentDocId) return;
  setupYjs(update);
});

// ✅ setup Yjs and awareness properly
function setupYjs(initialUpdate) {
  if (ydoc) return; // prevent double init
  ydoc = new Y.Doc();
  ytext = ydoc.getText("content");
  awareness = new Awareness(ydoc);

  awareness.setLocalStateField("user", {
    name: username,
    color: userColor,
  });

  // --- Awareness listeners ---
  socket.off("awarenessUpdate");
  socket.on("awarenessUpdate", ({ docId: incomingId, update }) => {
    if (incomingId === currentDocId) {
      applyAwarenessUpdate(awareness, new Uint8Array(update));
      renderCursors();
    }
  });

  awareness.on("update", ({ added, updated, removed }) => {
    const update = encodeAwarenessUpdate(
      awareness,
      added.concat(updated).concat(removed)
    );
    socket.emit("awarenessUpdate", { docId: currentDocId, update });
    renderCursors();
  });

  // --- Yjs doc update listeners ---
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

  // --- Sync textarea ---
  const textarea = contentRef.value;
  if (!textarea) return;

  // Observe Yjs text updates
  ytext.observe(() => {
    const newValue = ytext.toString();
    if (textarea.value !== newValue) {
      textarea.value = newValue;
    }
  });

  // Local input → Yjs
  const handleInput = (e) => {
    const newValue = e.target.value;
    const oldValue = ytext.toString();
    if (newValue === oldValue) return;
    ytext.delete(0, oldValue.length);
    ytext.insert(0, newValue);
  };
  textarea.addEventListener("input", handleInput);

  // Cursor tracking
  const updateCursor = () => {
    if (!awareness) return;
    awareness.setLocalStateField("cursor", {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    });
  };
  textarea.addEventListener("select", updateCursor);
  textarea.addEventListener("keyup", updateCursor);
  textarea.addEventListener("click", updateCursor);

  // ✅ Cleanup when switching/unmounting
  ydoc._cleanup = () => {
    textarea.removeEventListener("input", handleInput);
    textarea.removeEventListener("select", updateCursor);
    textarea.removeEventListener("keyup", updateCursor);
    textarea.removeEventListener("click", updateCursor);
  };
}

// --- Render cursors in overlay container ---
function renderCursors() {
  if (!awareness || !contentRef.value || !cursorsContainer.value) return;
  const textarea = contentRef.value;
  const container = cursorsContainer.value;

  container.innerHTML = ""; // clear old

  const text = textarea.value;
  const lineHeight = 20;
  const charWidth = 8;

  const others = Array.from(awareness.getStates().values()).filter(
    (s) => s.user && s.cursor
  );

  others.forEach((s) => {
    const { start } = s.cursor;
    const { name, color } = s.user;

    const before = text.slice(0, start);
    const lines = before.split("\n");
    const line = lines.length - 1;
    const column = lines[lines.length - 1].length;

    const cursor = document.createElement("div");
    cursor.className = "remote-cursor";
    cursor.textContent = `| ${name}`;
    cursor.style.position = "absolute";
    cursor.style.color = color;
    cursor.style.left = `${charWidth * column}px`;
    cursor.style.top = `${line * lineHeight}px`;
    cursor.style.fontSize = "14px";
    container.appendChild(cursor);
  });
}

// --- Save document ---
function submit() {
  const now = new Date().toISOString();
  const updatedDoc = { ...localDoc.value, updated_at: now };
  emit("save", updatedDoc);
}

// --- Cleanup on unmount or switch ---
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
  <div class="doc-form relative">
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

      <!-- ✅ container around textarea for cursor overlay -->
      <div class="relative">
        <textarea
          ref="contentRef"
          id="content"
          placeholder="Content"
          required
          class="document-body"
        ></textarea>
        <div ref="cursorsContainer" class="absolute top-0 left-0 pointer-events-none"></div>
      </div>
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
