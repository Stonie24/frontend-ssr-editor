<script setup>
import HelloWorld from './components/HelloWorld.vue'
</script>

<template>
  
  <nav style="display: flex; gap: 20px; align-items: center; justify-content: space-between;  border-bottom: 1px solid #eee; width: 90vw;">
    <HelloWorld msg="Ssr Editor" /> 
    <ul style="display: flex; gap: 20px; list-style: none;">
      <li><a href="/test">Test</a></li>
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
    </ul>
  </nav>
  <div>
    
  </div>
  
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
