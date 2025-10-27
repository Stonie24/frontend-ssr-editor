<script setup>
import { ref, watch, onMounted, onUnmounted } from "vue";
import { io } from "socket.io-client";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness.js";

const socket = io("https://jsramverk-wisesang-e6hme9cec4d2fybq.northeurope-01.azurewebsites.net/");

const props = defineProps(["doc"]);
const emit = defineEmits(["save"]);

const localDoc = ref({ title: "", content: "" });

// Yjs doc, text, and awareness
let ydoc = null;
let ytext = null;
let awareness = null;
let currentDocId = null;

// --- Watch document prop changes ---
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

// --- Setup document sync ---
socket.on("initDoc", ({ docId, update }) => {
  if (docId !== currentDocId) return;

  console.log("Received initDoc for", docId);

  if (!ydoc) {
    ydoc = new Y.Doc();
    ytext = ydoc.getText("content");
    awareness = new Awareness(ydoc);

    // Identify this client
    const userColor = "#" + Math.floor(Math.random() * 16777215).toString(16);
    const username = "User-" + Math.floor(Math.random() * 1000);

    // Store local user state
    awareness.setLocalStateField("user", { name: username, color: userColor });

    // Listen for awareness updates from server
    socket.on("awarenessUpdate", ({ docId: incomingId, update }) => {
      if (incomingId === currentDocId) {
        awareness.applyUpdate(new Uint8Array(update));
      }
    });

    // Forward awareness updates to others
    awareness.on("update", ({ added, updated, removed }) => {
      const update = Awareness.encodeUpdate(
        awareness,
        added.concat(updated).concat(removed)
      );
      socket.emit("awarenessUpdate", { docId: currentDocId, update });
      renderCursors(); // update cursor display
    });

    // Sync document content
    ydoc.on("update", (update) => {
      socket.emit("docChange", { docId: currentDocId, update });
    });

    socket.on("docUpdate", ({ docId: incomingId, update }) => {
      if (incomingId === currentDocId) {
        Y.applyUpdate(ydoc, new Uint8Array(update));
      }
    });

    // Sync local <textarea> with shared Y.Text
    const textarea = document.getElementById("content");

    ytext.observe(() => {
      const newValue = ytext.toString();
      if (textarea && textarea.value !== newValue) {
        textarea.value = newValue;
      }
    });

    textarea.addEventListener("input", (e) => {
      const newValue = e.target.value;
      const oldValue = ytext.toString();

      // minimal diff update
      let start = 0;
      while (start < newValue.length && newValue[start] === oldValue[start]) start++;

      let oldEnd = oldValue.length - 1;
      let newEnd = newValue.length - 1;
      while (
        oldEnd >= start &&
        newEnd >= start &&
        oldValue[oldEnd] === newValue[newEnd]
      ) {
        oldEnd--;
        newEnd--;
      }

      ytext.delete(start, oldEnd - start + 1);
      ytext.insert(start, newValue.slice(start, newEnd + 1));
    });

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
  }

  Y.applyUpdate(ydoc, new Uint8Array(update));
});

// --- Render remote cursors ---
function renderCursors() {
  if (!awareness) return;

  const textarea = document.getElementById("content");
  if (!textarea) return;

  const others = Array.from(awareness.getStates().values()).filter(
    (s) => s.user && s.cursor
  );

  // Remove old cursors
  document.querySelectorAll(".remote-cursor").forEach((el) => el.remove());

  others.forEach((s) => {
    if (!s.cursor) return;
    const { start } = s.cursor;
    const { name, color } = s.user;

    const text = textarea.value;
    const before = text.slice(0, start);
    const lines = before.split("\n");
    const line = lines.length - 1;
    const column = lines[lines.length - 1].length;

    const cursorEl = document.createElement("div");
    cursorEl.className = "remote-cursor";
    cursorEl.textContent = `| ${name}`;
    cursorEl.style.position = "absolute";
    cursorEl.style.color = color;
    cursorEl.style.left = `${8 * column}px`;
    cursorEl.style.top = `${20 * line}px`;
    textarea.parentElement.appendChild(cursorEl);
  });
}

// --- Save button ---
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
        <input id="title" v-model="localDoc.title" placeholder="Title" required />
        <button type="submit">{{ localDoc._id ? "Save" : "Create" }}</button>
      </div>

      <div style="position: relative;">
        <textarea
          id="content"
          placeholder="Content"
          required
          class="document-body"
        ></textarea>
      </div>
    </form>
  </div>
</template>

<style scoped>
.remote-cursor {
  pointer-events: none;
  font-size: 12px;
  opacity: 0.8;
}
</style>