// Redirect all console.log output to console.error to keep stdout clean for JSON-RPC
// This file should be preloaded using node -r

// Override console methods
const originalLog = console.log;
console.log = function (...args) {
    console.error(...args);
};
console.info = console.error;
console.warn = console.error;
console.debug = console.error;

// Monkey-patch process.stdout.write to filter out non-JSON content
// This is risky but necessary if a library writes directly to stdout
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk: any, encoding?: any, callback?: any) => {
    // If it looks like a JSON-RPC message (basic heuristic), let it pass
    // Otherwise redirect to stderr
    const str = chunk.toString();
    if (str.startsWith('{') || str.startsWith('Content-Length:')) {
        return originalStdoutWrite(chunk, encoding, callback);
    }
    return process.stderr.write(chunk, encoding, callback);
};
