# Research Protocol

**Owner**: Athena
**Type**: Analytical
**Version**: 1.0

## Objective
Systematically analyze a given topic, checking existing knowledge first, then gathering new information, and finally synthesizing a comprehensive answer.

## Steps

1.  **Memory Check** [Internal]
    - Query `athena_search` with relevant keywords and vectors.
    - Review `TAG_INDEX.md` for related topics.
    - *Goal*: Avoid redundant research.

2.  **Information Gathering** [External]
    - If internal memory is insufficient, performing search using available tools.
    - Focus on authoritative sources and documentation.

3.  **Synthesis** [Processing]
    - Combine internal and external context.
    - Structure the findings into key insights.
    - Identify any conflicts or gaps.

4.  **Archival** [Storage]
    - Create a summary of the findings.
    - Store as a new knowledge node using `athena_store_node`.
    - Link to the original session or request.

## Exit Criteria
- A clear, answered questions.
- A stored artifact of the research in memory.
