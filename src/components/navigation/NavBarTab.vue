<template>
  <router-link
    :to="props.path"
    exact
  >
    {{ props.label }}
  </router-link>
</template>

<script setup>
const props = defineProps({
  path: String,
  label: String,
});
</script>
