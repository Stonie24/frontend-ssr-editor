<script setup>
import { ref, watch, onUnmounted } from "vue";
import { io } from "socket.io-client";
import * as Y from "yjs";

/*
  Configure server URL:
  - If you're using Vite, set VITE_SERVER_URL in .env (e.g. VITE_SERVER_URL=https://example.com)
  - Otherwise replace the expression below with your server URL string.
*/
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "https://jsramverk-wisesang-e6hme9cec4d2fybq.northeurope-01.azurewebsites.net/";

// single shared socket instance for this component
const socket = io(SERVER_URL, { autoConnect: true });

// props + emits
const props = defineProps(["doc"]);
const emit = defineEmits(["save"]);
const localDoc = ref({ title: "", content: "", type: "text", _id: null });
import ShareButton from "./ShareButton.vue";
import CodeEditor from "./CodeEditor.vue";

// Yjs
let ydoc = null;
let ytext = null;
let ydocUpdateHandler = null; // reference so we can remove it
let ytextObserver = null;

// track current docId
let currentDocId = null;

// Helper: clean up the current ydoc and listeners
function teardownYdoc() {
  try {
    if (ytext && ytextObserver) {
      ytext.unobserve(ytextObserver);
      ytextObserver = null;
    }
  } catch (e) {
    // some Yjs builds may not throw on unobserve; ignore errors
  }

  try {
    if (ydoc && ydocUpdateHandler) {
      // Yjs Doc exposes `off` to remove listeners registered with `on`
      if (typeof ydoc.off === "function") {
        ydoc.off("update", ydocUpdateHandler);
      }
      ydocUpdateHandler = null;
    }
  } catch (e) {
    // ignore if not supported
  }

  try {
    if (ydoc && typeof ydoc.destroy === "function") {
      ydoc.destroy();
    }
  } catch (e) {
    // ignore
  }

  ydoc = null;
  ytext = null;
}

// ---------------------------
// Server requestSave handler
// ---------------------------
// ensure we only have one listener registered on the socket for `requestSave`
socket.off("requestSave");
socket.on("requestSave", async ({ docId }) => {
  if (docId !== currentDocId) return;

  console.log("Server requested save before new user joins:", docId);

  const updatedDoc = {
    ...localDoc.value,
    content: ytext ? ytext.toString() : localDoc.value.content,
  };

  // Send save request to the server (use SERVER_URL to make sure we hit the right host)
  try {
    const res = await fetch(`${SERVER_URL.replace(/\/+$/, "")}/api/docs/${encodeURIComponent(docId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedDoc),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log("Document saved successfully (server requested).");
  } catch (err) {
    console.error("Failed to save document on server request:", err);
  }
});

// ---------------------------
// Watch prop.doc changes
// ---------------------------
watch(
  () => props.doc,
  (v) => {
    // copy the incoming doc into a local reactive object
    localDoc.value = v ? { ...v } : { title: "", content: "" };

    // If there is an _id, we should join collaborative editing for that doc
    if (v && v._id) {
      // If changing to a different doc, teardown previous ydoc and listeners
      if (currentDocId && currentDocId !== v._id) {
        teardownYdoc();
      }

      currentDocId = v._id;
      console.log("Joining collaborative document:", currentDocId);

      // emit joinDoc
      socket.emit("joinDoc", currentDocId);
    } else {
      // no doc selected -> teardown collaborative state
      currentDocId = null;
      teardownYdoc();
    }
  },
  { immediate: true }
);

// ---------------------------
// initDoc handler (server sends the current Y state)
// ---------------------------
// ensure only one listener for initDoc
socket.off("initDoc");
socket.on("initDoc", ({ docId, update }) => {
  if (docId !== currentDocId) return;
  console.log("Received initial Yjs document for", docId);

  console.log("Received initial document state for", docId);

  // If a ydoc already exists for the same doc, reuse it; otherwise create new
  if (!ydoc) {
    ydoc = new Y.Doc();
    ytext = ydoc.getText("content");

    // If localDoc already has content (from the API) and the ydoc is empty, initialize
    if (localDoc.value && localDoc.value.content && ytext.length === 0) {
      ytext.insert(0, localDoc.value.content);
    }

    // Observe Yjs content and sync to Vue localDoc
    ytextObserver = () => {
      const newContent = ytext.toString();
      if (localDoc.value.content !== newContent) {
        localDoc.value.content = newContent;
      }
    };
    ytext.observe(ytextObserver);

    // When ydoc emits updates locally, forward them to server
    ydocUpdateHandler = (upd) => {
      // `upd` is typically a Uint8Array or ArrayBuffer; socket.io supports binary
      // We send it as-is and let the server convert as needed.
      socket.emit("docChange", { docId: currentDocId, update: upd });
    };

    ydoc.on("update", ydocUpdateHandler);
  }

  // Apply the incoming update safely
  try {
    // update may be a typed array, array buffer, or a plain array of numbers.
    // Y.applyUpdate accepts Uint8Array or ArrayBuffer; attempt a conversion that works for multiple shapes:
    let u8;
    if (update instanceof Uint8Array) {
      u8 = update;
    } else if (update instanceof ArrayBuffer) {
      u8 = new Uint8Array(update);
    } else if (Array.isArray(update)) {
      u8 = new Uint8Array(update);
    } else {
      // fallback — try to create Uint8Array directly
      u8 = new Uint8Array(update);
    }
    Y.applyUpdate(ydoc, u8);
  } catch (err) {
    console.error("Failed to apply initDoc update:", err);
  }
});

// ---------------------------
// docUpdate handler (incremental updates from others)
// ---------------------------
socket.off("docUpdate");
socket.on("docUpdate", ({ docId, update }) => {
  if (docId !== currentDocId || !ydoc) return;

  try {
    let u8;
    if (update instanceof Uint8Array) {
      u8 = update;
    } else if (update instanceof ArrayBuffer) {
      u8 = new Uint8Array(update);
    } else if (Array.isArray(update)) {
      u8 = new Uint8Array(update);
    } else {
      u8 = new Uint8Array(update);
    }
    Y.applyUpdate(ydoc, u8);
  } catch (err) {
    console.error("Failed to apply docUpdate:", err);
  }
});

// ---------------------------
// Server requesting a save (before new user joins)
// ---------------------------
socket.on("requestSave", async ({ docId }) => {
  if (docId !== currentDocId) return;

  console.log("Server requested save before join:", docId);

  const updatedDoc = {
    ...localDoc.value,
    content: ytext ? ytext.toString() : localDoc.value.content,
  };

  try {
    await fetch(`/api/docs/${docId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedDoc),
    });
    console.log("Document saved successfully.");
  } catch (err) {
    console.error("Failed to save document:", err);
  }
});

