import { ref } from "vue";
import { useAuth } from "./User.js";
const API_URL = "http://localhost:1337"/* "https://jsramverk-wisesang-e6hme9cec4d2fybq.northeurope-01.azurewebsites.net/" */;

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
      console.log("Token used in fetchDocuments:", token?.value);
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
      documents.value.push(result);
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
      const index = documents.value.findIndex(d => d._id === id || d.id === id);
          if (index !== -1) documents.value[index] = result;

      return result;
    } catch (err) {
      error.value = err.message;
      return null;
    }
  };

  const shareDocument = async (docId, toMail) => {
    try {
      const response = await fetch(`${API_URL}/api/sendMail`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token?.value || ''}`,
        },
        body: JSON.stringify({
          toMail,
          docId,
        }),
      });

      if (!response.ok) throw new Error("Failed to share document");
      return await response.json();
    } catch (err) {
      error.value = err.message;
      return null;
    }
  };

const executeCode = async (data) => {
  try {
    const encodedCode = btoa(data);
    var data = {
      code: encodedCode
    };
    const response = await fetch("https://execjs.emilfolino.se/code", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const result = await response.json();
    const decodedOutput = atob(result.data);
    return decodedOutput;
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
    shareDocument,
    executeCode
  };
}