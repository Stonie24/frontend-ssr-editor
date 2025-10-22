<template>
  <div>
    <h2>{{ localDoc._id ? 'Edit Document' : 'Create Document' }}</h2>
    <ShareButton label="Share this document" v-if="localDoc._id" />
    <form @submit.prevent="submit">
      <button type="submit">{{ localDoc._id ? 'Save' : 'Create' }}</button>
      <label for="title">Title</label>
      <input type="text" v-model="localDoc.title" placeholder="Title" required />
      <label for="doc-type">Document type</label>
      <select v-model="localDoc.type" id="doc-type" :disabled="!!localDoc._id">
        <option value="text">Plain Text</option>
        <option value="code">JavaScript Code</option>
      </select>
      <CodeEditor v-model="localDoc.content" :mode="localDoc.type" />
    </form>
  </div>
</template>

<script setup>
import ShareButton from './ShareButton.vue';
import { ref, watch } from 'vue';
import CodeEditor from './CodeEditor.vue';

const props = defineProps({ doc: { type: Object, default: null } });
const emit = defineEmits(['save']);

const localDoc = ref({ title: '', content: '', type: 'text' });

watch(
  () => props.doc,
  (v) => {
    localDoc.value = v ? { ...v } : { title: '', content: '', type: 'text' };
  },
  { immediate: true }
);

const submit = () => {
  const now = new Date().toISOString();
  emit('save', { ...localDoc.value, created_at: now });
};
</script>
