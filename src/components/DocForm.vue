<script setup>
import { ref, watch, onUnmounted, nextTick, computed } from "vue";
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

// CodeMirror för kod-läge (endast efter att dokumentet skapats)
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";

import ShareButton from "./ShareButton.vue";
import { useDocuments } from "../composables/useDocuments.js";
const { executeCode } = useDocuments();

// --- Props/Emits ---
const props = defineProps(["doc"]);
const emit = defineEmits(["save"]);

// --- Lokal modell: börja med tomt plaintext ---
const localDoc = ref({ title: "", content: "", type: "text", _id: null });
const hasCollab = computed(() => !!localDoc.value._id); // bara efter Create

// --- Körning ---
const runOutput = ref(null);
const isRunning = ref(false);
async function runCode() {
  isRunning.value = true;
  runOutput.value = null;
  try {
    const result = await executeCode(localDoc.value.content);
    runOutput.value = result;
  } catch (err) {
    runOutput.value = `Execution error: ${err?.message || String(err)}`;
  } finally {
    isRunning.value = false;
  }
}

// --- Refs för editors ---
const contentRef = ref(null);   // textarea (text-läge efter create)
const codeHostRef = ref(null);  // CodeMirror mount (code-läge efter create)
let cmView = null;

// --- Kommentarer ---
const comments = ref([]);
const newCommentText = ref("");
const selectedRange = ref(null);

// --- Yjs/Socket state (endast efter create) ---
let ydoc = null;
let ytext = null;
let ycomments = null;
let awareness = null;
let currentDocId = null;
let isApplyingLocal = false;

const socket = io(
  "https://jsramverk-wisesang-e6hme9cec4d2fybq.northeurope-01.azurewebsites.net/"
);

// --- Hjälpare: diff till Y.Text ---
function applyDiffIntoYText(oldStr, newStr) {
  if (!ytext) return;
  if (oldStr === newStr) return;

  let start = 0;
  const oLen = oldStr.length;
  const nLen = newStr.length;
  while (start < oLen && start < nLen && oldStr[start] === newStr[start]) start++;

  let oEnd = oLen - 1;
  let nEnd = nLen - 1;
  while (oEnd >= start && nEnd >= start && oldStr[oEnd] === newStr[nEnd]) {
    oEnd--;
    nEnd--;
  }

  const deleteLen = Math.max(0, oEnd - start + 1);
  const insertText = newStr.slice(start, nEnd + 1);

  isApplyingLocal = true;
  ydoc.transact(() => {
    if (deleteLen > 0) ytext.delete(start, deleteLen);
    if (insertText.length > 0) ytext.insert(start, insertText);
  }, "local");
  isApplyingLocal = false;
}

// --- Awareness cursor ---
function setAwarenessCursor(start, end) {
  if (!awareness || !ytext) return;
  awareness.setLocalStateField("cursor", {
    start: createRelativePositionFromTypeIndex(ytext, start),
    end: createRelativePositionFromTypeIndex(ytext, end),
  });
  selectedRange.value = { start, end };
}

// --- Hantera props.doc ---
watch(
  () => props.doc,
  async (v) => {
    // 1) Rensa ev. tidigare Yjs
    cleanupYjs();
    destroyCodeMirror();

    // 2) Om parent ger doc -> använd den, annars börja från tomt
    localDoc.value = v ? { type: "text", _id: null, ...v } : { title: "", content: "", type: "text", _id: null };

    // 3) Om doc har _id -> gå in i collab-läge
    if (v && v._id) {
      currentDocId = v._id;
      socket.emit("joinDoc", currentDocId);
    } else {
      currentDocId = null; // stå i lokalt läge (ingen Yjs)
    }
  },
  { immediate: true }
);

// --- Yjs init från server ---
socket.off("initDoc");
socket.on("initDoc", ({ docId, update }) => {
  if (docId !== currentDocId) return;
  setupYjs(update);
});

