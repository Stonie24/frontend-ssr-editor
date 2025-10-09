<template>
  <div class="nav-bar-tabs">
    <NavBarTab path="/docs" label="Docs" />
    <button v-if="isLoggedIn" class="nav-logout" @click="handleLogout">Logout</button>
  </div>
</template>
<style src="../../style/navbar.css" scoped></style>

<script setup>
import NavBarTab from "./NavBarTab.vue";
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../../composables/User.js'

const router = useRouter()
const { token, user, clearAuth } = useAuth()

const isLoggedIn = computed(() => !!token.value && !!user.value)

function handleLogout() {
  clearAuth()
  router.push('/')
}
</script>
