<template>
  <div>
    <div v-if="mode === 'code'" ref="editor" class="code-editor"></div>
    <textarea
      v-else
      v-model="localValue"
      class="text-editor"
      placeholder="Write here..."
    ></textarea>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'

const props = defineProps({
  mode: { type: String, default: 'text' },
  modelValue: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])
const editor = ref(null)
const editorView = ref(null)
const localValue = ref(props.modelValue)


watch(localValue, (val) => {
  if (props.mode !== 'code') emit('update:modelValue', val)
})

watch(() => props.modelValue, (val) => {
  localValue.value = val
  if (editorView.value && editorView.value.state.doc.toString() !== val) {
    editorView.value.dispatch({
      changes: { from: 0, to: editorView.value.state.doc.length, insert: val },
    })
  }
})

function initEditor() {
  if (!editor.value) return
  editorView.value = new EditorView({
    state: EditorState.create({
      doc: localValue.value,
      extensions: [
        basicSetup,
        javascript(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const text = update.state.doc.toString()
            emit('update:modelValue', text)
            localValue.value = text
          }
        }),
      ],
    }),
    parent: editor.value,
  })
}

// Hantera mode-switch
watch(
  () => props.mode,
  async (mode) => {
    if (mode === 'code') {
      await nextTick()
      initEditor()
    } else if (editorView.value) {
      localValue.value = editorView.value.state.doc.toString()
      editorView.value.destroy()
      editorView.value = null
    }
  },
)

onMounted(() => {
  if (props.mode === 'code') initEditor()
})

onBeforeUnmount(() => {
  if (editorView.value) editorView.value.destroy()
})
</script>

<style scoped>
.code-editor {
  min-height: 300px;
  border: 1px solid #ddd;
  background-color: #1e1e1e;
  color: white;
  font-family: monospace;
  padding: 10px;
}
.text-editor {
  width: 100%;
  height: 300px;
  border: 1px solid #ddd;
  padding: 10px;
  font-family: Arial, sans-serif;
}
</style>
