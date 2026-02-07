
import { type Ollama } from 'ollama';
// Dynamic import to avoid issues if not available, but we installed it.
// Actually standard import is fine since we are in node.

export class EmbeddingService {
    private ollamaClient: any;
    private model: string;

    constructor(model: string = 'nomic-embed-text') {
        this.model = model;
    }

    async getEmbedding(text: string): Promise<number[] | null> {
        if (!text || text.trim().length === 0) return null;

        try {
            // Import dynamically to handle potential ESM/CJS issues gracefully
            const { default: ollama } = await import('ollama');
            const response = await ollama.embeddings({
                model: this.model,
                prompt: text,
            });
            return response.embedding;
        } catch (error) {
            console.warn(`Failed to generate embedding for model ${this.model}:`, error);
            // Fallback or rethrow? For now, return null so we don't block node storage.
            return null;
        }
    }

    getModelName(): string {
        return this.model;
    }
}
