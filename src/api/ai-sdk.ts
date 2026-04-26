import { getSettings } from '../config/settings';
import { GoogleGenAI, Type } from '@google/genai';
import type { OpenMetadataClient } from './openmetadata';

interface TableContext {
  name: string;
  fqn: string;
  description?: string;
  columns: Array<{
    name: string;
    dataType: string;
    description?: string;
  }>;
  tags?: string[];
  owner?: string;
}

export class AISdkClient {
  constructor(
    private host: string,
    private token: string,
    private omClient?: OpenMetadataClient
  ) {}

  updateConfig(host: string, token: string, omClient?: OpenMetadataClient): void {
    this.host = host;
    this.token = token;
    this.omClient = omClient;
  }

  private getGeminiContext() {
    const key = getSettings().geminiKey;
    if (!key) {
      throw new Error("Missing Google Gemini API Key. Please run 'MetaLens: Configure Connection' to provide your API key.");
    }
    return new GoogleGenAI({ apiKey: key });
  }

  /**
   * Extract table names from SQL query
   */
  private extractTableNames(sql: string): string[] {
    const tableRegex = /(?:FROM|JOIN)\s+([a-zA-Z_][\w.]*)/gi;
    const tables: string[] = [];
    let match;
    while ((match = tableRegex.exec(sql)) !== null) {
      tables.push(match[1]);
    }
    return [...new Set(tables)];
  }

  /**
   * Fetch metadata context for tables mentioned in the query
   */
  private async fetchTableContexts(tableNames: string[]): Promise<TableContext[]> {
    if (!this.omClient) {
      return [];
    }

    const contexts: TableContext[] = [];
    for (const tableName of tableNames) {
      try {
        // Try to find the table in OpenMetadata
        const table = await this.omClient.findTable(tableName);
        if (table) {
          contexts.push({
            name: table.name,
            fqn: table.fullyQualifiedName,
            description: table.description,
            columns: table.columns?.map(col => ({
              name: col.name,
              dataType: col.dataType,
              description: col.description
            })) || [],
            tags: table.tags?.map(t => t.tagFQN) || [],
            owner: table.owners?.[0]?.displayName || table.owners?.[0]?.name
          });
        }
      } catch (e) {
        // Table not found, skip
        console.log(`Table ${tableName} not found in catalog`);
      }
    }
    return contexts;
  }

  /**
   * Build system instruction with table context
   */
  private buildSystemInstruction(tableContexts: TableContext[]): string {
    let context = 'You are an intelligent data catalog assistant powered by OpenMetadata.';
    
    if (tableContexts.length > 0) {
      context += '\n\nYou have access to the following table metadata:\n\n';
      for (const table of tableContexts) {
        context += `Table: ${table.name} (${table.fqn})\n`;
        if (table.description) {
          context += `Description: ${table.description}\n`;
        }
        if (table.columns && table.columns.length > 0) {
          context += 'Columns:\n';
          for (const col of table.columns) {
            context += `  - ${col.name} (${col.dataType})${col.description ? `: ${col.description}` : ''}\n`;
          }
        }
        if (table.tags && table.tags.length > 0) {
          context += `Tags: ${table.tags.join(', ')}\n`;
        }
        context += '\n';
      }
    }

    context += '\nUse this metadata context to provide accurate and helpful responses about the data.';
    return context;
  }

  /**
   * Stream a response from Gemini with metadata context
   */
  async *streamResponse(
    _agentName: string,
    prompt: string,
  ): AsyncGenerator<string> {
    const ai = this.getGeminiContext();

    // Extract table names and fetch metadata context
    const tableNames = this.extractTableNames(prompt);
    const tableContexts = await this.fetchTableContexts(tableNames);
    
    const systemInstruction = this.buildSystemInstruction(tableContexts);

    // Create chat session
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: systemInstruction,
      }
    });

    // Send message and stream response
    const stream = await chat.sendMessageStream({ message: prompt });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  }

  /**
   * Non-streaming agent call (optional convenience)
   */
  async ask(agentName: string, prompt: string): Promise<string> {
    let result = '';
    for await (const chunk of this.streamResponse(agentName, prompt)) {
      result += chunk;
    }
    return result;
  }
}