// --- Setup Yjs för aktivt dokument ---
async function setupYjs(initialUpdate) {
  if (ydoc) return;

  ydoc = new Y.Doc();
  ytext = ydoc.getText("content");
  ycomments = ydoc.getArray("comments");
  awareness = new Awareness(ydoc);

  // Awareness sync
  socket.off("awarenessUpdate");
  socket.on("awarenessUpdate", ({ docId: incomingId, update }) => {
    if (incomingId === currentDocId) {
      applyAwarenessUpdate(awareness, new Uint8Array(update));
    }
  });

  awareness.on("update", ({ added, updated, removed }) => {
    const update = encodeAwarenessUpdate(awareness, added.concat(updated).concat(removed));
    socket.emit("awarenessUpdate", { docId: currentDocId, update });
  });

  // Yjs updates -> server
  ydoc.on("update", (update) => {
    socket.emit("docChange", { docId: currentDocId, update });
  });

  // Server -> Yjs apply
  socket.off("docUpdate");
  socket.on("docUpdate", ({ docId: incomingId, update }) => {
    if (incomingId === currentDocId) {
      Y.applyUpdate(ydoc, new Uint8Array(update));
    }
  });

  if (initialUpdate) {
    Y.applyUpdate(ydoc, new Uint8Array(initialUpdate));
  }

  // Sätt initialt innehåll (om Yjs tomt, använd lokalt)
  const initialLocal = localDoc.value?.content ?? "";
  if (ytext.length === 0 && initialLocal) {
    ytext.insert(0, initialLocal);
  }

  await nextTick();

  // Håll Vue-modell i sync med Yjs
  ytext.observe(() => {
    if (isApplyingLocal) return;
    const nextText = ytext.toString();
    if (localDoc.value.content !== nextText) localDoc.value.content = nextText;

    if (localDoc.value.type === "text" && contentRef.value) {
      const ta = contentRef.value;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      ta.value = nextText;
      const state = awareness.getLocalState();
      if (state?.cursor) {
        const absStart = createAbsolutePositionFromRelativePosition(state.cursor.start, ydoc);
        const absEnd = createAbsolutePositionFromRelativePosition(state.cursor.end, ydoc);
        if (absStart && absEnd) ta.setSelectionRange(absStart.index, absEnd.index);
      } else {
        ta.setSelectionRange(start, end);
      }
    } else if (localDoc.value.type === "code" && cmView) {
      const doc = cmView.state.doc.toString();
      if (doc !== nextText) {
        const sel = cmView.state.selection.main;
        cmView.dispatch({
          changes: { from: 0, to: cmView.state.doc.length, insert: nextText },
          selection: { anchor: sel.anchor, head: sel.head },
        });
      }
    }
  });

  // Kommentarer
  ycomments.observe(() => {
    comments.value = ycomments.toArray();
  });
  comments.value = ycomments.toArray();

  // Init editor för collab-läge
  if (localDoc.value.type === "text") {
    initTextareaBindings();
  } else {
    initCodeMirror();
  }
}

// --- Textarea-bindningar i collab-läge ---
function initTextareaBindings() {
  const ta = contentRef.value;
  if (!ta) return;
  ta.value = ytext.toString();

  const handleInput = (e) => {
    applyDiffIntoYText(ytext.toString(), e.target.value);
  };
  const updateCursor = () => {
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    setAwarenessCursor(start, end);
  };

  ta.addEventListener("input", handleInput);
  ta.addEventListener("select", updateCursor);
  ta.addEventListener("keyup", updateCursor);
  ta.addEventListener("click", updateCursor);
}

// --- CodeMirror i collab-läge ---
function initCodeMirror() {
  if (!codeHostRef.value) return;
  destroyCodeMirror();
  cmView = new EditorView({
    state: EditorState.create({
      doc: ytext.toString(),
      extensions: [
        basicSetup,
        javascript(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const text = update.state.doc.toString();
            applyDiffIntoYText(ytext.toString(), text);
            localDoc.value.content = text;
          }
          if (update.selectionSet) {
            const sel = update.state.selection.main;
            setAwarenessCursor(sel.from, sel.to);
          }
        }),
      ],
    }),
    parent: codeHostRef.value,
  });
}

function destroyCodeMirror() {
  if (cmView) {
    cmView.destroy();
    cmView = null;
  }
}

// --- Växla typ: initiera rätt editor efter create ---
watch(
  () => localDoc.value.type,
  async (type) => {
    await nextTick();
    if (!hasCollab.value) return; // före Create kör vi bara enkel v-model textarea

    if (type === "text") {
      destroyCodeMirror();
      initTextareaBindings();
    } else if (type === "code") {
      initCodeMirror();
    }
  }
);

