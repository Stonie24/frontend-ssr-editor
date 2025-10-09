<script setup>
import { ref } from "vue";
import { User } from "../composables/User.js";

const { LogIn, SignUp } = User();
const email = ref("");
const password = ref("");
const isLoading = ref(false);
const error = ref("");

const handleSubmit = async (event) => {
	const action = event.submitter?.getAttribute("value");

	isLoading.value = true;
	error.value = "";

	try {
		if (action === "login") {
			const result = await LogIn(email.value, password.value);
			console.log("Login:", result);
		} else if (action === "signup") {
			const result = await SignUp(email.value, password.value);
			console.log("Signup:", result);
		}
	} catch (err) {
		error.value = "Something went wrong.";
	} finally {
		isLoading.value = false;
	}
};
</script>

<template>
	<form @submit.prevent="handleSubmit">
		<div v-if="error" class="error">{{ error }}</div>

		<input v-model="email" type="email" placeholder="Email" required />
		<input v-model="password" type="password" placeholder="Password" required />

		<button type="submit" name="action" value="login" :disabled="isLoading">
			{{ isLoading ? "Logging in..." : "Log in" }}
		</button>
		<button type="submit" name="action" value="signup" :disabled="isLoading">
			{{ isLoading ? "Creating account..." : "Sign up" }}
		</button>
	</form>
</template>
