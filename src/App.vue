<template>
  <div id="app">
    <nav>
      <router-link to="/">Login</router-link>
      <router-link to="/docs">Docs</router-link>
    </nav>
    <router-view />
  </div>
</template>

<script>
export default {
  name: "App",
};
</script>

<style src="./style/style.css" scoped></style>
