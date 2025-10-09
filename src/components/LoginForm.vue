<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { User } from "../composables/User.js";

const router = useRouter();
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
				if (result && result.token) {
					
					router.push('/docs');
					return;
				} else {
					error.value = 'Login failed. Check credentials.';
				}
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
