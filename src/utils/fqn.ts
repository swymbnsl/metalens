/**
 * FQN (Fully Qualified Name) helpers for OpenMetadata.
 * Format: service.database.schema.table
 */

/** Split an FQN into its component parts */
export function parseFQN(fqn: string): {
  service?: string;
  database?: string;
  schema?: string;
  table: string;
} {
  const parts = fqn.split('.');
  switch (parts.length) {
    case 1:
      return { table: parts[0] };
    case 2:
      return { schema: parts[0], table: parts[1] };
    case 3:
      return { database: parts[0], schema: parts[1], table: parts[2] };
    default:
      return {
        service: parts[0],
        database: parts[1],
        schema: parts[2],
        table: parts.slice(3).join('.'),
      };
  }
}

/** Build a FQN from components */
export function buildFQN(
  table: string,
  schema?: string,
  database?: string,
  service?: string
): string {
  const parts = [service, database, schema, table].filter(Boolean);
  return parts.join('.');
}

/** Extract just the table name from an FQN */
export function tableNameFromFQN(fqn: string): string {
  return fqn.split('.').pop() ?? fqn;
}

/** Build the Collate web URL for an asset */
export function buildCollateUrl(host: string, fqn: string, entityType = 'table'): string {
  return `${host}/${entityType}/${encodeURIComponent(fqn)}`;
}
