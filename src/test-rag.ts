import { FalkorDBService } from './services/FalkorDBService.js';
import { EmbeddingService } from './services/EmbeddingService.js';

async function main() {
    console.log('--- RAG Verification Start ---');

    console.log('1. Initializing Services...');
    // Use localhost since we are running outside container
    const falkordb = new FalkorDBService('redis://localhost:6379');

    // Default model mxbai-embed-large
    // Ensure Ollama is running on localhost or host.docker.internal
    // If running on host machine, localhost:11434 is likely correct for Ollama
    const embeddings = new EmbeddingService();

    console.log('2. Connecting to FalkorDB...');
    await falkordb.connect();

    const sampleText = "The quick brown fox jumps over the lazy dog. This is a test chunk for RAG verification.";
    const query = "fox jumping";

    console.log(`3. Splitting and Embedding text: "${sampleText}"`);
    const chunks = await embeddings.splitText(sampleText);
    console.log(`   Result chunks: ${chunks.length}`);

    for (const chunk of chunks) {
        console.log(`   Embedding chunk: "${chunk.substring(0, 20)}..."`);
        const vector = await embeddings.getEmbedding(chunk);
        if (vector) {
            console.log(`   Vector generated (dim: ${vector.length}). Storing...`);
            await falkordb.storeChunk(chunk, vector, { source: 'test-script', sessionId: 'test-session' });
        } else {
            console.error('   Failed to generate vector.');
        }
    }

    console.log(`4. Searching for: "${query}"`);
    const queryVector = await embeddings.getEmbedding(query);
    if (!queryVector) {
        console.error('Failed to embed query.');
        return;
    }

    const results = await falkordb.searchSimilar(queryVector, 3);
    console.log('5. Results:');
    console.log(JSON.stringify(results, null, 2));

    if (results.length > 0 && results[0].content.includes('fox')) {
        console.log('SUCCESS: Retrieved relevant content.');
    } else {
        console.error('FAILURE: Relevance check failed.');
    }
}

main().catch(console.error);
