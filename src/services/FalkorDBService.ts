import { FalkorDB, Graph } from 'falkordb';

export class FalkorDBService {
    private client: FalkorDB | null = null;
    private graph: Graph | null = null;
    private url: string;
    private graphName: string;

    constructor(url: string = 'redis://localhost:6379', graphName: string = 'athena_knowledge') {
        this.url = url;
        this.graphName = graphName;
    }

    async connect(): Promise<void> {
        if (this.client) return;
        try {
            this.client = await FalkorDB.connect({ url: this.url });
            this.graph = this.client.selectGraph(this.graphName);
            console.log(`Connected to FalkorDB at ${this.url}, graph: ${this.graphName}`);

            // Ensure vector index exists
            await this.createVectorIndex();
        } catch (error) {
            console.error('Failed to connect to FalkorDB:', error);
            throw error;
        }
    }

    private async createVectorIndex(): Promise<void> {
        if (!this.graph) throw new Error('Graph not initialized');

        // Create an index on the 'embedding' property of 'Chunk' nodes
        // Using M=40, ef_construction=200 for good recall/performance balance
        try {
            // Query to check if index exists or just try to create it (ignoring error if exists)
            // FalkorDB Cypher to create vector index:
            // CALL db.idx.vector.createNodeIndex('Chunk', 'embedding', { dim: 1024, similarityFunction: 'cosine' })
            // Note: Dimension depends on the model. mxbai-embed-large acts as 1024? No, it's usually 1024 or 768.
            // mxbai-embed-large is 1024 dimensions.

            await this.graph.query(`
                CREATE VECTOR INDEX FOR (c:Chunk) ON (c.embedding) 
                OPTIONS { dimension: 1024, similarityFunction: 'cosine' }
             `);
            console.log('Vector index created/verified for Chunk.embedding');
        } catch (error: any) {
            // Ignore complexity/existence errors preferably, but log for now
            if (!error.message?.includes('Index already exists')) {
                console.warn('Note on vector index creation:', error.message);
            }
        }
    }

    async storeChunk(content: string, embedding: number[], metadata: Record<string, any> = {}): Promise<void> {
        if (!this.graph) await this.connect();

        // Escape content for Cypher - basic escaping
        const escapedContent = JSON.stringify(content);

        // Create Chunk node
        const query = `
            CREATE (c:Chunk {
                content: ${escapedContent},
                embedding: vecf32($embedding),
                timestamp: timestamp(),
                source: $source,
                sessionId: $sessionId
            })
            RETURN c
        `;

        const params = {
            embedding: embedding,
            source: metadata.source || 'unknown',
            sessionId: metadata.sessionId || 'unknown'
        };

        if (this.graph) {
            await this.graph.query(query, { params });
        }
    }

    async searchSimilar(embedding: number[], k: number = 5): Promise<any[]> {
        if (!this.graph) await this.connect();

        // Vector search query
        // "CALL db.idx.vector.queryNodes('Chunk', 'embedding', $k, vecf32($embedding)) YIELD node, score RETURN node.content, score"

        const query = `
            CALL db.idx.vector.queryNodes('Chunk', 'embedding', $k, vecf32($embedding)) 
            YIELD node, score 
            RETURN node.content as content, node.source as source, score
        `;

        if (this.graph) {
            const result = await this.graph.query(query, { params: { k, embedding } });

            if (!result || !result.data) return [];

            return result.data.map((row: any) => ({
                content: row['content'],
                source: row['source'],
                score: row['score']
            }));
        }
        return [];
    }
}
