<script setup>
import { ref, watch, onMounted, onUnmounted } from "vue";
import { io } from "socket.io-client";


const socket = io("https://jsramverk-wisesang-e6hme9cec4d2fybq.northeurope-01.azurewebsites.net/");

const props = defineProps(["doc"]);
const emit = defineEmits(["save"]);

const localDoc = ref({ title: "", content: "" });

watch(
  () => props.doc,
  (v) => {
    localDoc.value = v ? { ...v } : { title: "", content: "" };
    if (v && v._id) {
      console.log("Joining document room:", v._id);
      socket.emit("joinDoc", v._id);
    }
  },
  { immediate: true }
);


const submit = () => {
  const now = new Date().toISOString();
  const updatedDoc = { ...localDoc.value, created_at: now };
  emit("save", updatedDoc);

  if (localDoc.value._id) {
    socket.emit("docChange", {
      docId: localDoc.value._id,
      content: localDoc.value.content,
    });
  }
};

onMounted(() => {
  socket.on("docUpdate", ({ docId, content }) => {
    // only update if it's the same document
    if (localDoc.value._id === docId) {
      if (localDoc.value.content !== content) {
        console.log("Received update for current doc:", docId);
        localDoc.value.content = content;
      }
    } else {
      console.log("Ignored update for another doc:", docId);
    }
  });
});

onUnmounted(() => {
  socket.off("docUpdate");
});

let timeout;
watch(
  () => localDoc.value.content,
  (newValue) => {
    if (!localDoc.value._id) return;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      socket.emit("docChange", {
        docId: localDoc.value._id,
        content: newValue,
      });
    }, 300);
  }
);
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
        v-model="localDoc.content"
        placeholder="Content"
        required
        class="document-body"
      ></textarea>
    </form>
  </div>
</template>

<style src="../style/docs.css" scoped></style>