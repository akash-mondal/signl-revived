import 'dotenv/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Finding, Evidence, Hypothesis } from './types';

/**
 * KNOWLEDGE GRAPH INTELLIGENCE LAYER
 * Uses the 'memory' MCP server.
 * Note: All tools are prefixed with 'memory-' by E2B.
 */

export class KnowledgeGraphIntelligence {
  constructor(private memoryClient: Client) {}

  // =========================================================================
  // ENTITY MANAGEMENT
  // =========================================================================

  async recordFinding(finding: Finding, context: { competitor: string; focusArea: string }) {
    console.log(`    [KG] 📝 Recording finding: ${finding.signal}`);

    const entityName = this.sanitizeEntityName(finding.signal);
    
    // FIXED: Tool name prefix 'memory-'
    await this.memoryClient.callTool({
      name: 'memory-create_entities',
      arguments: {
        entities: [{
          name: entityName,
          entityType: `${finding.category}_FINDING`,
          observations: [
            `Category: ${finding.category}`,
            `Confidence: ${finding.confidence}`,
            `Impact: ${finding.impact}`,
            `Discovered: ${finding.timestamp}`,
            `Signal: ${finding.signal}`
          ]
        }]
      }
    });

    await this.memoryClient.callTool({
      name: 'memory-create_relations',
      arguments: {
        relations: [
          { from: entityName, to: context.competitor, relationType: 'discovered_about' },
          { from: entityName, to: context.focusArea, relationType: 'relates_to' }
        ]
      }
    });

    for (const evidence of finding.evidence) {
      await this.addEvidenceToEntity(entityName, evidence);
    }

    console.log(`    [KG] ✓ Entity created: ${entityName}`);
  }

  async checkExistingKnowledge(topic: string): Promise<{ exists: boolean; entity?: any; confidence?: string; }> {
    console.log(`    [KG] 🔍 Checking existing knowledge: "${topic}"`);

    try {
      const result = await this.memoryClient.callTool({
        name: 'memory-search_nodes',
        arguments: { query: topic }
      });

      // @ts-ignore
      const entities = result.content?.[0]?.text ? JSON.parse(result.content[0].text) : [];
      
      if (entities && entities.length > 0) {
        console.log(`    [KG] ✓ Found ${entities.length} related entities`);
        return { exists: true, entity: entities[0], confidence: this.extractConfidence(entities[0]) };
      }
      return { exists: false };
    } catch (e) {
      return { exists: false };
    }
  }

  async addEvidenceToEntity(entityName: string, evidence: Evidence) {
    try {
      await this.memoryClient.callTool({
        name: 'memory-add_observations',
        arguments: {
          observations: [{
            entityName,
            contents: [
              `Evidence from ${evidence.tool}: ${evidence.snippet}`,
              `Source credibility: ${evidence.credibility}%`,
              `Timestamp: ${evidence.timestamp}`,
              evidence.url ? `URL: ${evidence.url}` : ''
            ].filter(Boolean)
          }]
        }
      });
    } catch (e) {
      console.error(`    [KG] Failed to add evidence:`, e);
    }
  }

  // =========================================================================
  // HYPOTHESIS TRACKING
  // =========================================================================

  async createHypothesis(hypothesis: Hypothesis) {
    console.log(`    [KG] 💡 Creating hypothesis: ${hypothesis.claim}`);
    const entityName = this.sanitizeEntityName(`HYPOTHESIS_${hypothesis.claim}`);

    await this.memoryClient.callTool({
      name: 'memory-create_entities',
      arguments: {
        entities: [{
          name: entityName,
          entityType: 'STRATEGIC_HYPOTHESIS',
          observations: [
            `Claim: ${hypothesis.claim}`,
            `Implications: ${hypothesis.implications}`,
            `Status: ${hypothesis.validationStatus}`,
            `Created: ${new Date().toISOString()}`
          ]
        }]
      }
    });
    return entityName;
  }

  async getHypothesisEvidence(hypothesisEntity: string): Promise<{ supporting: any[]; refuting: any[]; strength: number; }> {
    try {
      const result = await this.memoryClient.callTool({
        name: 'memory-open_nodes',
        arguments: { names: [hypothesisEntity] }
      });
      // @ts-ignore
      const node = result.content?.[0]?.text ? JSON.parse(result.content[0].text) : null;
      if (!node) return { supporting: [], refuting: [], strength: 0 };

      const supporting = node.relations?.filter((r: any) => r.relationType === 'supports_hypothesis') || [];
      const refuting = node.relations?.filter((r: any) => r.relationType === 'refutes_hypothesis') || [];
      return { supporting, refuting, strength: supporting.length - refuting.length };
    } catch (e) {
      return { supporting: [], refuting: [], strength: 0 };
    }
  }

  // =========================================================================
  // STRATEGIC QUERIES
  // =========================================================================

  async queryStrategic(question: string): Promise<string> {
    console.log(`    [KG] ❓ Strategic query: "${question}"`);
    const entities = this.extractKeyEntitiesFromQuestion(question);
    
    if (entities.length === 0) {
      const result = await this.memoryClient.callTool({
        name: 'memory-search_nodes',
        arguments: { query: question }
      });
      // @ts-ignore
      return result.content?.[0]?.text || 'No relevant knowledge found';
    }

    const result = await this.memoryClient.callTool({
      name: 'memory-open_nodes',
      arguments: { names: entities }
    });
    // @ts-ignore
    return result.content?.[0]?.text || 'Entity not found';
  }

  async getFullContext(): Promise<any> {
    console.log(`    [KG] 📚 Reading full knowledge graph...`);
    try {
      const result = await this.memoryClient.callTool({
        name: 'memory-read_graph',
        arguments: {}
      });
      // @ts-ignore
      const graphData = result.content?.[0]?.text || '{}';
      return JSON.parse(graphData);
    } catch (e) {
      return {};
    }
  }

  // =========================================================================
  // PATTERN DETECTION
  // =========================================================================

  async detectPatterns(): Promise<{ pattern: string; entities: string[]; confidence: number; }[]> {
    const graph = await this.getFullContext();
    const patterns: any[] = [];
    const findingsByCategory: Record<string, any[]> = {};
    
    for (const entity of graph.entities || []) {
      if (entity.entityType.includes('FINDING')) {
        const category = entity.entityType.replace('_FINDING', '');
        if (!findingsByCategory[category]) findingsByCategory[category] = [];
        findingsByCategory[category].push(entity);
      }
    }

    for (const [category, findings] of Object.entries(findingsByCategory)) {
      if (findings.length >= 3) {
        patterns.push({
          pattern: `High activity in ${category} - ${findings.length} signals detected`,
          entities: findings.map(f => f.name),
          confidence: Math.min(90, findings.length * 20)
        });
      }
    }
    return patterns;
  }

  // =========================================================================
  // UTILITIES
  // =========================================================================

  private sanitizeEntityName(name: string): string {
    return name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 100);
  }

  private extractConfidence(entity: any): string {
    const obs = entity.observations || [];
    for (const observation of obs) {
      if (observation.includes('Confidence:')) return observation.split('Confidence:')[1].trim();
    }
    return 'UNKNOWN';
  }

  private extractKeyEntitiesFromQuestion(question: string): string[] {
    return question.toLowerCase().split(' ').filter(w => w.length > 5 && !['about', 'what', 'when', 'where', 'which'].includes(w)).slice(0, 3);
  }
}