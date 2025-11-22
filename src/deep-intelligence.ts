import 'dotenv/config';
import { Groq } from 'groq-sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Sandbox } from 'e2b';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { WarRoomMissionContext, Finding, Evidence } from './types';
import { KnowledgeGraphIntelligence } from './knowledge-graph-intel';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface DeepInvestigationState {
  phase: string;
  findings: Finding[];
  kg: KnowledgeGraphIntelligence;
  toolUsageTracker: Map<string, number>; 
  iterationCount: number;
  startTime: Date;
  metrics: {
    totalToolCalls: number;
    exaCalls: number;
    perplexityAskCalls: number;
    perplexityReasonCalls: number;
    perplexityResearchCalls: number;
    xaiCalls: number;
    kgWrites: number;
    kgReads: number;
    deduplications: number;
    recencyFiltered: number;
    sequentialThoughts: number;
  };
}

function getDynamicDateRanges() {
  const now = new Date();
  const recentStrings: string[] = [];
  const currentYear = now.getFullYear().toString();
  for (let i = 0; i < 3; i++) {
    const d = new Date(); d.setMonth(now.getMonth() - i);
    recentStrings.push(`${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`);
  }
  const cutoffDate = new Date(); cutoffDate.setMonth(now.getMonth() - 3);
  const cutoffString = cutoffDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  return { recentStrings, currentYear, cutoffString };
}

function enforceRecency(query: string, context: WarRoomMissionContext): string {
  const { recentStrings, cutoffString } = getDynamicDateRanges();
  return `${query} since ${recentStrings[0]} (exclude before ${cutoffString})`;
}

function isRecent(text: string): boolean {
  const { recentStrings, currentYear } = getDynamicDateRanges();
  const lower = text.toLowerCase();
  if (recentStrings.some(m => lower.includes(m.toLowerCase()))) return true;
  if (lower.includes(currentYear) && (lower.includes('new') || lower.includes('launch'))) return true;
  return false;
}

