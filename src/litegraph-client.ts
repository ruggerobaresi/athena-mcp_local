
import * as LiteGraphModule from "litegraphdb";

// Workaround for LiteGraphSdk export issue
const LiteGraphSdk = (LiteGraphModule as any).LiteGraphSdk;

export interface LiteGraphConfig {
    endpoint: string;
    tenantGuid: string;
    graphGuid: string;
    accessKey: string;
}

import { EmbeddingService } from "./services/EmbeddingService.js";

export class LiteGraphClient {
    private client: any;
    private connected = false;
    private config: LiteGraphConfig;
    private embeddingService?: EmbeddingService;

    constructor(config: LiteGraphConfig, embeddingService?: EmbeddingService) {
        this.config = config;
        this.embeddingService = embeddingService;
        this.client = new LiteGraphSdk(config.endpoint, config.tenantGuid, config.accessKey);
        if (this.client.config) {
            (this.client.config as any).accessToken = config.accessKey;
        }
    }

    async connect() {
        if (this.connected) return;
        try {
            console.error(`Connecting to LiteGraph at ${this.config.endpoint}...`);
            let exists = false;
            try {
                exists = await this.client.Graph.exists(this.config.graphGuid);
            } catch (e) {
                // Ignore check failure
            }

            if (!exists) {
                // Simple attempt to create if missing, though typically it should exist
                try {
                    await this.client.Graph.create({
                        GUID: this.config.graphGuid,
                        Name: 'Athena Memory Graph',
                        Labels: ['memory', 'athena'],
                        Tags: {},
                        Vectors: [],
                        Data: { created_by: 'athena-mcp' }
                    });
                } catch (e) {
                    console.error("Warning: Could not create graph, it might already exist or permission denied.");
                }
            }
            this.connected = true;
            console.error("Connected to LiteGraph.");
        } catch (error) {
            console.error("Failed to connect to LiteGraph:", error);
            throw error;
        }
    }

    async getNode(id: string) {
        await this.connect();
        try {
            return await this.client.Node.read(this.config.graphGuid, id, { includeData: true });
        } catch (e) {
            return null;
        }
    }

    async searchNodes(query: string, limit: number = 20) {
        await this.connect();
        // Use search with a simple match if possible, or just default search
        // Since LiteGraph Search is complex, we'll start with a basic list or minimal filter
        const searchReq: any = {
            TenantGUID: this.config.tenantGuid,
            GraphGUID: this.config.graphGuid,
            Ordering: 'CreatedDescending',
            MaxResults: limit,
            Skip: 0,
            Expr: null
        };

        // Check for "Label=Value" pattern
        const labelMatch = query.match(/^Label=(.+)$/i);
        if (labelMatch) {
            searchReq.Labels = [labelMatch[1]];
        }

        // Check for "Name=Value" or "type=Value" pattern (alias for Name)
        const nameMatch = query.match(/^(Name|type)=(.+)$/i);
        if (nameMatch) {
            searchReq.Name = nameMatch[2];
        } else if (query && !labelMatch) {
            // For other properties, or if query is not Name=... or Label=...:
            // If query matches "Prop=Value", put it in Expr
            const match = query.match(/^(\w+)=(.+)$/);
            if (match) {
                searchReq.Expr = {
                    Left: match[1],
                    Operator: 'Equals',
                    Right: match[2]
                };
            }
        }

        // console.log('DEBUG: searchReq payload:', JSON.stringify(searchReq, null, 2));
        const results = await this.client.Node.search(searchReq);
        // console.log('DEBUG: search results:', JSON.stringify(results, null, 2));
        return (results.Nodes || results.Results || []).slice(0, limit);
    }

    async searchVectors(vector: number[], limit: number = 10) {
        await this.connect();
        try {
            // Using Native LiteGraph Vector Search
            // Typically: client.Node.search({ GraphGUID, Vectors: [vector], Mode: 'Vector' ... })
            // Or client.Vector.search(...)

            // Using VectorSearchRequest structure
            const searchReq = {
                GraphGUID: this.config.graphGuid,
                Domain: 'Node', // Searching for Nodes
                SearchType: 'CosineSimilarity',
                Embeddings: vector, // Array of numbers
                // You can add Labels, Tags filtering here if needed
            };

            // Use the Vector SDK 'search' method
            // Note: returns Promise<VectorSearchResult[]>
            const results = await this.client.Vector.search(searchReq);

            // Results contains Node/Edge/Graph objects. We want the Node.
            // Map results to just the Node objects (or return full result wrapper?)
            // athena_search expects { id, properties, labels, ... }
            // VectorSearchResult has { Node?: ..., Score?: ..., Distance?: ... }
            // Let's return the simplified nodes augmented with score/distance if possible, or just the nodes.
            // For checking results in verify script, returning the "Node" property is best.

            return (results || []).map((r: any) => {
                const node = r.Node;
                if (node) {
                    // Augment with score/distance if needed
                    node._score = r.Score;
                    node._distance = r.Distance;
                    // Map GUID to id for consistency
                    if (node.GUID && !node.id) {
                        node.id = node.GUID;
                    }
                    return node;
                }
                return null;
            }).filter((n: any) => n !== null).slice(0, limit);

        } catch (e: any) {
            console.error("Vector search failed:", e);
            if (e.response && e.response.body) {
                console.error("Error details:", JSON.stringify(e.response.body, null, 2));
            }
            return [];
        }
    }

    async storeNode(node: any) {
        await this.connect();

        // Generate embedding if possible
        let vector: number[] | null = null;
        let textToEmbed: string | null = null;

        if (this.embeddingService) {
            textToEmbed = node.properties?.content || node.properties?.description || node.properties?.summary;
            if (textToEmbed && typeof textToEmbed === 'string') {
                vector = await this.embeddingService.getEmbedding(textToEmbed);
            }
        }

        const litegraphNode = {
            GUID: node.id || crypto.randomUUID(),
            GraphGUID: this.config.graphGuid,
            Name: node.label || "Node",
            Data: {
                ...node.properties,
                _source: 'athena-mcp'
            },
            Labels: node.labels || [],
            Vectors: vector ? [{
                Vectors: vector,
                Model: this.embeddingService?.getModelName() || "unknown",
                Dimensionality: vector.length,
                Content: textToEmbed || ""
            }] : [],
            CreatedUtc: node.timestamp ? new Date(node.timestamp) : new Date()
        };

        let exists = false;
        try {
            exists = await this.client.Node.exists(this.config.graphGuid, litegraphNode.GUID);
        } catch (e) { }

        if (exists) {
            await this.client.Node.update(litegraphNode);
            return "Updated";
        } else {
            await this.client.Node.create(litegraphNode);
            return "Created";
        }
    }

    async storeRelationship(rel: any) {
        await this.connect();
        const litegraphEdge = {
            GUID: rel.id || rel.guid,
            GraphGUID: this.config.graphGuid,
            Name: rel.type,
            From: rel.from,
            To: rel.to,
            Cost: 1,
            Data: {
                ...(rel.properties || {}),
                timestamp: rel.timestamp || new Date().toISOString(),
                _source: 'athena-mcp'
            },
            CreatedUtc: rel.timestamp ? new Date(rel.timestamp) : new Date()
        };

        let exists = false;
        try {
            exists = await this.client.Edge.exists(this.config.graphGuid, litegraphEdge.GUID);
        } catch (e) { }

        if (exists) {
            await this.client.Edge.update(litegraphEdge);
            return "Updated";
        } else {
            await this.client.Edge.create(litegraphEdge);
            return "Created";
        }
    }
}
