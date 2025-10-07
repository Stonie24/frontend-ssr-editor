import { ref } from "vue";
const API_URL = import.meta.env.VITE_API_URL;

export function User() {
    const LogIn = async (email, password) => {
        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.message);

            localStorage.setItem("token", result.token);
            localStorage.setItem("user", JSON.stringify(result.user));
            console.log("Login successful:", result);
            console.log("Token stored:", result.token);
            console.log("User stored:", result.user);

            return result;
        } catch (err) {
            console.error("Login error:", err);
            return null;
        }
    };


    const SignUp = async (email, password) => {
        try {
            const response = await fetch(`${API_URL}/api/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            if (!response.ok) throw new Error("Failed to sign up");
            const result = await response.json();
            return result;
        } catch (err) {
            console.error(err);
            return null;
        }
    };

    return {
        LogIn,
        SignUp
    };
}

export function useAuth() {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return { token, user };
}

export function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
}
