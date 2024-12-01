import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";

interface KnowledgeBase {
  name: string;
  description?: string;
  embedding_model: string;
  database_provider: string;
  createdAt?: string;
}

interface Document {
  id: string;
  content: string;
  model: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

interface SearchResult {
  id: string;
  content: string;
  model: string;
  metadata?: Record<string, unknown>;
  similarity: number;
}

class MakimaKB {
  private client: AxiosInstance;

  constructor(baseURL?: string) {
    this.client = axios.create({ baseURL: baseURL ?? process.env.MAKIMA_URL });
  }

  async getAllKnowledgeBases(): Promise<KnowledgeBase[]> {
    const response: AxiosResponse<KnowledgeBase[]> =
      await this.client.get("/knowledge/");
    return response.data;
  }

  async getKnowledgeBaseByName(name: string): Promise<KnowledgeBase> {
    const response: AxiosResponse<KnowledgeBase> = await this.client.get(
      `/knowledge/${name}`,
    );
    return response.data;
  }

  async createKnowledgeBase(
    kb: Omit<KnowledgeBase, "createdAt">,
  ): Promise<{ id: string }> {
    const response: AxiosResponse<{ id: string }> = await this.client.post(
      "/knowledge/create",
      kb,
    );
    return response.data;
  }

  async updateKnowledgeBase(
    name: string,
    updates: Partial<Omit<KnowledgeBase, "name" | "createdAt">>,
  ): Promise<KnowledgeBase> {
    const response: AxiosResponse<KnowledgeBase> = await this.client.put(
      `/knowledge/${name}`,
      updates,
    );
    return response.data;
  }

  async deleteKnowledgeBase(name: string): Promise<{ message: string }> {
    const response: AxiosResponse<{ message: string }> =
      await this.client.delete(`/knowledge/${name}`);
    return response.data;
  }

  async addDocumentToKnowledgeBase(
    name: string,
    document: Omit<Document, "id" | "createdAt" | "model"> & { model?: string },
  ): Promise<{ id: string }> {
    const response: AxiosResponse<{ id: string }> = await this.client.post(
      `/knowledge/${name}/add-document`,
      document,
    );
    return response.data;
  }

  async addDocumentsToKnowledgeBase(
    name: string,
    documents: Array<
      Omit<Document, "id" | "createdAt" | "model"> & { model?: string }
    >,
  ): Promise<{ id: string }[]> {
    const response: AxiosResponse<{ id: string }[]> = await this.client.post(
      `/knowledge/${name}/add-documents`,
      documents,
    );
    return response.data;
  }

  async updateDocumentInKnowledgeBase(
    name: string,
    document: Partial<Document> & { id: string },
  ): Promise<{ id: string }> {
    const response: AxiosResponse<{ id: string }> = await this.client.put(
      `/knowledge/${name}/update-document`,
      document,
    );
    return response.data;
  }

  async removeDocumentFromKnowledgeBase(
    name: string,
    documentId: string,
  ): Promise<{ message: string }> {
    const response: AxiosResponse<{ message: string }> =
      await this.client.delete(
        `/knowledge/${name}/remove-document/${documentId}`,
      );
    return response.data;
  }

  async getDocumentsFromKnowledgeBase(name: string): Promise<Document[]> {
    const response: AxiosResponse<Document[]> = await this.client.get(
      `/knowledge/${name}/documents`,
    );
    return response.data;
  }

  async searchKnowledgeBase(
    name: string,
    query: string,
    k: number,
    model?: string,
  ): Promise<SearchResult[]> {
    const config: AxiosRequestConfig = {
      params: {
        q: query,
        k: k.toString(),
        model,
      },
    };
    const response: AxiosResponse<SearchResult[]> = await this.client.get(
      `/knowledge/${name}/search`,
      config,
    );
    return response.data;
  }
}

export default MakimaKB;
export type { KnowledgeBase, Document, SearchResult };
