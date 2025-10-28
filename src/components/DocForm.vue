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

// Props and emits
const props = defineProps(["doc"]);
const emit = defineEmits(["save"]);

// Document refs
const localDoc = ref({ title: "", content: "" });
const contentRef = ref(null);

// Comments refs
const comments = ref([]); // reactive list of comments
const newCommentText = ref("");
const selectedRange = ref(null);

// Yjs / socket state
let ydoc = null;
let ytext = null;
let ycomments = null;
let awareness = null;
let currentDocId = null;
let isApplyingLocal = false;

// Socket.io
const socket = io(
  "https://jsramverk-wisesang-e6hme9cec4d2fybq.northeurope-01.azurewebsites.net/"
);

// --- Watch document prop ---
watch(
  () => props.doc,
  (v) => {
    cleanupYjs();
    localDoc.value = v ? { ...v } : { title: "", content: "", type: "text" };
    if (v && v._id) {
      currentDocId = v._id;
      socket.emit("joinDoc", currentDocId);
    }
  },
  { immediate: true }
);

// --- Socket: init document ---
socket.on("initDoc", ({ docId, update }) => {
  if (docId !== currentDocId) return;
  setupYjs(update);
});

// --- Setup Yjs ---
async function setupYjs(initialUpdate) {
  if (ydoc) return;

  ydoc = new Y.Doc();
  ytext = ydoc.getText("content");
  ycomments = ydoc.getArray("comments"); // comments array shared via Yjs
  awareness = new Awareness(ydoc);

  // Sync awareness
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

  // Yjs document changes
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

  // --- Observe Yjs changes to update textarea ---
  ytext.observe(() => {
    if (isApplyingLocal || !textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = ytext.toString();

    const state = awareness.getLocalState();
    if (state?.cursor) {
      const absStart = createAbsolutePositionFromRelativePosition(
        state.cursor.start,
        ydoc
      );
      const absEnd = createAbsolutePositionFromRelativePosition(
        state.cursor.end,
        ydoc
      );
      if (absStart && absEnd) {
        textarea.setSelectionRange(absStart.index, absEnd.index);
      }
    }
  });

  // --- Observe Yjs comments ---
  ycomments.observe(() => {
    comments.value = ycomments.toArray();
  });
  comments.value = ycomments.toArray();

  // --- Local typing → Yjs sync ---
  const handleInput = (e) => {
    const value = e.target.value;
    const current = ytext.toString();
    if (value === current) return;

    let start = 0;
    const curLen = current.length;
    const valLen = value.length;
    while (start < curLen && start < valLen && current[start] === value[start])
      start++;

    let curSuffix = curLen - 1;
    let valSuffix = valLen - 1;
    while (
      curSuffix >= start &&
      valSuffix >= start &&
      current[curSuffix] === value[valSuffix]
    ) {
      curSuffix--;
      valSuffix--;
    }

    const deleteLen = Math.max(0, curSuffix - start + 1);
    const insertText = value.slice(start, valLen - (valLen - 1 - valSuffix));

    isApplyingLocal = true;
    ydoc.transact(() => {
      if (deleteLen > 0) ytext.delete(start, deleteLen);
      if (insertText.length > 0) ytext.insert(start, insertText);
    }, "local");
    isApplyingLocal = false;
  };
  textarea.addEventListener("input", handleInput);

  // --- Cursor tracking ---
  const updateCursor = () => {
    if (!awareness || !ytext || !textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    awareness.setLocalStateField("cursor", {
      start: createRelativePositionFromTypeIndex(ytext, start),
      end: createRelativePositionFromTypeIndex(ytext, end),
    });
    selectedRange.value = { start, end }; // track for comment creation
  };
  textarea.addEventListener("select", updateCursor);
  textarea.addEventListener("keyup", updateCursor);
  textarea.addEventListener("click", updateCursor);
}

// --- Add a new comment ---
function addComment() {
  if (!selectedRange.value || !newCommentText.value.trim()) return;
  const { start, end } = selectedRange.value;
  const newComment = {
    id: crypto.randomUUID(),
    author: "Anonymous", // replace with actual username if available
    content: newCommentText.value.trim(),
    createdAt: new Date().toISOString(),
    target: {
      start: Y.createRelativePositionFromTypeIndex(ytext, start),
      end: Y.createRelativePositionFromTypeIndex(ytext, end),
    },
  };
  ycomments.push([newComment]);
  newCommentText.value = "";
}

// --- Save document ---
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
  ycomments = null;
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
        <input id="title" v-model="localDoc.title" placeholder="Title" required />
        <button type="submit">{{ localDoc._id ? "Save" : "Create" }}</button>
      </div>

      <div class="editor-container">
        <textarea
          ref="contentRef"
          id="content"
          placeholder="Content"
          required
          class="document-body"
        ></textarea>

        <!-- Comments Sidebar -->
        <div class="comments-panel">
          <h3>Comments</h3>
          <div v-for="comment in comments" :key="comment.id" class="comment-item">
            <strong>{{ comment.author }}</strong>
            <p>{{ comment.content }}</p>
            <small>{{ new Date(comment.createdAt).toLocaleString() }}</small>
          </div>

          <div class="new-comment">
            <textarea
              v-model="newCommentText"
              placeholder="Write a comment..."
              rows="2"
            ></textarea>
            <button type="button" @click="addComment">Add Comment</button>
          </div>
        </div>
      </div>
    </form>
  </div>
</template>
<style scoped src="../style/style.css"></style>
