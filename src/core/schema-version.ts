/**
 * Schema versions for persisted engine structures.
 *
 * MumuSpec stores structured state (config, change state machine, contract
 * registry) that outlives any single release. Every persisted structure
 * carries a `schema_version` field so the engine can migrate old data on
 * load. Versioning starts at 1.0.0; data without the field is legacy.
 */

export const SCHEMA_KINDS = ['config', 'changeState', 'contractRegistry'] as const;
export type SchemaKind = (typeof SCHEMA_KINDS)[number];

/** Latest schema version for each persisted structure. */
export const CURRENT_SCHEMA_VERSION: Record<SchemaKind, string> = {
  config: '1.0.0',
  changeState: '1.0.0',
  contractRegistry: '1.0.0',
};

/** Data without a `schema_version` field is treated as this version. */
export const LEGACY_VERSION = '0.0.0';
