import { ref } from "vue";
import { useAuth } from "./User.js";
const API_URL = import.meta.env.VITE_API_URL;

export function useDocuments() {
  const documents = ref([]);
  const doc = ref(null);
  const error = ref(null);
  const { token } = useAuth();

  // GET all documents
  const fetchDocuments = async () => {
   try {
      const res = await fetch(`${API_URL}/api/docs`, {
        headers: { Authorization: `Bearer ${token?.value || ''}` },
      });
      console.log("Fetch documents response:", res);

      if (!res.ok) throw new Error("Unauthorized or failed to fetch docs");

      const data = await res.json();
      console.log("Fetched documents:", data);
      documents.value = data;
    } catch (err) {
      error.value = err.message;
      console.error("Fetch documents error:", err);
    }
  };


  // GET a single document by ID
  const fetchDocument = async (id) => {
    error.value = null;
    try {
      const response = await fetch(`${API_URL}/api/docs/${id}`);
      if (!response.ok) throw new Error("Document not found");
      doc.value = await response.json();
    } catch (err) {
      error.value = err.message;
    }
  };

  // POST a new document
  const addDocument = async (data) => {
    error.value = null;
    try {
      const response = await fetch(`${API_URL}/api/docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token?.value || ''}` },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to add document");
      const result = await response.json();
      documents.value.push(result); // Optional: add to local state
      return result;
    } catch (err) {
      error.value = err.message;
      return null;
    }
  };

  // PUT update an existing document
  const updateDocument = async (id, data) => {
    error.value = null;
    try {
      const response = await fetch(`${API_URL}/api/docs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token?.value || ''}` },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update document");
      const result = await response.json();

      // Optional: update local documents array
  const index = documents.value.findIndex(d => d._id === id || d.id === id);
      if (index !== -1) documents.value[index] = result;

      return result;
    } catch (err) {
      error.value = err.message;
      return null;
    }
  };

  return {
    documents,
    doc,
    error,
    fetchDocuments,
    fetchDocument,
    addDocument,
    updateDocument,
  };
}