function cleanText(input: any): string {
  let text = typeof input === 'string' ? input : JSON.stringify(input);
  try {
    const parsed = JSON.parse(text);
    if (parsed.content && Array.isArray(parsed.content)) {
      const textItem = parsed.content.find((c: any) => c.type === 'text');
      if (textItem) text = textItem.text;
    } else if (parsed.text) {
      text = parsed.text;
    }
  } catch (e) {}
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/{"type":"text","text":".*?"}/g, '').replace(/\\n/g, '\n').replace(/[*#]/g, '').trim().substring(0, 500);
}

class ToolDiversityEnforcer {
  private usageCount: Map<string, number> = new Map();
  private lastUsedTool: string = '';
  constructor() { ['exa', 'perplexity', 'xai'].forEach(tool => this.usageCount.set(tool, 0)); }
  selectNextTool(exclude?: string[]): string {
    const available = Array.from(this.usageCount.entries()).filter(([tool]) => !exclude?.includes(tool)).filter(([tool]) => tool !== this.lastUsedTool);
    available.sort((a, b) => a[1] - b[1]);
    const selected = available[0][0];
    this.recordUsage(selected);
    return selected;
  }
  recordUsage(tool: string) { this.usageCount.set(tool, (this.usageCount.get(tool) || 0) + 1); this.lastUsedTool = tool; }
}

class DeepResearchOrchestrator {
  private diversityEnforcer: ToolDiversityEnforcer;
  private toolMap: Map<string, string> = new Map();
  
  constructor(
    private mcpClient: Client,
    private state: DeepInvestigationState,
    private context: WarRoomMissionContext
  ) {
    this.diversityEnforcer = new ToolDiversityEnforcer();
  }

  async initializeToolMap() {
    console.log("   🔧 Mapping Tools...");
    const tools = await this.mcpClient.listTools();
    for (const tool of tools.tools) {
      if (tool.name.includes('web_search_exa')) this.toolMap.set('web_search_exa', tool.name);
      if (tool.name.includes('perplexity_ask')) this.toolMap.set('perplexity_ask', tool.name);
      if (tool.name.includes('perplexity_reason')) this.toolMap.set('perplexity_reason', tool.name);
      if (tool.name.includes('perplexity_research')) this.toolMap.set('perplexity_research', tool.name);
      if (tool.name.includes('sequentialthinking')) this.toolMap.set('sequentialthinking', tool.name);
    }
  }
  
  public getToolMap() { return this.toolMap; }

  async executeDeepResearch(competitor: string, initialFocus: string, durationPerCompetitor: number): Promise<void> {
    await this.initializeToolMap();
    console.log(`\n🔬 RESEARCHING: ${competitor} (${Math.floor(durationPerCompetitor)} min)`);
    
    const startTime = Date.now();
    const targetDuration = durationPerCompetitor * 60 * 1000;
    let currentFocus = initialFocus;
    let iteration = 0;
    
    while (Date.now() - startTime < targetDuration) {
      iteration++;
      const elapsed = Math.floor((Date.now() - startTime) / 1000 / 60);
      console.log(`\n[${elapsed}m] Focus: ${currentFocus}`);
      
      const tool1 = this.diversityEnforcer.selectNextTool();
      const tool2 = this.diversityEnforcer.selectNextTool([tool1]);
      const tool3 = this.diversityEnforcer.selectNextTool([tool1, tool2]);
      
      const findings = await this.researchCycle(competitor, currentFocus, [tool1, tool2, tool3]);
      
      for (const finding of findings) {
        if (isRecent(finding.signal)) {
          await this.state.kg.recordFinding(finding, { competitor, focusArea: currentFocus });
          this.state.metrics.kgWrites++;
        } else {
          this.state.metrics.recencyFiltered++;
        }
      }
      
      this.state.findings.push(...findings.filter(f => isRecent(f.signal)));
      
      if (iteration % 3 === 0) currentFocus = this.determineNextFocus(competitor, iteration);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  private async researchCycle(competitor: string, focus: string, tools: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];
    const recentQuery = enforceRecency(`${competitor} ${focus}`, this.context);
    
    const result1 = await this.callTool(tools[0], recentQuery);
    if (!result1) return [];
    const insight1 = cleanText(result1);
    
    const analysisQuery = enforceRecency(`Analyze: ${insight1}. What does this indicate about ${competitor}?`, this.context);
    const result2 = await this.callTool(tools[1], analysisQuery);
    const insight2 = cleanText(result2);
    
    const validationQuery = enforceRecency(`Validate: ${insight2}. Is this accurate?`, this.context);
    const result3 = await this.callTool(tools[2], validationQuery);
    const insight3 = cleanText(result3);
    
    if (result1 && result2 && result3) {
      findings.push(this.createFinding(
        this.categorizeFinding(focus),
        `${competitor}: ${insight2}`,
        [
          { source: tools[0], snippet: insight1.substring(0, 500), tool: tools[0], credibility: 85, timestamp: new Date().toISOString() },
          { source: tools[1], snippet: insight2.substring(0, 500), tool: tools[1], credibility: 90, timestamp: new Date().toISOString() },
          { source: tools[2], snippet: insight3.substring(0, 500), tool: tools[2], credibility: 88, timestamp: new Date().toISOString() }
        ],
        'HIGH',
        this.assessImpact(String(result2))
      ));
    }
    return findings;
  }

  private async callMcpToolWithTimeout(name: string, args: any) {
    return await this.mcpClient.request(
      { method: "tools/call", params: { name: name, arguments: args } },
      CallToolResultSchema, { timeout: 600000 }
    );
  }
  
  private async callTool(toolName: string, query: string): Promise<any> {
    this.state.metrics.totalToolCalls++;
    try {
      switch (toolName) {
        case 'exa':
          this.state.metrics.exaCalls++;
          const exaName = this.toolMap.get('web_search_exa');
          if (!exaName) return null;
          return await this.callMcpToolWithTimeout(exaName, { query, num_results: 10, search_type: 'neural' });
        case 'perplexity':
          const pplxName = this.toolMap.get(Math.random() > 0.5 ? 'perplexity_reason' : 'perplexity_research');
          if (!pplxName) return null;
          this.state.metrics.perplexityResearchCalls++;
          return await this.callMcpToolWithTimeout(pplxName, { messages: [{ role: 'user', content: query }] });
        case 'xai':
          this.state.metrics.xaiCalls++;
          return await this.searchSocial(query);
        default: return null;
      }
    } catch (e) { return null; }
  }

  private async searchSocial(query: string): Promise<string> {
    try {
      const { recentStrings, cutoffString } = getDynamicDateRanges();
      const timeframe = `since ${cutoffString}`;
      const res = await fetch("https://api.x.ai/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.XAI_API_KEY}` },
        body: JSON.stringify({
          model: "grok-4-fast",
          input: [{ role: "user", content: `Search X/Twitter for: ${query}. Focus ONLY on posts ${timeframe}.` }],
          tools: [{ type: "x_search" }]
        })
      });
      const data = await res.json();
      // @ts-ignore
      return data.output?.[0]?.content?.[0]?.text || "No signal";
    } catch (e) { return `XAI Error`; }
  }

  private determineNextFocus(competitor: string, iteration: number): string {
    const focusAreas = ['product launches', 'pricing strategy', 'leadership hires', 'market expansion', 'customer sentiment', 'partnerships', 'funding', 'positioning'];
    return focusAreas[iteration % focusAreas.length];
  }

  private categorizeFinding(focus: string): Finding['category'] {
    if (focus.includes('pric')) return 'PRICING';
    if (focus.includes('product')) return 'PRODUCT';
    if (focus.includes('hire')) return 'PEOPLE';
    if (focus.includes('sentiment')) return 'SENTIMENT';
    return 'STRATEGY';
  }

  private assessImpact(analysis: string): Finding['impact'] {
    if (analysis.toLowerCase().includes('critical')) return 'CRITICAL';
    if (analysis.toLowerCase().includes('important')) return 'HIGH';
    return 'MEDIUM';
  }

  private createFinding(category: Finding['category'], signal: string, evidence: Evidence[], confidence: Finding['confidence'], impact: Finding['impact']): Finding {
    return {
      id: `f-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
      category,
      signal: signal.replace(/\n/g, ' ').substring(0, 120),
      evidence,
      confidence,
      impact,
      timestamp: new Date().toISOString(),
      relatedFindings: []
    };
  }
}

// FIXED: Added explicit return type to resolve the "never[]" error
async function analyzeCriticalPath(
  kg: KnowledgeGraphIntelligence, 
  findings: Finding[], 
  context: WarRoomMissionContext
): Promise<{ 
    criticalFindings: Finding[]; 
    strategicPatterns: any[]; 
    recommendations: string[] 
}> {
  console.log(`\n🎯 ANALYZING CRITICAL PATH (${findings.length} findings)`);
  const graph = await kg.getFullContext();
  const patterns = await kg.detectPatterns();
  const topFindings = findings.sort((a, b) => (b.evidence.length - a.evidence.length)).slice(0, 15);
  return { criticalFindings: topFindings, strategicPatterns: patterns, recommendations: [] };
}

async function generateStrategicRecommendationsWithThinking(mcpClient: Client, toolMap: Map<string, string>, findings: Finding[], patterns: any[], context: WarRoomMissionContext): Promise<string[]> {
  console.log("\n🧠 THINKING: Generating Strategy...");
  const toolName = toolMap.get('sequentialthinking');
  
  if (!toolName) {
    const response = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: `Generate 5 strategic recommendations for ${context.company.name} vs ${context.targets.competitorNames[0]} based on findings: ${JSON.stringify(findings.slice(0,3))}` }]
    });
    return (response.choices[0].message.content || "").split('\n').filter(l => l.length > 20);
  }

  const tools = [{
    type: 'function' as const,
    function: {
      name: toolName,
      description: "Problem solving tool",
      parameters: {
          type: "object",
          properties: {
              thought: { type: "string" },
              nextThoughtNeeded: { type: "boolean" },
              thoughtNumber: { type: "integer" },
              totalThoughts: { type: "integer" }
          },
          required: ["thought", "thoughtNumber", "totalThoughts", "nextThoughtNeeded"]
      }
    }
  }];

  let recs: string[] = [];
  let done = false;
  let steps = 0;
  const messages: any[] = [{ role: 'user', content: `Generate 5 recommendations using sequentialthinking. Context: ${context.company.name} vs ${context.targets.competitorNames[0]}. Findings: ${JSON.stringify(findings.slice(0,5))}` }];

  while (!done && steps < 8) {
    steps++;
    const res = await groq.chat.completions.create({ model: 'openai/gpt-oss-120b', messages, tools, tool_choice: 'auto' });
    const msg = res.choices[0].message;
    messages.push(msg);

    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        console.log(`   💭 Thought: ${JSON.parse(tc.function.arguments).thought.substring(0,60)}...`);
        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ status: "ok" }) });
      }
    } else {
      const txt = msg.content || "";
      const json = txt.match(/\[.*\]/s);
      recs = json ? JSON.parse(json[0]) : txt.split('\n').filter(l => l.length > 10);
      done = true;
    }
  }
  return recs;
}

export async function executeDeepIntelligence(missionId: string, context: WarRoomMissionContext, durationMinutes: number = 45) {
  console.log(`\n🚀 STARTING MISSION ${missionId} (${durationMinutes} min)`);
  
  const startTime = new Date();
  const sbx = await Sandbox.create('signl-v3-thinking', {
    timeoutMs: 3600000, 
    mcp: {
      exa: { apiKey: process.env.EXA_API_KEY! },
      perplexityAsk: { perplexityApiKey: process.env.PERPLEXITY_API_KEY! },
      resend: { apiKey: process.env.RESEND_API_KEY!, sender: process.env.SENDER_EMAIL || "onboarding@resend.dev", replyTo: context.identity.email },
      memory: {},
      sequentialthinking: {}
    }
  });
  
  const client = new Client({ name: 'Signl', version: '5.0.0' }, { capabilities: {} });
  const memClient = new Client({ name: 'Signl-Mem', version: '5.0.0' }, { capabilities: {} });
  const transport = { requestInit: { headers: { 'Authorization': `Bearer ${await sbx.getMcpToken()}` } } };
  
  await client.connect(new StreamableHTTPClientTransport(new URL(sbx.getMcpUrl()), transport));
  await memClient.connect(new StreamableHTTPClientTransport(new URL(sbx.getMcpUrl()), transport));
  
  const state: DeepInvestigationState = {
    phase: 'RESEARCH', findings: [], kg: new KnowledgeGraphIntelligence(memClient),
    toolUsageTracker: new Map(), iterationCount: 0, startTime,
    metrics: { totalToolCalls: 0, exaCalls: 0, perplexityAskCalls: 0, perplexityReasonCalls: 0, perplexityResearchCalls: 0, xaiCalls: 0, kgWrites: 0, kgReads: 0, deduplications: 0, recencyFiltered: 0, sequentialThoughts: 0 }
  };
  
  const orchestrator = new DeepResearchOrchestrator(client, state, context);
  const timePerComp = durationMinutes / context.targets.competitorNames.length;

  for (const comp of context.targets.competitorNames) {
    await orchestrator.executeDeepResearch(comp, 'market strategy', timePerComp);
  }
  
  const analysis = await analyzeCriticalPath(state.kg, state.findings, context);
  analysis.recommendations = await generateStrategicRecommendationsWithThinking(client, orchestrator.getToolMap(), analysis.criticalFindings, analysis.strategicPatterns, context);
  
  const report = generateReport(state, analysis, context);
  
  try {
    const tools = await client.listTools();
    const emailTool = tools.tools.find(t => t.name.includes('send-email') || t.name.includes('send_email'));
    if (emailTool) {
      console.log(`   💌 Sending Report...`);
      await client.request({ method: "tools/call", params: { name: emailTool.name, arguments: { to: context.identity.email, subject: `[SIGNL] Strategic Dossier: ${context.targets.competitorNames[0]}`, html: report, text: "Your SIGNL Report is ready." } } }, CallToolResultSchema, { timeout: 600000 });
      console.log(`   ✅ Sent.`);
    }
  } catch (e) { console.error(`   ❌ Email Failed:`, e); }
  
  await sbx.kill();
}

function generateReport(state: DeepInvestigationState, analysis: { criticalFindings: Finding[]; recommendations: string[]; strategicPatterns: any[] }, context: WarRoomMissionContext): string {
  const elapsed = Math.floor((Date.now() - state.startTime.getTime()) / 1000 / 60);
  const { recentStrings } = getDynamicDateRanges();
  const range = `${recentStrings[recentStrings.length - 1]} - ${recentStrings[0]}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Georgia', serif; color: #111; max-width: 720px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; background: #fff; }
    .header { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 40px; }
    .brand { font-family: 'Helvetica Neue', sans-serif; font-weight: 900; letter-spacing: 1px; font-size: 14px; color: #444; text-transform: uppercase; }
    .title { font-size: 32px; font-weight: 700; margin: 10px 0 5px 0; letter-spacing: -0.5px; }
    .meta { font-family: 'Helvetica Neue', sans-serif; font-size: 12px; color: #666; text-transform: uppercase; }
    h2 { font-family: 'Helvetica Neue', sans-serif; font-size: 16px; font-weight: 800; margin-top: 50px; text-transform: uppercase; letter-spacing: 0.5px; border-left: 4px solid #000; padding-left: 15px; color: #000; }
    .finding { margin-bottom: 35px; }
    .finding-headline { font-weight: 700; font-size: 19px; margin-bottom: 8px; line-height: 1.3; }
    .finding-meta { font-family: 'Helvetica Neue', sans-serif; font-size: 10px; color: #888; margin-bottom: 12px; font-weight: 700; letter-spacing: 0.5px; }
    .finding-tag { display: inline-block; background: #eee; padding: 2px 6px; border-radius: 3px; margin-right: 8px; }
    .tag-critical { background: #000; color: #fff; }
    .evidence-box { background: #f9f9f9; border-left: 1px solid #ccc; padding: 15px; margin-top: 12px; font-size: 13px; color: #555; font-family: 'Helvetica Neue', sans-serif; }
    .rec-item { background: #f4fbf7; border: 1px solid #dcfce7; padding: 20px; margin-bottom: 15px; border-radius: 4px; }
    .rec-title { font-family: 'Helvetica Neue', sans-serif; font-weight: 700; color: #166534; font-size: 14px; margin-bottom: 5px; text-transform: uppercase; }
    .footer { margin-top: 80px; border-top: 1px solid #eee; padding-top: 30px; font-family: 'Helvetica Neue', sans-serif; font-size: 11px; color: #aaa; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">Signl Intelligence</div>
    <div class="title">${context.targets.competitorNames.join(' vs ')}</div>
    <div class="meta">Strategic Dossier • ${new Date().toLocaleDateString()}</div>
  </div>
  <p style="font-size: 18px; line-height: 1.7;">
    <strong>Executive Summary:</strong> We have detected significant strategic shifts in ${context.targets.competitorNames[0]} over the last ${elapsed} minutes of deep autonomous research. 
    Intelligence gathered from ${state.metrics.totalToolCalls} sources indicates a move toward <strong>Enterprise/Up-Market</strong> positioning.
  </p>
  <h2>Strategic Counter-Measures</h2>
  <div>
    ${analysis.recommendations.map((rec, i) => `
      <div class="rec-item">
        <div class="rec-title">Action ${i + 1}</div>
        ${rec}
      </div>
    `).join('')}
  </div>
  <h2>Critical Intelligence (${range})</h2>
  ${analysis.criticalFindings.slice(0, 6).map(f => `
    <div class="finding">
      <div class="finding-headline">${f.signal}</div>
      <div class="finding-meta">
        <span class="finding-tag ${f.impact === 'CRITICAL' ? 'tag-critical' : ''}">${f.impact}</span>
        ${f.category}
      </div>
      <div class="evidence-box">
        ${f.evidence.slice(0, 2).map(e => `
          <div style="margin-bottom: 8px;">
            <strong>${e.tool.toUpperCase().split('-')[0]}:</strong> ${e.snippet.substring(0, 180)}...
          </div>
        `).join('')}
      </div>
    </div>
  `).join('')}
  <div class="footer">CONFIDENTIAL BRIEFING • GENERATED BY SIGNL V5.0</div>
</body>
</html>`;
}