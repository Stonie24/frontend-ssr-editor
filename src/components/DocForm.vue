<script setup>
import { ref, watch } from "vue";

const props = defineProps(['doc']);
const emit = defineEmits(['save']);

const localDoc = ref({ title: "", content: "" });

watch(
  () => props.doc,
  (v) => {
    localDoc.value = v ? { ...v } : { title: "", content: "" };
  },
  { immediate: true }
);

const submit = () => {
  const now = new Date().toISOString();
  emit("save", { ...localDoc.value, created_at: now });
};
</script>

<template>
  <div class="doc-form">
    <h2>{{ localDoc._id ? "Edit Document" : "Add New Document" }}</h2>
    <form @submit.prevent="submit" class="new-doc">
      <div id="doc-header">
        <label for="title"><h3>Title</h3></label>
        <input id="title" v-model="localDoc.title" placeholder="Title" required />
        <button type="submit">
          {{ localDoc._id ? "Save" : "Create" }}
        </button>
      </div>

      <textarea id="content" v-model="localDoc.content" placeholder="Content" required class="document-body"></textarea>
    </form>
  </div>
</template>
