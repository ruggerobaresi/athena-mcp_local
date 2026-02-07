
import path from 'path';

// Exocortex Mount Points (The "Body" Parts)
// In a real usage, these would likely be loaded from env or user config.
// For now, we define the structure as per Architecture.

export const MOUNTS = {
    WORK: process.env.ATHENA_MOUNT_WORK || path.join(process.env.HOME || "", "Desktop", "Assignments"),
    WEALTH: process.env.ATHENA_MOUNT_WEALTH || path.join(process.env.HOME || "", "Desktop", "Wealth"),
    HEALTH: process.env.ATHENA_MOUNT_HEALTH || path.join(process.env.HOME || "", "Desktop", "Health")
};

export const PROTOCOLS = {
    TRIPLE_LOCK: "417", // Compliance Check
    PROMISE_GATE: "416" // Integrity Check
};
