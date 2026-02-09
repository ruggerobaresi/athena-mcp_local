
import { LiteGraphClient } from './litegraph-client.js';

const config = {
    endpoint: process.env.LITEGRAPH_ENDPOINT || "http://localhost:8701",
    tenantGuid: process.env.LITEGRAPH_TENANT_GUID || "00000000-0000-0000-0000-000000000000",
    graphGuid: process.env.LITEGRAPH_GRAPH_GUID || "411e74de-0000-0000-0000-000000000000",
    accessKey: process.env.LITEGRAPH_ACCESS_KEY || "default-key"
};

async function test() {
    console.log("Testing connection to:", config.endpoint);
    const client = new LiteGraphClient(config);

    try {
        await client.connect();
        console.log("Connect successful");

        const id = "e4252a73-d75e-47d8-96bf-2b2a1984d7cd";
        console.log("Attempting to store node:", id);

        await client.storeNode({
            id: id,
            type: "Session",
            properties: { status: "debug-test" }
        });
        console.log("Store node successful");

    } catch (e) {
        console.error("DEBUG FAILED:", e);
    }
}

test();
