import { OllamaEmbeddings } from "@langchain/ollama";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export class EmbeddingService {
    private embeddings: OllamaEmbeddings;
    private splitter: RecursiveCharacterTextSplitter;
    private model: string;

    constructor(model: string = 'mxbai-embed-large') {
        this.model = model;
        // Use host.docker.internal if running in Docker, otherwise localhost
        // For local development on Mac, host.docker.internal also resolves if in Docker Desktop context
        const baseUrl = process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434";

        this.embeddings = new OllamaEmbeddings({
            model: model,
            baseUrl: baseUrl,
        });

        this.splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
    }

    async getEmbedding(text: string): Promise<number[] | null> {
        if (!text || text.trim().length === 0) return null;
        try {
            return await this.embeddings.embedQuery(text);
        } catch (error) {
            console.warn(`Failed to generate embedding for model ${this.model}:`, error);
            return null;
        }
    }

    async embedDocuments(texts: string[]): Promise<number[][]> {
        return this.embeddings.embedDocuments(texts);
    }

    async splitText(text: string): Promise<string[]> {
        const docs = await this.splitter.createDocuments([text]);
        return docs.map(d => d.pageContent);
    }

    getModelName(): string {
        return this.model;
    }
}
