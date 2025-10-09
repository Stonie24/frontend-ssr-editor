import { ref } from "vue";
const API_URL = "http://localhost:1337";

export function User() {
  const { setAuth } = useAuth();

  const LogIn = async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setAuth(result.token, result.user);

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
  const token = ref(localStorage.getItem("token") || "");
  const user = ref(JSON.parse(localStorage.getItem("user") || "null"));

  function setAuth(newToken, newUser) {
    token.value = newToken;
    user.value = newUser;
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
  }

  function clearAuth() {
    token.value = "";
    user.value = null;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  return { token, user, setAuth, clearAuth };
}

export function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
}

