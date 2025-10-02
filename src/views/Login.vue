<script setup>
import { ref } from "vue";
import { User } from "../composables/User";

const { LogIn } = User();
const email = ref("");
const password = ref("");
const isLoading = ref(false);
const error = ref("");

const handleSubmit = async () => {
  if (!email.value || !password.value) {
    error.value = "Please enter both email and password";
    return;
  }

  isLoading.value = true;
  error.value = "";
  
  try {
    const result = await LogIn(email.value, password.value);
    if (result) {
      console.log("Login successful:", result);
    } else {
      error.value = "Login failed. Please check your credentials.";
    }
  } catch (err) {
    error.value = "An error occurred during login.";
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="login">
    <h1>Login</h1>
    <form @submit.prevent="handleSubmit">
      <div v-if="error" class="error">{{ error }}</div>
      <input 
        v-model="email" 
        type="email" 
        placeholder="Email" 
        required 
        :disabled="isLoading"
      />
      <input 
        v-model="password" 
        type="password" 
        placeholder="Password" 
        required 
        :disabled="isLoading"
      />
      <button type="submit" :disabled="isLoading">
        {{ isLoading ? "Logging in..." : "Logga in" }}
      </button>
    </form>
  </div>
</template>