// ---------------------------
// Sync Vue edits -> Yjs text
// ---------------------------
watch(
  () => localDoc.value.content,
  (newValue) => {
    if (!ytext) return;
    const current = ytext.toString();
    if (newValue === current) return;

    // Efficiently replace content: delete then insert
    try {
      // Only make Yjs changes if they differ
      ytext.delete(0, ytext.length);
      ytext.insert(0, newValue || "");
    } catch (err) {
      console.error("Failed to update Yjs text from local model:", err);
    }
  }
);

// ---------------------------
// Manual save handler (Save button)
 // emits 'save' event upward — your parent should handle saving via API
// ---------------------------
function submit() {
  const updatedDoc = {
    ...localDoc.value,
    updated_at: new Date().toISOString(),
  };
  emit("save", updatedDoc);
}

// ---------------------------
// Clean up when component unmounts
// ---------------------------
onUnmounted(() => {
  // remove our socket listeners we registered
  socket.off("requestSave");
  socket.off("initDoc");
  socket.off("docUpdate");

  // tear down ydoc
  teardownYdoc();

  // optionally disconnect the socket if this is the only component using it
  // socket.disconnect();
});
</script>

<template>
  <div class="doc-editor">
    <h2>{{ localDoc._id ? "Edit Document" : "Create Document" }}</h2>

    <!-- Show Share button only if editing existing doc -->
    <ShareButton v-if="localDoc._id" label="Share this document" />

    <form @submit.prevent="submit">
      <button type="submit">{{ localDoc._id ? "Save" : "Create" }}</button>

      <label>Title</label>
      <input v-model="localDoc.title" type="text" placeholder="Title" required />

      <label>Document type</label>
      <select v-model="localDoc.type" :disabled="!!localDoc._id">
        <option value="text">Plain Text</option>
        <option value="code">JavaScript Code</option>
      </select>

      <CodeEditor v-model="localDoc.content" :mode="localDoc.type" />
    </form>
  </div>
</template>

<style src="../style/docs.css" scoped></style>
