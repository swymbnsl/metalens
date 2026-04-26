// Shared TypeScript interfaces for OpenMetadata API responses

export interface OMTag {
  tagFQN: string;
  name: string;
  description?: string;
  source: string;
  labelType: string;
  state: string;
}

export interface OMColumn {
  name: string;
  displayName?: string;
  dataType: string;
  description?: string;
  tags?: OMTag[];
  constraint?: string;
  ordinalPosition?: number;
}

export interface OMOwner {
  name: string;
  displayName?: string;
  type: string;
  email?: string;
}

export interface OMTable {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  fullyQualifiedName: string;
  columns: OMColumn[];
  tags?: OMTag[];
  owners?: OMOwner[];
  domain?: { name: string };
  tier?: { tagFQN: string };
  updatedAt?: number;
  updatedBy?: string;
  tableType?: string;
  databaseSchema?: { name: string; fullyQualifiedName: string };
  database?: { name: string; fullyQualifiedName: string };
}

export interface OMSearchHit {
  _source: {
    id: string;
    name: string;
    displayName?: string;
    description?: string;
    fullyQualifiedName: string;
    entityType: string;
    owner?: OMOwner;
    tags?: OMTag[];
    tier?: { tagFQN: string };
  };
}

export interface OMSearchResult {
  hits: {
    hits: OMSearchHit[];
    total: { value: number };
  };
}

export interface OMLineageNode {
  id: string;
  type: string;
  fullyQualifiedName: string;
  name: string;
  description?: string;
}

export interface OMLineageEdge {
  fromEntity: { id: string; type: string };
  toEntity: { id: string; type: string };
}

export interface OMLineageResponse {
  entity: OMLineageNode;
  nodes?: OMLineageNode[];
  upstreamEdges?: OMLineageEdge[];
  downstreamEdges?: OMLineageEdge[];
}

export interface OMTestCase {
  id: string;
  name: string;
  description?: string;
  testDefinition: { name: string };
  testSuite: { name: string };
  entityLink: string;
  testCaseResult?: {
    testCaseStatus: 'Success' | 'Failed' | 'Aborted';
    timestamp: number;
    result?: string;
  };
}

export interface OMDataQualityResult {
  data: OMTestCase[];
  paging: { total: number };
}

export interface OMGlossaryTerm {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  fullyQualifiedName: string;
  glossary: { name: string };
  tags?: OMTag[];
}

export interface OMAIApp {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  appType: string;
}
