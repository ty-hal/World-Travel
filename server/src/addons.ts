export const ADDON_IDS = {
  MCP: 'mcp',
  PACKING: 'packing',
  BUDGET: 'budget',
  DOCUMENTS: 'documents',
  VACAY: 'vacay',
  ATLAS: 'atlas',
  COLLAB: 'collab',
  AIRTRAIL: 'airtrail',
  LLM_PARSING: 'llm_parsing',
  COLLECTIONS: 'collections',
  JOURNEY: 'journey',
} as const;

export type AddonId = typeof ADDON_IDS[keyof typeof ADDON_IDS];
