<script setup>
import { ref, watch, onUnmounted, nextTick } from "vue";
import { io } from "socket.io-client";
import * as Y from "yjs";
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
} from "y-protocols/awareness";
import {
  createRelativePositionFromTypeIndex,
  createAbsolutePositionFromRelativePosition,
} from "yjs";

// ✅ Props and emits
const props = defineProps(["doc"]);
const emit = defineEmits(["save"]);

// ✅ Local reactive state
const localDoc = ref({ title: "", content: "" });
const contentRef = ref(null);
const cursorsContainer = ref(null);

// --- Yjs-related state ---
let ydoc = null;
let ytext = null;
let awareness = null;
let currentDocId = null;
let isApplyingLocal = false;

// ✅ Persistent user identity
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

// ✅ Socket
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

  awareness.setLocalStateField("user", {
    name: username,
    color: userColor,
  });

  // Awareness listeners
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
      relStart: createRelativePositionFromTypeIndex(ytext, textarea.selectionStart),
      relEnd: createRelativePositionFromTypeIndex(ytext, textarea.selectionEnd),
    });
  };
  textarea.addEventListener("select", updateCursor);
  textarea.addEventListener("keyup", updateCursor);
  textarea.addEventListener("click", updateCursor);

  // --- Observe Yjs updates ---
  ytext.observe(() => {
    if (isApplyingLocal || !textarea) return;
    textarea.value = ytext.toString();

    const state = awareness.getLocalState();
    if (!state?.cursor) return;

    const absStart = createAbsolutePositionFromRelativePosition(state.cursor.relStart, ydoc);
    const absEnd = createAbsolutePositionFromRelativePosition(state.cursor.relEnd, ydoc);

    if (absStart && absEnd) {
      textarea.setSelectionRange(absStart.index, absEnd.index);
    }

    renderCursors();
  });

  // --- Cleanup ---
  ydoc._cleanup = () => {
    textarea.removeEventListener("input", handleInput);
    textarea.removeEventListener("select", updateCursor);
    textarea.removeEventListener("keyup", updateCursor);
    textarea.removeEventListener("click", updateCursor);
  };
}

// --- Render cursors overlay ---
function renderCursors() {
  if (!awareness || !contentRef.value || !cursorsContainer.value) return;
  const textarea = contentRef.value;
  const container = cursorsContainer.value;
  container.innerHTML = "";

  const others = Array.from(awareness.getStates().values()).filter(
    (s) => s.user && s.cursor
  );

  const text = textarea.value;

  others.forEach((s) => {
    const { relStart, user } = s.cursor ? s.cursor : {};
    if (!relStart || !user) return;

    const abs = createAbsolutePositionFromRelativePosition(relStart, ydoc);
    if (!abs) return;

    const before = text.slice(0, abs.index);
    const lines = before.split("\n");
    const line = lines.length - 1;
    const column = lines[lines.length - 1].length;

    const cursor = document.createElement("div");
    cursor.className = "remote-cursor";
    cursor.textContent = `| ${user.name}`;
    cursor.style.position = "absolute";
    cursor.style.color = user.color;
    cursor.style.left = `${8 * column}px`;
    cursor.style.top = `${20 * line}px`;
    cursor.style.fontSize = "14px";
    container.appendChild(cursor);
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
