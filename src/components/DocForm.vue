<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from "vue";
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
let isApplyingLocal = false;

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
async function setupYjs(initialUpdate) {
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
  // wait for DOM refs to be available (setupYjs may be called from socket events before mount)
  await nextTick();
  // ensure template ref is available (socket init may fire before component mount)
  if (!contentRef.value) {
    // wait up to ~500ms for the ref to appear
    for (let i = 0; i < 50 && !contentRef.value; i++) {
      // 10ms intervals
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 10));
    }
  }
  const textarea = contentRef.value;
  if (!textarea) {
    console.warn("DocForm: contentRef not available — cannot bind textarea");
    return;
  }

  // initialize textarea with current ytext
  textarea.value = ytext.toString();

  // Observe remote/other updates and apply them to the DOM (skip our own local edits)
  ytext.observe((event) => {
  if (isApplyingLocal) return;

  const textarea = contentRef.value;
  const oldSelStart = textarea.selectionStart;
  const oldSelEnd = textarea.selectionEnd;

  // compute new textarea value
  const newValue = ytext.toString();
  textarea.value = newValue;

  // transform selection
  let selStart = oldSelStart;
  let selEnd = oldSelEnd;

  // Adjust selection for each change in the event
  event.delta.forEach((op) => {
    if (op.retain !== undefined) {
      // nothing to do here
    } else if (op.insert) {
      if (op.retainPos !== undefined && op.retainPos <= selStart) selStart += op.insert.length;
      if (op.retainPos !== undefined && op.retainPos <= selEnd) selEnd += op.insert.length;
    } else if (op.delete) {
      if (op.retainPos !== undefined && op.retainPos < selStart) selStart -= Math.min(op.delete, selStart - op.retainPos);
      if (op.retainPos !== undefined && op.retainPos < selEnd) selEnd -= Math.min(op.delete, selEnd - op.retainPos);
    }
  });

  // Apply transformed selection
  textarea.setSelectionRange(selStart, selEnd);

  // re-render cursors visually
  renderCursors();
});

  // Local input → apply minimal diff to Yjs (avoids clobbering selection)
  const handleInput = (e) => {
    const value = e.target.value;
    const current = ytext.toString();
    if (value === current) return;

    // find first differing index
    let start = 0;
    const curLen = current.length;
    const valLen = value.length;
    while (start < curLen && start < valLen && current[start] === value[start]) {
      start++;
    }

    // find last matching suffix
    let curSuffix = curLen - 1;
    let valSuffix = valLen - 1;
    while (curSuffix >= start && valSuffix >= start && current[curSuffix] === value[valSuffix]) {
      curSuffix--;
      valSuffix--;
    }

    const deleteLen = Math.max(0, curSuffix - start + 1);
    const insertText = value.slice(start, valLen - (valLen - 1 - valSuffix) - 0);

    // apply as a local transaction so observers can ignore it
    isApplyingLocal = true;
    ydoc.transact(() => {
      if (deleteLen > 0) ytext.delete(start, deleteLen);
      if (insertText.length > 0) ytext.insert(start, insertText);
    }, "local");
    isApplyingLocal = false;
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
  // make sure we save current Yjs content (ytext) rather than stale localDoc.content
  const content = ytext ? ytext.toString() : localDoc.value.content;
  const updatedDoc = { ...localDoc.value, content, updated_at: now };
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
