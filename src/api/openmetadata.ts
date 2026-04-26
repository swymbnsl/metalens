import { MetadataCache } from '../cache/MetadataCache';
import { log } from '../utils/logger';
import type {
  OMTable,
  OMSearchResult,
  OMLineageResponse,
  OMDataQualityResult,
  OMAIApp,
} from './types';

export class OpenMetadataClient {
  constructor(
    private host: string,
    private token: string,
    private cache: MetadataCache,
  ) {}

  updateConfig(host: string, token: string): void {
    this.host = host;
    this.token = token;
    log(`OpenMetadata client config updated. host=${this.host}`);
  }

  private async fetchJSON<T>(path: string, skipCache = false): Promise<T> {
    const cacheKey = path;
    if (!skipCache) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached !== undefined) {
        log(`OpenMetadata cache hit for ${this.host}/api/v1${path}`);
        return cached;
      }
    }

    const url = `${this.host}api/v1${path}`;
    log(`OpenMetadata request start: GET ${url}`);
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    log(`OpenMetadata response received: ${res.status} ${res.statusText} for ${url}`);

    if (!res.ok) {
      throw new Error(`OpenMetadata API ${res.status} ${res.statusText}: ${url}`);
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(
        `Invalid response format from OpenMetadata API (expected JSON, got ${contentType || 'unknown'}). Endpoint: ${path}`,
      );
    }

    const data = (await res.json()) as T;
    log(`OpenMetadata JSON parsed successfully for ${url}`);
    if (!skipCache) {
      this.cache.set(cacheKey, data);
      log(`OpenMetadata response cached for ${url}`);
    }
    return data;
  }

  /** Test connection to OpenMetadata instance */
  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.host}/api/v1/system/config`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Full-text search across all data assets */
  async searchAssets(query: string, limit = 10): Promise<OMSearchResult> {
    const path = `/search/query?q=${query}&from=0&size=${limit}`;
    return this.fetchJSON<OMSearchResult>(path);
  }

  /** Get table metadata by fully qualified name */
  async getTableByFQN(fqn: string): Promise<OMTable> {
    const path = `/tables/name/${encodeURIComponent(fqn)}?fields=columns,tags,owners,followers,dataModel,domain,extension`;
    return this.fetchJSON<OMTable>(path);
  }

  /** Search for a table by simple name (tries schema.table and just table) */
  async findTable(tableName: string, schema?: string): Promise<OMTable | null> {
    try {
      const query = schema ? `${schema}.${tableName}` : tableName;
      const results = await this.searchAssets(query, 5);
      const hits = results?.hits?.hits ?? [];
      // Find exact name match first
      const exact = hits.find((h) => h._source.name.toLowerCase() === tableName.toLowerCase());
      const hit = exact ?? hits[0];
      if (!hit) return null;
      return this.getTableByFQN(hit._source.fullyQualifiedName);
    } catch {
      return null;
    }
  }

  /** Get lineage graph for a table */
  async getLineage(
    fqn: string,
    entityType = 'table',
    upstreamDepth = 3,
    downstreamDepth = 3,
  ): Promise<OMLineageResponse> {
    const path = `/lineage/${entityType}/name/${encodeURIComponent(fqn)}?upstreamDepth=${upstreamDepth}&downstreamDepth=${downstreamDepth}`;
    log(
      `Preparing lineage request for entityType=${entityType}, fqn=${fqn}, upstreamDepth=${upstreamDepth}, downstreamDepth=${downstreamDepth}`,
    );
    log(`Lineage request URL: ${this.host}/api/v1${path}`);
    log('Lineage requests bypass cache to ensure a fresh fetch on every click.');
    return this.fetchJSON<OMLineageResponse>(path, true);
  }

  /** Get data quality test cases for a table */
  async getDataQualityTests(tableId: string): Promise<OMDataQualityResult> {
    const path = `/dataQuality/testCases?entityLink=%3C%23E%3A%3Atable%3A%3A${tableId}%3E&limit=50`;
    return this.fetchJSON<OMDataQualityResult>(path, true);
  }

  /** Get available AI Studio agents */
  async getAIAgents(): Promise<OMAIApp[]> {
    try {
      const result = await this.fetchJSON<{ data: OMAIApp[] }>('/agents/dynamic?limit=50');
      return result?.data ?? [];
    } catch {
      return [];
    }
  }

  /** Update table or column description via JSON Patch */
  async updateDescription(entityType: string, id: string, description: string): Promise<unknown> {
    const res = await fetch(`${this.host}/api/v1/${entityType}/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json-patch+json',
      },
      body: JSON.stringify([{ op: 'add', path: '/description', value: description }]),
    });
    if (!res.ok) {
      throw new Error(`Failed to update description: ${res.status} ${res.statusText}`);
    }
    this.cache.delete(`/tables/name/${id}`);
    return res.json();
  }

  /** Add a glossary term to an asset */
  async addGlossaryTerm(entityType: string, id: string, glossaryTermFQN: string): Promise<unknown> {
    const res = await fetch(`${this.host}/api/v1/${entityType}/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json-patch+json',
      },
      body: JSON.stringify([
        {
          op: 'add',
          path: '/tags/-',
          value: {
            tagFQN: glossaryTermFQN,
            source: 'Glossary',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        },
      ]),
    });
    if (!res.ok) throw new Error(`Failed to add glossary term: ${res.status}`);
    return res.json();
  }

  /** Vote on a data asset */
  async vote(
    entityType: string,
    id: string,
    voteType: 'votedUp' | 'votedDown' | 'unVoted',
  ): Promise<unknown> {
    const res = await fetch(`${this.host}/api/v1/${entityType}/${id}/vote`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ updatedVoteType: voteType }),
    });
    if (!res.ok) throw new Error(`Failed to vote: ${res.status}`);
    return res.json();
  }
}