// --- Kommentarer ---
function addComment() {
  if (!selectedRange.value || !newCommentText.value.trim() || !ycomments) return;
  const { start, end } = selectedRange.value;
  const newComment = {
    id: crypto.randomUUID(),
    author: "Anonymous",
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

function getLineNumber(comment) {
  if (!ydoc || !ytext || !comment.target) return "-";
  const absStart = Y.createAbsolutePositionFromRelativePosition(comment.target.start, ydoc);
  if (!absStart) return "-";
  const index = absStart.index;
  const text = ytext.toString();
  return text.slice(0, index).split("\n").length;
}

// --- Spara (Create/Save) ---
function submit() {
  const now = new Date().toISOString();
  const content = hasCollab.value && ytext ? ytext.toString() : localDoc.value.content;
  const updatedDoc = { ...localDoc.value, content, updated_at: now };
  emit("save", updatedDoc);
}

// --- Rensa ---
function cleanupYjs() {
  destroyCodeMirror();
  if (ydoc) ydoc.destroy();
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
  <div class="doc-editor">
    <h2>{{ localDoc._id ? "Edit Document" : "Create Document" }}</h2>

    <ShareButton
      v-if="localDoc._id"
      :docId="localDoc._id"
      label="Share this document"
    />

    <form @submit.prevent="submit" class="new-doc">
      <div id="doc-header">
        <label for="title"><h3>Title</h3></label>
        <input id="title" v-model="localDoc.title" placeholder="Title" required />
        <button type="submit">{{ localDoc._id ? "Save" : "Create" }}</button>

        <button
          type="button"
          v-if="localDoc.type === 'code'"
          @click="runCode"
          :disabled="isRunning"
          style="margin-left: 8px"
        >
          {{ isRunning ? 'Running...' : 'Run' }}
        </button>
      </div>

      <label>Document type</label>
      <!-- Tillåten att ändra innan Create -->
      <select v-model="localDoc.type" :disabled="!!localDoc._id">
        <option value="text">Plain Text</option>
        <option value="code">JavaScript Code</option>
      </select>

      <div class="editor-container">
        <!-- Före Create: enkel textarea (lokal v-model) -->
        <textarea
          v-if="!hasCollab"
          v-model="localDoc.content"
          class="document-body"
          placeholder="Content"
          required
        ></textarea>

        <!-- Efter Create + text-läge: Yjs-kopplad textarea -->
        <textarea
          v-else-if="localDoc.type === 'text'"
          ref="contentRef"
          class="document-body"
          placeholder="Content"
          required
        ></textarea>

        <!-- Efter Create + code-läge: CodeMirror mount -->
        <div v-else ref="codeHostRef" class="code-editor"></div>

        <!-- Kommentarer endast efter Create -->
        <div v-if="hasCollab" class="comments-panel">
          <h3>Comments</h3>
          <div
            v-for="comment in comments"
            :key="comment.id"
            class="comment-item"
          >
            <strong>{{ comment.author }}</strong><br />
            <small>Line: {{ getLineNumber(comment) }}</small>
            <p>{{ comment.content }}</p>
            <small>{{ new Date(comment.createdAt).toLocaleString() }}</small>
          </div>

          <div class="new-comment">
            <textarea
              id="comment-textarea"
              v-model="newCommentText"
              placeholder="Write a comment..."
              rows="2"
            ></textarea>
            <button class="s-button" type="button" @click="addComment">Add Comment</button>
          </div>
        </div>
      </div>
    </form>

    <div v-if="localDoc.type === 'code'" class="run-output">
      <h3>Output</h3>
      <div v-if="isRunning">Running...</div>
      <pre v-else>{{ runOutput }}</pre>
    </div>
  </div>
</template>

<style scoped src="../style/docs.css"></style>
<style scoped>
.code-editor {
  min-height: 300px;
  border: 1px solid #ddd;
  background-color: #1e1e1e;
  color: #fff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  padding: 10px;
}
.document-body {
  width: 100%;
  height: 300px;
  border: 1px solid #ddd;
  padding: 10px;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif;
}
.editor-container {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 16px;
  align-items: start;
}
.comments-panel {
  border-left: 1px solid #eee;
  padding-left: 12px;
}
.comment-item {
  border: 1px solid #eee;
  padding: 8px;
  border-radius: 6px;
  margin-bottom: 8px;
}
.run-output {
  margin-top: 16px;
}
</style>
