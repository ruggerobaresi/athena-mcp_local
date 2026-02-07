
import * as LiteGraphModule from 'litegraphdb'
import dotenv from 'dotenv'
import { join } from 'path'

// Load environment from root (relative to athena_mcp/src/verify-count.ts -> ../../.env)
// Actually we can just hardcode or assume defaults since we know what they are,
// or load from .env in athena_mcp if it exists.
// Let's try loading from ../.env (in athena_mcp root) first
dotenv.config({ path: join(__dirname, '../.env') })

// SDK Hack
const LiteGraphSdk = (LiteGraphModule as any).LiteGraphSdk

const CONFIG = {
    endpoint: process.env.LITEGRAPH_ENDPOINT || 'http://localhost:8701',
    tenantGuid: process.env.LITEGRAPH_TENANT_GUID || '00000000-0000-0000-0000-000000000000',
    graphGuid: process.env.LITEGRAPH_GRAPH_GUID || '411e74de-0000-0000-0000-000000000000',
    accessKey: process.env.LITEGRAPH_ACCESS_KEY || 'default'
}

async function verifyCounts() {
    console.log('🔍 Verifying LiteGraph Node Count (Direct SDK Access)...')
    console.log('   Endpoint:', CONFIG.endpoint)
    console.log('   GraphGUID:', CONFIG.graphGuid)

    const client = new LiteGraphSdk(CONFIG.endpoint, CONFIG.tenantGuid, CONFIG.accessKey)
    if (CONFIG.accessKey) {
        // @ts-ignore
        client.config = { accessToken: CONFIG.accessKey }
    }

    const labelsToCheck = [
        'Agent', 'Annotation', 'ArchitectureDecision', 'Artifact', 'BestPractice', 'Branch', 'Bug', 'BugFix', 'Commit',
        'Component', 'Config', 'Conversation', 'DebuggingStep', 'Decision', 'DecisionRecord', 'DesignBlueprint',
        'DesignPattern', 'DesignSpec', 'DesignSystem', 'DevSession', 'DocResource', 'DocSection', 'DocumentationPattern',
        'Epic', 'Feature', 'File', 'FileModification', 'FunctionalRequirement', 'Gap', 'Implementation', 'ImplementationPhase',
        'Incident', 'Integration', 'Issue', 'JulesArtifact', 'JulesMemory', 'JulesTask', 'KnowledgeGraph', 'Lesson',
        'LessonLearned', 'Memory', 'MigrationPhase', 'MigrationState', 'Milestone', 'Module', 'NextStep', 'NextSteps',
        'Node', 'Page', 'Phase', 'Plan', 'PortingTask', 'PRD', 'Problem', 'Project', 'ProjectStats', 'ProjectStructure',
        'PullRequest', 'RalphyTest', 'Recommendation', 'Reminder', 'Repository', 'RepositoryStrategy', 'RepositorySync',
        'Session', 'Skill', 'Solution', 'Sprint', 'Task', 'TaskPrompt', 'TechnicalDebt', 'TechnicalSolution', 'Technology',
        'Template', 'TestResult', 'Topic', 'UserGuideSection', 'Version', 'Workflow', 'WorkflowTest'
    ]
    let totalCount = 0
    const counts: Record<string, number> = {}

    for (const label of labelsToCheck) {
        process.stdout.write(`   Searching for Label=${label}... `)
        try {
            // Construct search request mirroring athena_mcp logic
            const searchReq = {
                TenantGUID: CONFIG.tenantGuid,
                GraphGUID: CONFIG.graphGuid,
                Ordering: 'CreatedDescending',
                MaxResults: 1000,
                Labels: [label]
            }

            const results = await client.Node.search(searchReq)
            const nodes = results.Nodes || results.Results || []
            const count = nodes.length

            console.log(`Found: ${count}`)
            counts[label] = count
            totalCount += count
        } catch (err: any) {
            console.log(`Error: ${err.message}`)
        }
    }

    console.log('\n📊 Breakdown by Label:')
    console.table(counts)
    console.log(`\n✅ Total Nodes Found (Sum of properties): ${totalCount}`)

    if (totalCount < 600) {
        console.warn(`\n⚠️  WARNING: Count (${totalCount}) is significantly lower than expected Neo4j export count (~668). Check for missing data types.`)
    } else {
        console.log(`\n✅ Count matches expectations.`)
    }
}

verifyCounts()
