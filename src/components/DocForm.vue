<script setup lang="ts">
import { ref, watch } from "vue";

type DocType = { _id?: string; title: string; content: string; created_at?: string };

const props = defineProps<{ doc: DocType | null }>();
const emit = defineEmits<{ (e: "save", doc: DocType): void }>();

const localDoc = ref<DocType>({ title: "", content: "" });

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
