import { ref } from "vue";
const API_URL = import.meta.env.VITE_API_URL;


export function useDocuments() {
  const documents = ref<any[]>([]);
  const doc = ref<any | null>(null);
  const error = ref<string | null>(null);

  // GET all documents
  const fetchDocuments = async () => {
    error.value = null;
    try {
      const response = await fetch(`${API_URL}/api/docs`);
      if (!response.ok) throw new Error("Failed to fetch documents");
      documents.value = await response.json();
    } catch (err: any) {
      error.value = err.message;
    }
  };

  // GET a single document by ID
  const fetchDocument = async (id: string) => {
    error.value = null;
    try {
      const response = await fetch(`${API_URL}/api/docs/${id}`);
      if (!response.ok) throw new Error("Document not found");
      doc.value = await response.json();
    } catch (err: any) {
      error.value = err.message;
    }
  };

  // POST a new document
  const addDocument = async (data: { title: string; content: string }) => {
    error.value = null;
    try {
      const response = await fetch(`${API_URL}/api/docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to add document");
      const result = await response.json();
      documents.value.push(result); // Optional: add to local state
      return result;
    } catch (err: any) {
      error.value = err.message;
      return null;
    }
  };

  // PUT update an existing document
  const updateDocument = async (id: string, data: { title?: string; content?: string }) => {
    error.value = null;
    try {
      const response = await fetch(`${API_URL}/api/docs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update document");
      const result = await response.json();

      // Optional: update local documents array
      const index = documents.value.findIndex(d => d.id === id);
      if (index !== -1) documents.value[index] = result;

      return result;
    } catch (err: any) {
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
