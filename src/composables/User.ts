import { ref } from "vue";
const API_URL = import.meta.env.VITE_API_URL;


export function User() {

  const LogIn = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error("Failed to log in");
      const result = await response.json();
      return result;
    } catch (err: any) {
      console.error(err);
      return null;
    }
  };
  return {
    LogIn
  };
}

