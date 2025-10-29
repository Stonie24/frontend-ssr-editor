<template>
  <div class="nav-bar-tabs">
    <h1> SSR Editor</h1>
    <div class="nav-user-email" v-if="isLoggedIn">
      <img src="/public/Profile.svg" alt="user icon">
      <p> {{ userEmail }}</p>
    </div>
   
    <button v-if="isLoggedIn" class="nav-logout" @click="handleLogout">Logout</button>
  </div>
</template>
<style src="../../style/navbar.css" scoped></style>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../../composables/User.js'

const router = useRouter()
const { token, user, clearAuth } = useAuth()
const userEmail = computed(() => user.value?.email ?? "");


const isLoggedIn = computed(() => !!token.value && !!user.value)

function handleLogout() {
  clearAuth()
  router.push('/')
}
</script>
