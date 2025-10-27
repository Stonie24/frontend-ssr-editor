<script setup>
import { ref, watch, onMounted, onUnmounted } from "vue";
import { io } from "socket.io-client";
import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness";

const socket = io("https://jsramverk-wisesang-e6hme9cec4d2fybq.northeurope-01.azurewebsites.net/");

const props = defineProps(["doc"]);
const emit = defineEmits(["save"]);

const localDoc = ref({ title: "", content: "" });
const textarea = ref(null); // Vue ref for textarea

// Yjs doc, text, and awareness
let ydoc = null;
let ytext = null;
let awareness = null;
let currentDocId = null;

// --- Watch document prop changes ---
watch(
  () => props.doc,
  (v) => {
    // Destroy previous Yjs doc
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

  if (!ydoc) {
    ydoc = new Y.Doc();
    ytext = ydoc.getText("content");
    awareness = new Awareness(ydoc);

    // Identify this client
    const userColor = "#" + Math.floor(Math.random() * 16777215).toString(16);
    const username = "User-" + Math.floor(Math.random() * 1000);

    awareness.setLocalStateField("user", { name: username, color: userColor });

    // Awareness updates from server
    socket.on("awarenessUpdate", ({ docId: incomingId, update }) => {
      if (incomingId === currentDocId && awareness) {
        applyAwarenessUpdate(awareness, new Uint8Array(update));
        renderCursors();
      }
    });

    // Forward awareness updates
    awareness.on("update", ({ added, updated, removed }) => {
      const update = encodeAwarenessUpdate(awareness, [...added, ...updated, ...removed]);
      socket.emit("awarenessUpdate", { docId: currentDocId, update });
      renderCursors();
    });

    // Sync document content
    ydoc.on("update", (update) => {
      if (ydoc) socket.emit("docChange", { docId: currentDocId, update });
    });

    socket.on("docUpdate", ({ docId: incomingId, update }) => {
      if (incomingId === currentDocId && ydoc) {
        Y.applyUpdate(ydoc, new Uint8Array(update));
      }
    });

    // Observe Yjs text and update textarea
    ytext.observe(() => {
      if (!textarea.value) return;
      const newValue = ytext.toString();
      if (textarea.value.value !== newValue) {
        textarea.value.value = newValue;
      }
    });

    // Listen to textarea input
    onMounted(() => {
      if (!textarea.value) return;
      textarea.value.addEventListener("input", (e) => {
        if (!ytext) return;
        const newValue = e.target.value;
        const oldValue = ytext.toString();

        // Minimal diff
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
        if (!awareness || !textarea.value) return;
        awareness.setLocalStateField("cursor", {
          start: textarea.value.selectionStart,
          end: textarea.value.selectionEnd,
        });
      };

      ["select", "keyup", "click"].forEach((evt) =>
        textarea.value.addEventListener(evt, updateCursor)
      );
    });
  }

  if (ydoc) Y.applyUpdate(ydoc, new Uint8Array(update));
});

// --- Render remote cursors ---
function renderCursors() {
  if (!awareness || !textarea.value) return;

  const others = Array.from(awareness.getStates().values()).filter(
    (s) => s.user && s.cursor
  );

  document.querySelectorAll(".remote-cursor").forEach((el) => el.remove());

  others.forEach((s) => {
    const { start } = s.cursor;
    const { name, color } = s.user;

    const text = textarea.value.value;
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
    textarea.value.parentElement.appendChild(cursorEl);
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
        placeholder="Content"
        required
        class="document-body"
        ref="textarea"
      ></textarea>
    </form>
  </div>
</template>

<style src="../style/docs.css" scoped></style>