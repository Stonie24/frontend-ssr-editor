<script setup>
import { ref } from "vue";
const props = defineProps({
  comments: Array,
  getLineNumber: Function,
});
const emit = defineEmits(["add"]);

const newCommentText = ref("");

function submit() {
  if (!newCommentText.value.trim()) return;
  emit("add", newCommentText.value.trim());
  newCommentText.value = "";
}
</script>

<template>
  <div class="comments-panel">
    <h3>Comments</h3>

    <div v-for="comment in comments" :key="comment.id" class="comment-item">
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
      <button class="s-button" type="button" @click="submit">
        Add Comment
      </button>
    </div>
  </div>
</template>

<style scoped>
.comments-panel {
  margin-top: 1rem;
}
.comment-item {
  margin-bottom: 0.75rem;
  border-bottom: 1px solid #ddd;
  padding-bottom: 0.5rem;
}
.new-comment textarea {
  width: 100%;
}
</style>
