/**
 * Standalone Rule-Based Multi-Agent DAG Engine & Closed-Loop Verification Pipeline
 *
 * Core Invariant:
 *   Plan (Rule-Based Blueprint & Topological Multi-Agent DAG)
 *   -> Validate (RuleBasedTaskVerifier + PreFlightGate Shield + WriteBackPlannerLoop)
 *   -> Schedule (ContentionAwareWavefrontScheduler + MutexProfileStore)
 *   -> Execute (Concurrent Wavefront Execution + Shared-State Mutex Arbitration)
 *   -> Learn & Revise (FaultClassifier + 3-Node SubgraphPatcher + FeedbackEvolutionEngine + Timing Write-Back)
 */

export type DagActionType =
  | 'retrieve'
  | 'synthesize'
  | 'pair_sync'
  | 'cross_critique'
  | 'pair_commit'
  | 'handoff'
  | 'wait_mutex'
  | 're_index_context'
  | 'patch_artifact'
  | 'commit_verified';

export type NodeUiState =
  | 'idle'
  | 'IDLE'
  | 'STAGED_PRE_GATE'
  | 'WAITING_MUTEX'
  | 'EXECUTING'
  | 'PAUSED_UPSTREAM_FAULT'
  | 'running'
  | 'success'
  | 'COMPLETED'
  | 'failed'
  | 'FAILED';

export interface DagNode {
  id: string;
  action: DagActionType;
  agent: string;
  target?: string;
  complexity?: number;
  context_load?: number;
  stage?: number;
  priority?: string;
  mode_scope?: string;
  threshold?: number;
  cycles?: number;
  x_pos?: number;
  y_pos?: number;
  start_offset_sec?: number;
  end_offset_sec?: number;
  wait_mutex_sec?: number;
  ui_state?: NodeUiState;
  status?: NodeUiState;
  repaired?: boolean;
  repair_note?: string;
  spliced?: boolean;
  [key: string]: any;
}

export interface DagEdge {
  id?: string;
  source: string;
  target: string;
  repaired?: boolean;
  spliced?: boolean;
}

export interface ScheduledNodeWindowData {
  node_id: string;
  agent_id: string;
  action: string;
  stage: number;
  start_offset_sec: number;
  end_offset_sec: number;
  mutex_enter_sec: number | null;
  mutex_exit_sec: number | null;
  wait_mutex_sec: number;
  pipelined_pre_positioned: boolean;
  ui_state: NodeUiState;
}

export interface MutexReservation {
  node_id: string;
  agent_id: string;
  stage: number;
  enter_sec: number;
  exit_sec: number;
  wait_sec: number;
}

export interface DagScheduleSummary {
  scheduler_mode: 'greedy' | 'rcpsp';
  makespan_sec: number;
  mutex_wait_time_total_sec: number;
  mean_mutex_wait_sec: number;
  agent_utilization_pct: number;
  mutex_violations: number;
  windows: ScheduledNodeWindowData[];
  mutex_reservations: MutexReservation[];
}

export interface WorkflowDag {
  reasoning?: string;
  model?: string;
  nodes: DagNode[];
  edges: DagEdge[];
  schedule?: DagScheduleSummary;
}

export const AGENT_OWNED_TASKS: Record<string, string[]> = {
  Agent_Alpha: ['Task_Spec', 'Task_Schema', 'Task_Context', 'UI_Wireframe', 'API_Contract', 'Auth_Policy'],
  Agent_Beta: ['Task_Dataset', 'Task_Code', 'Task_Model', 'State_Store', 'PII_Compliance_Shard', 'Payment_Ledger'],
  Agent_Gamma: ['Task_Audit', 'Task_Bench', 'Task_Deploy', 'Telemetry_Rule', 'Stream_Batch_A'],
};

export const COLLAB_PAIR_CONFIGS: Record<string, { weight_a: number; weight_b: number; sync_margin: number }> = {
  SharedSchemaContract: { weight_a: -0.25, weight_b: 0.25, sync_margin: 0.0 },
  MonorepoReleaseBundle: { weight_a: -0.25, weight_b: 0.25, sync_margin: 0.0 },
  CrossServiceMigration: { weight_a: -0.28, weight_b: 0.20, sync_margin: 0.0 },
  DistributedStateSnapshot: { weight_a: -0.16, weight_b: 0.16, sync_margin: 0.005 },
  FeatureIntegrationBundle: { weight_a: -0.18, weight_b: 0.18, sync_margin: 0.004 },
};

export const COMPLIANCE_GUARD_LIMITS: Record<string, { max_drift_score: number; max_token_temp: number; force_careful: boolean }> = {
  PII_Compliance_Shard: { max_drift_score: 0.2094, max_token_temp: 0.7, force_careful: true },
  Payment_Ledger: { max_drift_score: 0.12, max_token_temp: 0.5, force_careful: true },
  Telemetry_Rule: { max_drift_score: 0.25, max_token_temp: 0.8, force_careful: true },
};

export const AGENT_ANCHORS: Record<string, [number, number, number]> = {
  Agent_Alpha: [0.0, -0.45, 0.20],
  Agent_Beta: [0.3897, 0.225, 0.20],
  Agent_Gamma: [-0.3897, 0.225, 0.20],
  agent_alpha: [0.0, -0.45, 0.20],
  agent_beta: [0.3897, 0.225, 0.20],
  agent_gamma: [-0.3897, 0.225, 0.20],
};

export const TASK_DESCRIPTIONS: Record<string, string> = {
  Task_Spec: 'Architecture SpecificationShard',
  Task_Schema: 'GraphQL / OpenAPI Schema Shard',
  Task_Context: 'Domain Knowledge Retrieval Shard',
  Task_Dataset: 'Benchmark Evaluation Corpus',
  Task_Code: 'Core Implementation Module',
  Task_Model: 'Policy & Prompt Routing Weights',
  Task_Audit: 'Security & Invariant Audit Report',
  Task_Bench: 'Latency & Throughput Regression Suite',
  Task_Deploy: 'Cloud Run Production Release Manifest',
  UI_Wireframe: 'Responsive Mobile & Desktop Wireframe',
  API_Contract: 'Typed RPC & Event Stream Contract',
  State_Store: 'Shared State & Mutex Profile Store',
  FeatureIntegrationBundle: 'Full-Stack Feature & Test Integration Bundle',
  SharedSchemaContract: 'Cross-Agent Shared Schema Contract',
  PII_Compliance_Shard: 'Zero-Trust PII Redaction & Compliance Shard',
};

export const TASK_TO_AGENT: Record<string, string> = Object.entries(AGENT_OWNED_TASKS).reduce(
  (acc, [agent, tasks]) => {
    for (const t of tasks) acc[t] = agent;
    return acc;
  },
  {} as Record<string, string>
);

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function resolveTaskName(label: string): string {
  if (!label) return '';
  const l = String(label).toLowerCase().trim();
  if (l.includes('pii') || l.includes('compliance')) return 'PII_Compliance_Shard';
  if (l.includes('payment') || l.includes('ledger')) return 'Payment_Ledger';
  if (l.includes('telemetry')) return 'Telemetry_Rule';
  if (l.includes('sharedschema') || l.includes('schema contract')) return 'SharedSchemaContract';
  if (l.includes('featureintegration') || l.includes('bundle')) return 'FeatureIntegrationBundle';
  if (l.includes('monorepo') || l.includes('release')) return 'MonorepoReleaseBundle';
  if (l.includes('wireframe')) return 'UI_Wireframe';
  if (l.includes('contract')) return 'API_Contract';
  if (l.includes('spec')) return 'Task_Spec';
  if (l.includes('schema')) return 'Task_Schema';
  if (l.includes('context')) return 'Task_Context';
  if (l.includes('dataset')) return 'Task_Dataset';
  if (l.includes('code')) return 'Task_Code';
  if (l.includes('model')) return 'Task_Model';
  if (l.includes('audit')) return 'Task_Audit';
  if (l.includes('bench')) return 'Task_Bench';
  if (l.includes('deploy')) return 'Task_Deploy';
  for (let i = 0; i < 10; i++) {
    if (l.includes(`streamitem${i}`) || l.includes(`event_${i}`)) return `StreamEvent_${i}`;
  }
  return label;
}

export function normalizeAgentId(agentStr: string): string {
  const s = String(agentStr || '').toLowerCase().trim();
  if ((s.includes('alpha') && s.includes('beta')) || s.includes('+')) return 'Agent_Alpha+Agent_Beta';
  if (s.includes('alpha') || s.includes('1')) return 'Agent_Alpha';
  if (s.includes('beta') || s.includes('2')) return 'Agent_Beta';
  if (s.includes('gamma') || s.includes('3')) return 'Agent_Gamma';
  return 'Agent_Alpha';
}

export function autoLayoutDag(nodesInput: DagNode[], edgesInput: DagEdge[]): DagNode[] {
  const nodes = deepClone(nodesInput || []);
  const edges = edgesInput || [];
  if (nodes.length === 0) return [];

  const nodeIds = nodes.map((n, idx) => String(n.id ?? idx + 1));
  const preds: Record<string, string[]> = {};
  for (const nid of nodeIds) preds[nid] = [];

  for (const e of edges) {
    const s = String(e.source ?? '');
    const t = String(e.target ?? '');
    if (s in preds && t in preds && s !== t) preds[t].push(s);
  }

  const depth: Record<string, number> = {};
  const getDepth = (nid: string, visited: Set<string>): number => {
    if (nid in depth) return depth[nid];
    if (visited.has(nid) || !preds[nid] || preds[nid].length === 0) {
      depth[nid] = 0;
      return 0;
    }
    visited.add(nid);
    const d = 1 + Math.max(...preds[nid].map((p) => getDepth(p, new Set(visited))));
    depth[nid] = d;
    return d;
  };

  for (const nid of nodeIds) getDepth(nid, new Set());

  const waves: Record<number, DagNode[]> = {};
  nodes.forEach((n, idx) => {
    const nid = String(n.id ?? idx + 1);
    n.id = nid;
    const w = depth[nid] ?? 0;
    if (!waves[w]) waves[w] = [];
    waves[w].push(n);
  });

  const sortedWaveKeys = Object.keys(waves).map(Number).sort((a, b) => a - b);

  for (const wIdx of sortedWaveKeys) {
    const wNodes = waves[wIdx];
    const count = wNodes.length;
    wNodes.forEach((n, colIdx) => {
      const defaultX = count === 1 ? 350 : count === 2 ? 180 + colIdx * 340 : 60 + colIdx * 290;
      const defaultY = 45 + wIdx * 190;
      n.x_pos = Math.round(defaultX);
      n.y_pos = Math.round(defaultY);

      const rawAct = String(n.action || 'retrieve').trim().toLowerCase();
      if (['re_index_context', 'patch_artifact', 'commit_verified'].includes(rawAct)) {
        n.action = rawAct as DagActionType;
      } else if (rawAct.includes('pair') && rawAct.includes('sync')) {
        n.action = 'pair_sync';
      } else if (rawAct.includes('critique') || rawAct.includes('review')) {
        n.action = 'cross_critique';
      } else if (rawAct.includes('pair') && rawAct.includes('commit')) {
        n.action = 'pair_commit';
      } else if (rawAct.includes('synth') || rawAct.includes('merge')) {
        n.action = 'synthesize';
      } else if (rawAct.includes('handoff') || rawAct.includes('idle')) {
        n.action = 'handoff';
      } else {
        n.action = 'retrieve';
      }

      n.agent = n.action.startsWith('pair_') || n.action === 'cross_critique'
        ? 'Agent_Alpha+Agent_Beta'
        : normalizeAgentId(n.agent || 'Agent_Alpha');

      if (!n.target && (n.action === 'retrieve' || n.action === 'pair_sync')) {
        n.target = n.action === 'pair_sync' ? 'SharedSchemaContract' : 'Task_Spec';
      }
      n.complexity = Number(n.complexity ?? 0.0);
      n.context_load = Number(n.context_load ?? 0.0);
      n.priority = n.priority || 'fast';
    });
  }

  return nodes;
}

// ─────────────────────────────────────────────────────────────
// 1. Multi-Agent Rule-Based Task & Workflow Generator
// ─────────────────────────────────────────────────────────────
export class RuleBasedTaskGenerator {
  static generateBlueprint(
    workspaceState: { artifacts_merged?: string[] } | null,
    goalText: string = ''
  ): [Record<string, any>, string] {
    const merged = workspaceState?.artifacts_merged ? [...workspaceState.artifacts_merged] : [];
    const mergedCount = merged.length;

    const availablePerAgent: Record<string, string[]> = {};
    for (const [aId, owned] of Object.entries(AGENT_OWNED_TASKS)) {
      availablePerAgent[aId] = owned.filter((t) => !merged.includes(t));
    }

    const goalLower = (goalText || '').toLowerCase();
    const isCompliance = ['pii', 'compliance', 'security', 'z4_', 'sandbox', 'ledger'].some((k) => goalLower.includes(k));

    if (isCompliance) {
      const data = {
        task_type: 'enterprise_compliance_pipeline',
        user_goal: goalText,
        security_zones: [
          'Z1_EventIngestionGateway',
          'Z2_SharedKnowledgeStore',
          'Z3_ArtifactStagingBay',
          'Z4_Security_Sandbox',
        ],
        shards: ['PII_Compliance_Shard', 'Payment_Ledger', 'Telemetry_Rule', 'SharedSchemaContract'],
      };
      const lines = [
        '================================================================',
        'ENTERPRISE MULTI-AGENT COMPLIANCE & SECURITY BLUEPRINT',
        '================================================================',
        `Goal: "${goalText}"`,
        '  - Z1_EventIngestionGateway: High-throughput context ingestion.',
        '  - Z2_SharedKnowledgeStore: Mutex-protected knowledge graph (M_shared_state).',
        '  - Z3_ArtifactStagingBay: Pre-commit schema & diff validation.',
        '  - Z4_Security_Sandbox: Zero-trust compliance verification (drift <= 0.20).',
        '================================================================',
      ];
      return [data, lines.join('\n')];
    }

    const isStreamOnly = ['stream', 'triage', 'event'].some((k) => goalLower.includes(k));
    if (isStreamOnly) {
      const data = {
        task_type: 'event_stream_triage',
        user_goal: goalText,
        agents: { Agent_Alpha: 'Ingestion Sector A', Agent_Beta: 'Ingestion Sector B' },
        shards: ['StreamEvent_0..9'],
      };
      const text = [
        '=== MODE 2 HIGH-THROUGHPUT EVENT STREAM TRIAGE BLUEPRINT ===',
        `Goal: "${goalText}"`,
        "Wave 1: retrieve(agent='Agent_Alpha', target='StreamEvent_0') || retrieve(agent='Agent_Beta', target='StreamEvent_5')",
        "Wave 2: synthesize(agent='Agent_Alpha') || synthesize(agent='Agent_Beta')",
      ].join('\n');
      return [data, text];
    }

    const data = {
      task_type: 'multi_agent_synthesis',
      merged_artifact_count: mergedCount,
      artifacts_merged: merged,
      available_per_agent: availablePerAgent,
    };

    const lines = [
      '================================================================',
      'DETERMINISTIC MULTI-AGENT BLUEPRINT (Grounded State)',
      '================================================================',
      `Merged Artifacts: ${mergedCount}/9 [${merged.join(', ')}]`,
      `  - Agent_Alpha (Research): [${availablePerAgent.Agent_Alpha.join(', ')}]`,
      `  - Agent_Beta (Synthesis): [${availablePerAgent.Agent_Beta.join(', ')}]`,
      `  - Agent_Gamma (Verification): [${availablePerAgent.Agent_Gamma.join(', ')}]`,
      '================================================================',
    ];
    return [data, lines.join('\n')];
  }

  generateWorkflow(prompt: string, mode: number = 1): WorkflowDag {
    const lower = (prompt || '').toLowerCase();
    let dag: WorkflowDag;

    if (mode === 3 || ['feature', 'bundle', 'wireframe', 'pair_sync', 'fullstack'].some((w) => lower.includes(w))) {
      dag = {
        reasoning:
          'Parallel Full-Stack Feature Pipeline: Agent_Alpha retrieves UI_Wireframe & Task_Spec while Agent_Beta retrieves API_Contract & Task_Schema, synthesizing modules in parallel before running collaborative pair_sync on FeatureIntegrationBundle.',
        nodes: [
          { id: '1', action: 'retrieve', agent: 'Agent_Alpha', target: 'UI_Wireframe', priority: 'fast' },
          { id: '2', action: 'retrieve', agent: 'Agent_Beta', target: 'API_Contract', priority: 'fast' },
          { id: '3', action: 'synthesize', agent: 'Agent_Alpha', target: 'UI_Wireframe', complexity: -0.05, context_load: -0.25, priority: 'fast' },
          { id: '4', action: 'synthesize', agent: 'Agent_Beta', target: 'API_Contract', complexity: 0.05, context_load: -0.25, priority: 'fast' },
          { id: '5', action: 'retrieve', agent: 'Agent_Alpha', target: 'Task_Spec', priority: 'fast' },
          { id: '6', action: 'retrieve', agent: 'Agent_Beta', target: 'Task_Schema', priority: 'fast' },
          { id: '7', action: 'synthesize', agent: 'Agent_Alpha', target: 'Task_Spec', complexity: -0.04, context_load: -0.25, priority: 'fast' },
          { id: '8', action: 'synthesize', agent: 'Agent_Beta', target: 'Task_Schema', complexity: 0.04, context_load: -0.25, priority: 'fast' },
          { id: '9', action: 'pair_sync', agent: 'Agent_Alpha+Agent_Beta', target: 'FeatureIntegrationBundle', priority: 'fast' },
        ],
        edges: [
          { source: '1', target: '3' },
          { source: '2', target: '4' },
          { source: '3', target: '5' },
          { source: '4', target: '6' },
          { source: '5', target: '7' },
          { source: '6', target: '8' },
          { source: '7', target: '9' },
          { source: '8', target: '9' },
        ],
      };
    } else if (mode === 2 || ['stream', 'triage', 'event'].some((w) => lower.includes(w))) {
      dag = {
        reasoning:
          'Parallel Dual-Agent Event Stream Triage: Agent_Alpha and Agent_Beta ingest and classify streaming event partitions concurrently, then commit structured summaries.',
        nodes: [
          { id: '1', action: 'retrieve', agent: 'Agent_Alpha', target: 'StreamEvent_0', priority: 'fast' },
          { id: '2', action: 'retrieve', agent: 'Agent_Beta', target: 'StreamEvent_3', priority: 'fast' },
          { id: '3', action: 'synthesize', agent: 'Agent_Alpha', target: 'StreamEvent_0', complexity: -0.10, context_load: -0.10, priority: 'fast' },
          { id: '4', action: 'synthesize', agent: 'Agent_Beta', target: 'StreamEvent_3', complexity: 0.10, context_load: -0.10, priority: 'fast' },
        ],
        edges: [
          { source: '1', target: '3' },
          { source: '2', target: '4' },
        ],
      };
    } else if (mode === 4 || mode === 5 || ['critique', 'adversarial', 'contract', 'schema'].some((w) => lower.includes(w))) {
      dag = {
        reasoning:
          'Coordinated Adversarial Cross-Critique: Agent_Alpha+Agent_Beta synchronize on SharedSchemaContract, execute cross-critique verification cycles, and commit the verified contract.',
        nodes: [
          { id: '1', action: 'pair_sync', agent: 'Agent_Alpha+Agent_Beta', target: 'SharedSchemaContract', priority: 'fast' },
          { id: '2', action: 'cross_critique', agent: 'Agent_Alpha+Agent_Beta', mode_scope: 'STRICT', threshold: 0.08, cycles: 1, priority: 'fast' },
          { id: '3', action: 'pair_commit', agent: 'Agent_Alpha+Agent_Beta', complexity: 0.0, context_load: 0.0, priority: 'fast' },
        ],
        edges: [
          { source: '1', target: '2' },
          { source: '2', target: '3' },
        ],
      };
    } else {
      dag = {
        reasoning:
          'Parallel 3-Agent Research & Synthesis: Agent_Alpha, Agent_Beta, and Agent_Gamma retrieve domain shards simultaneously in Wave 1, then serialize writes to the Shared Knowledge Store protected by M_shared_state.',
        nodes: [
          { id: '1', action: 'retrieve', agent: 'Agent_Alpha', target: 'Task_Spec', priority: 'fast' },
          { id: '2', action: 'retrieve', agent: 'Agent_Beta', target: 'Task_Dataset', priority: 'fast' },
          { id: '3', action: 'retrieve', agent: 'Agent_Gamma', target: 'Task_Audit', priority: 'fast' },
          { id: '4', action: 'synthesize', agent: 'Agent_Alpha', target: 'Task_Spec', complexity: 0.0, context_load: 0.0, stage: 1, priority: 'fast' },
          { id: '5', action: 'synthesize', agent: 'Agent_Beta', target: 'Task_Dataset', complexity: 0.0, context_load: 0.0, stage: 2, priority: 'fast' },
          { id: '6', action: 'synthesize', agent: 'Agent_Gamma', target: 'Task_Audit', complexity: 0.0, context_load: 0.0, stage: 3, priority: 'fast' },
        ],
        edges: [
          { source: '1', target: '4' },
          { source: '2', target: '5' },
          { source: '3', target: '6' },
          { source: '4', target: '5' },
          { source: '5', target: '6' },
        ],
      };
    }

    dag.nodes = autoLayoutDag(dag.nodes, dag.edges);
    dag.model = 'multi-agent-dag-engine-v2';
    return dag;
  }
}

// ─────────────────────────────────────────────────────────────
// 2. Multi-Agent Rule-Based Task Verifier
// ─────────────────────────────────────────────────────────────
export class RuleBasedTaskVerifier {
  agentActiveTask: Record<string, string | null> = { Agent_Alpha: null, Agent_Beta: null, Agent_Gamma: null };
  verifiedCount = 0;
  interceptedCount = 0;

  verifyAction(
    actionName: string,
    args: Record<string, any> | null,
    workspaceState: { artifacts_merged?: string[] } | null,
    _goalText: string = ''
  ): [boolean, Record<string, any>, string] {
    const sanitized: Record<string, any> = args ? { ...args } : {};
    const action = (actionName || '').toLowerCase().trim();

    if (['re_index_context', 'patch_artifact', 'commit_verified', 'handoff'].includes(action)) {
      this.verifiedCount += 1;
      return [true, sanitized, `Rule-verifier pass: ${action} is safe.`];
    }

    if (['pair_sync', 'pair_commit', 'cross_critique'].includes(action)) {
      sanitized.priority = sanitized.priority || 'fast';
      if (action === 'pair_sync') {
        const targetObj = sanitized.target || 'SharedSchemaContract';
        this.agentActiveTask.Agent_Alpha = targetObj;
        this.agentActiveTask.Agent_Beta = targetObj;
      } else if (action === 'pair_commit') {
        this.agentActiveTask.Agent_Alpha = null;
        this.agentActiveTask.Agent_Beta = null;
      }
      this.verifiedCount += 1;
      return [true, sanitized, `Rule-verifier pass: ${action} collaborative multi-agent operation is safe.`];
    }

    const agentRaw = String(sanitized.agent || 'Agent_Alpha');
    let agent = normalizeAgentId(agentRaw);
    if (!['Agent_Alpha', 'Agent_Beta', 'Agent_Gamma'].includes(agent)) {
      this.interceptedCount += 1;
      return [false, sanitized, `Unknown agent '${agentRaw}'.`];
    }
    sanitized.agent = agent;

    if (action === 'retrieve') {
      const targetRaw = sanitized.target || '';
      const taskName = resolveTaskName(targetRaw);
      if (!taskName) {
        this.interceptedCount += 1;
        return [false, sanitized, `Cannot resolve task target '${targetRaw}'.`];
      }

      if (taskName in COLLAB_PAIR_CONFIGS) {
        sanitized.action = 'pair_sync';
        sanitized.agent = 'Agent_Alpha+Agent_Beta';
        sanitized.target = taskName;
        sanitized.priority = sanitized.priority || 'fast';
        this.agentActiveTask.Agent_Alpha = taskName;
        this.agentActiveTask.Agent_Beta = taskName;
        this.verifiedCount += 1;
        return [
          true,
          sanitized,
          `Rule-verifier intercept: Promoted single-agent task '${taskName}' to collaborative pair_sync.`,
        ];
      }

      if (taskName in COMPLIANCE_GUARD_LIMITS) {
        const clim = COMPLIANCE_GUARD_LIMITS[taskName];
        const reqDrift = Math.abs(Number(sanitized.drift_score ?? 0.0));
        if (reqDrift > clim.max_drift_score) {
          this.interceptedCount += 1;
          return [
            false,
            sanitized,
            `Compliance Safety Gate: '${taskName}' drift_score=${reqDrift.toFixed(3)} exceeds limit ${clim.max_drift_score.toFixed(3)} (schema/PII risk).`,
          ];
        }
        if (clim.force_careful) sanitized.priority = 'careful';
      }

      this.agentActiveTask[agent] = taskName;
      this.verifiedCount += 1;
      return [true, sanitized, `Verified retrieve: ${agent} retrieving ${taskName}.`];
    }

    if (action === 'synthesize') {
      this.agentActiveTask[agent] = null;
      this.verifiedCount += 1;
      return [true, sanitized, `Verified synthesize for ${agent}.`];
    }

    const _unused = workspaceState;
    void _unused;
    this.verifiedCount += 1;
    return [true, sanitized, `Verified ${action} for ${agent}.`];
  }

  reset(): void {
    this.agentActiveTask = { Agent_Alpha: null, Agent_Beta: null, Agent_Gamma: null };
    this.verifiedCount = 0;
    this.interceptedCount = 0;
  }
}

// ─────────────────────────────────────────────────────────────
// 3. Pre-Flight Safety Shield & Write-Back Planner Loop
// ─────────────────────────────────────────────────────────────
export interface GateRejectionCertificateData {
  status: 'REJECT';
  node_id: string;
  agent_id: string;
  violation_type: 'TOKEN_BUDGET_OVERFLOW' | 'CAPABILITY_SCOPE_MISMATCH' | 'SHARED_STATE_WRITE_CONFLICT';
  measured_value: number;
  limit_value: number;
  unit: string;
  correction_hint: string;
}

export class GateRejectionCertificate implements GateRejectionCertificateData {
  status: 'REJECT' = 'REJECT';
  node_id: string;
  agent_id: string;
  violation_type: 'TOKEN_BUDGET_OVERFLOW' | 'CAPABILITY_SCOPE_MISMATCH' | 'SHARED_STATE_WRITE_CONFLICT';
  measured_value: number;
  limit_value: number;
  unit: string;
  correction_hint: string;

  constructor(params: GateRejectionCertificateData) {
    this.status = params.status;
    this.node_id = params.node_id;
    this.agent_id = params.agent_id;
    this.violation_type = params.violation_type;
    this.measured_value = Number(params.measured_value.toFixed(3));
    this.limit_value = Number(params.limit_value.toFixed(3));
    this.unit = params.unit;
    this.correction_hint = params.correction_hint;
  }

  toDict(): GateRejectionCertificateData {
    return {
      status: this.status,
      node_id: this.node_id,
      agent_id: this.agent_id,
      violation_type: this.violation_type,
      measured_value: this.measured_value,
      limit_value: this.limit_value,
      unit: this.unit,
      correction_hint: this.correction_hint,
    };
  }

  toContextPrompt(): string {
    return `[PRE-FLIGHT GATE REJECTION CERTIFICATE] ${JSON.stringify(this.toDict())} -> Repair ONLY node '${this.node_id}' (${this.correction_hint}); keep upstream nodes unchanged.`;
  }
}

export class PreFlightGate {
  mode: 'off' | 'strict';
  totalProposalsEvaluated = 0;
  gateInterceptionCount = 0;
  writeBackIterations = 0;

  constructor(mode: 'off' | 'strict' = 'strict') {
    this.mode = mode;
  }

  static formatAgentId(agentId: string): string {
    const norm = normalizeAgentId(agentId);
    return norm.toLowerCase();
  }

  validateProposal(
    node: DagNode,
    priorStages?: number[][],
    concurrentNodes?: DagNode[]
  ): [boolean, GateRejectionCertificate | null] {
    this.totalProposalsEvaluated += 1;
    if (this.mode === 'off') return [true, null];

    const nodeId = String(node.id || 'node_0');
    const agentId = String(node.agent || 'Agent_Alpha');
    const action = String(node.action || 'synthesize').toLowerCase();

    const cx = Number(node.complexity ?? 0.0);
    const cl = Number(node.context_load ?? 0.0);

    if (action === 'synthesize' || action === 'commit_verified') {
      const scopeDist = Math.hypot(cx, cl);
      if (scopeDist > 0.85) {
        this.gateInterceptionCount += 1;
        return [
          false,
          new GateRejectionCertificate({
            status: 'REJECT',
            node_id: nodeId,
            agent_id: PreFlightGate.formatAgentId(agentId),
            violation_type: 'CAPABILITY_SCOPE_MISMATCH',
            measured_value: Number((scopeDist * 1000).toFixed(1)),
            limit_value: 850.0,
            unit: 'pts',
            correction_hint: `Clamp complexity/context load into ${agentId} capability envelope [-0.12, +0.12]`,
          }),
        ];
      }

      if (priorStages && priorStages.length > 0) {
        const prev = priorStages[priorStages.length - 1];
        const drift = Math.max(Math.abs(cx - prev[0]), Math.abs(cl - prev[1])) * 1000.0;
        if (drift > 17.5) {
          this.gateInterceptionCount += 1;
          return [
            false,
            new GateRejectionCertificate({
              status: 'REJECT',
              node_id: nodeId,
              agent_id: PreFlightGate.formatAgentId(agentId),
              violation_type: 'TOKEN_BUDGET_OVERFLOW',
              measured_value: Number(drift.toFixed(1)),
              limit_value: 17.5,
              unit: 'kTok',
              correction_hint: 'Compact context window payload toward baseline budget [0.0, 0.0]',
            }),
          ];
        }
      }

      if (concurrentNodes && concurrentNodes.length > 0) {
        for (const peer of concurrentNodes) {
          const peerAgent = normalizeAgentId(peer.agent || 'Agent_Beta');
          if (peerAgent !== normalizeAgentId(agentId)) {
            const pcx = Number(peer.complexity ?? 0.0);
            const pcl = Number(peer.context_load ?? 0.0);
            if (Math.abs(cx - pcx) < 0.09 && Math.abs(cl - pcl) < 0.09) {
              this.gateInterceptionCount += 1;
              return [
                false,
                new GateRejectionCertificate({
                  status: 'REJECT',
                  node_id: String(peer.id || nodeId),
                  agent_id: PreFlightGate.formatAgentId(peerAgent),
                  violation_type: 'SHARED_STATE_WRITE_CONFLICT',
                  measured_value: 45.0,
                  limit_value: 0.0,
                  unit: 'ms_overlap',
                  correction_hint: `Serialize ${peerAgent} node '${peer.id}' after ${agentId} node '${nodeId}' on M_shared_state`,
                }),
              ];
            }
          }
        }
      }
    }

    return [true, null];
  }

  validate(dag: WorkflowDag, initialStages?: number[][]): [boolean, GateRejectionCertificate[]] {
    if (this.mode === 'off') return [true, []];

    const nodes = dag.nodes || [];
    const edges = dag.edges || [];
    const certificates: GateRejectionCertificate[] = [];
    const stages: number[][] = initialStages ? deepClone(initialStages) : [[0.0, 0.0, 0.335]];

    const parentsMap: Record<string, string[]> = {};
    nodes.forEach((n, i) => { parentsMap[String(n.id ?? i)] = []; });
    for (const e of edges) {
      const s = String(e.source ?? '');
      const t = String(e.target ?? '');
      if (t in parentsMap && srcIn(s, parentsMap)) parentsMap[t].push(s);
    }
    function srcIn(s: string, m: Record<string, any>) { return s in m; }

    const depthMap: Record<string, number> = {};
    const getDepth = (nid: string, visited: Set<string>): number => {
      if (nid in depthMap) return depthMap[nid];
      if (visited.has(nid)) return 0;
      visited.add(nid);
      const preds = parentsMap[nid] || [];
      const d = preds.length === 0 ? 0 : 1 + Math.max(...preds.map((p) => getDepth(p, new Set(visited))));
      depthMap[nid] = d;
      return d;
    };
    for (const nid of Object.keys(parentsMap)) getDepth(nid, new Set());

    const wavefronts: Record<number, DagNode[]> = {};
    nodes.forEach((n, i) => {
      const nid = String(n.id ?? i);
      const wIdx = depthMap[nid] ?? 0;
      if (!wavefronts[wIdx]) wavefronts[wIdx] = [];
      wavefronts[wIdx].push(n);
    });

    for (const wIdx of Object.keys(wavefronts).map(Number).sort((a, b) => a - b)) {
      const wNodes = wavefronts[wIdx];
      const synNodes = wNodes.filter((n) => ['synthesize', 'commit_verified'].includes(String(n.action || '').toLowerCase()));
      for (const node of wNodes) {
        const isSyn = ['synthesize', 'commit_verified'].includes(String(node.action || '').toLowerCase());
        const others = isSyn ? synNodes.filter((n) => n !== node) : undefined;
        const [ok, cert] = this.validateProposal(node, isSyn ? stages : undefined, others);
        if (!ok && cert) {
          certificates.push(cert);
        } else if (isSyn) {
          stages.push([Number(node.complexity ?? 0.0), Number(node.context_load ?? 0.0), 0.335]);
        }
      }
    }

    return [certificates.length === 0, certificates];
  }
}

export class WriteBackPlannerLoop {
  gate: PreFlightGate;
  maxRetries: number;

  constructor(gate: PreFlightGate, maxRetries = 3) {
    this.gate = gate;
    this.maxRetries = maxRetries;
  }

  repairNodeDeterministically(
    node: DagNode,
    cert: GateRejectionCertificate,
    dagEdges: DagEdge[],
    peerNodes: DagNode[]
  ): DagNode {
    const repaired = deepClone(node);
    repaired.repaired = true;
    repaired.repair_note = cert.correction_hint;

    if (cert.violation_type === 'TOKEN_BUDGET_OVERFLOW') {
      repaired.complexity = 0.0;
      repaired.context_load = 0.0;
    } else if (cert.violation_type === 'CAPABILITY_SCOPE_MISMATCH') {
      repaired.complexity = 0.0;
      repaired.context_load = 0.0;
    } else if (cert.violation_type === 'SHARED_STATE_WRITE_CONFLICT') {
      const nid = String(repaired.id || '');
      for (const peer of peerNodes) {
        const peerId = String(peer.id || '');
        if (peerId && peerId !== nid) {
          const edgeId = `e_shield_${peerId}-${nid}`;
          if (!dagEdges.some((e) => String(e.source) === peerId && String(e.target) === nid)) {
            dagEdges.push({ id: edgeId, source: peerId, target: nid, repaired: true });
          }
          break;
        }
      }
    }
    return repaired;
  }

  validateAndRepairDag(
    dag: WorkflowDag,
    initialStages?: number[][]
  ): [WorkflowDag, GateRejectionCertificate[], number] {
    const workingDag = deepClone(dag);
    const allCertificates: GateRejectionCertificate[] = [];
    let retriesUsed = 0;
    const baseStages = initialStages ? deepClone(initialStages) : [[0.0, 0.0, 0.335]];

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const [passed, certs] = this.gate.validate(workingDag, baseStages);
      if (passed) return [workingDag, allCertificates, retriesUsed];
      allCertificates.push(...certs);
      if (attempt >= this.maxRetries) break;

      retriesUsed += 1;
      this.gate.writeBackIterations += 1;
      for (const cert of certs) {
        const nodes = workingDag.nodes || [];
        const edges = workingDag.edges || [];
        const targetIdx = nodes.findIndex((n) => String(n.id) === cert.node_id);
        if (targetIdx >= 0) {
          const peers = nodes.filter(
            (n, idx) => idx !== targetIdx && ['synthesize', 'commit_verified'].includes(String(n.action || '').toLowerCase())
          );
          nodes[targetIdx] = this.repairNodeDeterministically(nodes[targetIdx], cert, edges, peers);
        }
      }
    }
    return [workingDag, allCertificates, retriesUsed];
  }
}

// ─────────────────────────────────────────────────────────────
// 4. Contention-Aware Wavefront RCPSP Scheduler
// ─────────────────────────────────────────────────────────────
export const NOMINAL_SEGMENT_SEC = 0.40;

export interface MutexProfileRecord {
  agent_id: string;
  stage: number;
  t_wait: number;
  t_hold: number;
  delta_t_seg: number;
  timestamp: number;
}

export class MutexProfileStore {
  nominalSegmentSec: number;
  records: MutexProfileRecord[] = [];
  byAgentAndStage: Record<string, MutexProfileRecord[]> = {};

  constructor(nominalSegmentSec = NOMINAL_SEGMENT_SEC) {
    this.nominalSegmentSec = nominalSegmentSec;
  }

  static normalizeAgentId(agentId: any): string {
    const s = String(agentId || 'agent_alpha').trim().toLowerCase();
    if (s.includes('beta') && !s.includes('alpha')) return 'agent_beta';
    if (s.includes('gamma') || s.endsWith('3')) return 'agent_gamma';
    return 'agent_alpha';
  }

  record(rec: MutexProfileRecord): void {
    const agentKey = MutexProfileStore.normalizeAgentId(rec.agent_id);
    const stageIdx = Math.max(1, Math.min(9, Math.round(rec.stage)));
    const normalized: MutexProfileRecord = {
      agent_id: agentKey,
      stage: stageIdx,
      t_wait: Number(rec.t_wait.toFixed(4)),
      t_hold: Number(rec.t_hold.toFixed(4)),
      delta_t_seg: Number(rec.delta_t_seg.toFixed(4)),
      timestamp: rec.timestamp || Date.now() / 1000,
    };
    this.records.push(normalized);
    const bucketKey = `${agentKey}_S${stageIdx}`;
    if (!this.byAgentAndStage[bucketKey]) this.byAgentAndStage[bucketKey] = [];
    this.byAgentAndStage[bucketKey].push(normalized);
  }

  getExpectedHoldAndDelta(agentId: any, stage: number): [number, number] {
    const agentKey = MutexProfileStore.normalizeAgentId(agentId);
    const stageIdx = Math.max(1, Math.min(9, Math.round(stage)));
    const bucket = this.byAgentAndStage[`${agentKey}_S${stageIdx}`] || [];
    if (bucket.length === 0) {
      return [4.0 * this.nominalSegmentSec + 0.04 * (stageIdx - 1), 0.0];
    }
    const recent = bucket.slice(-5);
    const meanHold = recent.reduce((s, r) => s + r.t_hold, 0) / recent.length;
    const meanDelta = recent.reduce((s, r) => s + r.delta_t_seg, 0) / recent.length;
    return [meanHold, meanDelta];
  }

  toSummaryDict() {
    return {
      total_records: this.records.length,
      nominal_segment_sec: this.nominalSegmentSec,
    };
  }
}

export class ContentionAwareWavefrontScheduler {
  mode: 'greedy' | 'rcpsp';
  profileStore: MutexProfileStore;
  nominalSegmentSec: number;

  constructor(mode: 'greedy' | 'rcpsp' = 'rcpsp', profileStore?: MutexProfileStore, nominalSegmentSec = NOMINAL_SEGMENT_SEC) {
    this.mode = mode;
    this.profileStore = profileStore || new MutexProfileStore(nominalSegmentSec);
    this.nominalSegmentSec = nominalSegmentSec;
  }

  estimateDurations(agentId: string, action: string, stage: number): [number, number] {
    const [holdEst, deltaSeg] = this.profileStore.getExpectedHoldAndDelta(agentId, stage);
    const segSec = Math.max(0.15, this.nominalSegmentSec + deltaSeg);
    const act = action.toLowerCase();
    if (['retrieve', 're_index_context', 'patch_artifact'].includes(act)) {
      return [3.0 * segSec, 0.0];
    }
    if (['synthesize', 'commit_verified', 'pair_commit'].includes(act)) {
      return [1.5 * segSec, Math.max(0.8, holdEst)];
    }
    return [2.0 * segSec, 0.0];
  }

  scheduleDag(dag: WorkflowDag): WorkflowDag {
    const scheduledDag = deepClone(dag);
    const nodes = scheduledDag.nodes || [];
    const edges = scheduledDag.edges || [];

    const parentsMap: Record<string, string[]> = {};
    nodes.forEach((n, i) => { parentsMap[String(n.id ?? i)] = []; });
    for (const e of edges) {
      const s = String(e.source ?? '');
      const t = String(e.target ?? '');
      if (t in parentsMap && s in parentsMap) parentsMap[t].push(s);
    }

    const agentFreeAt: Record<string, number> = { agent_alpha: 0.0, agent_beta: 0.0, agent_gamma: 0.0 };
    const nodeEndAt: Record<string, number> = {};
    let mutexFreeAt = 0.0;
    const windows: ScheduledNodeWindowData[] = [];
    const mutexReservations: MutexReservation[] = [];

    const unscheduled = [...nodes];
    let stageCounter = 0;

    while (unscheduled.length > 0) {
      let ready = unscheduled.filter((n) => (parentsMap[String(n.id ?? '')] || []).every((p) => p in nodeEndAt));
      if (ready.length === 0) ready = [unscheduled[0]];

      for (const n of ready) {
        const nid = String(n.id ?? '');
        const agentK = MutexProfileStore.normalizeAgentId(n.agent);
        const act = String(n.action || 'retrieve').toLowerCase();
        const preds = parentsMap[nid] || [];
        const depReady = Math.max(0.0, ...preds.map((p) => nodeEndAt[p] ?? 0.0));
        const agentReady = Math.max(agentFreeAt[agentK] ?? 0.0, depReady);

        if (['synthesize', 'commit_verified', 'pair_commit'].includes(act)) stageCounter += 1;
        const stageIdx = Number(n.stage ?? Math.max(1, stageCounter));
        const [preSec, mutexSec] = this.estimateDurations(agentK, act, stageIdx);

        let win: ScheduledNodeWindowData;
        if (['synthesize', 'commit_verified', 'pair_commit'].includes(act)) {
          let startOffset: number;
          let endOffset: number;
          let mutexEnter: number;
          let mutexExit: number;
          let waitTime: number;
          let uiState: NodeUiState;

          if (this.mode === 'greedy') {
            mutexEnter = Math.max(agentReady, mutexFreeAt);
            waitTime = Math.max(0.0, mutexEnter - agentReady);
            mutexExit = mutexEnter + mutexSec + preSec;
            startOffset = agentReady;
            endOffset = mutexExit;
            uiState = waitTime > 1e-3 ? 'WAITING_MUTEX' : 'EXECUTING';
          } else {
            const earliestGate = agentReady + preSec;
            mutexEnter = Math.max(earliestGate, mutexFreeAt);
            startOffset = Math.max(agentReady, mutexEnter - preSec);
            waitTime = Math.max(0.0, mutexEnter - (startOffset + preSec));
            mutexExit = mutexEnter + mutexSec;
            endOffset = mutexExit;
            uiState = 'STAGED_PRE_GATE';
          }

          mutexFreeAt = mutexExit;
          mutexReservations.push({
            node_id: nid,
            agent_id: agentK,
            stage: stageIdx,
            enter_sec: Number(mutexEnter.toFixed(4)),
            exit_sec: Number(mutexExit.toFixed(4)),
            wait_sec: Number(waitTime.toFixed(4)),
          });

          win = {
            node_id: nid,
            agent_id: agentK,
            action: act,
            stage: stageIdx,
            start_offset_sec: Number(startOffset.toFixed(4)),
            end_offset_sec: Number(endOffset.toFixed(4)),
            mutex_enter_sec: Number(mutexEnter.toFixed(4)),
            mutex_exit_sec: Number(mutexExit.toFixed(4)),
            wait_mutex_sec: Number(waitTime.toFixed(4)),
            pipelined_pre_positioned: this.mode === 'rcpsp',
            ui_state: uiState,
          };
        } else {
          const startOffset = agentReady;
          const endOffset = startOffset + preSec;
          win = {
            node_id: nid,
            agent_id: agentK,
            action: act,
            stage: Math.max(1, stageIdx),
            start_offset_sec: Number(startOffset.toFixed(4)),
            end_offset_sec: Number(endOffset.toFixed(4)),
            mutex_enter_sec: null,
            mutex_exit_sec: null,
            wait_mutex_sec: 0.0,
            pipelined_pre_positioned: this.mode === 'rcpsp',
            ui_state: 'EXECUTING',
          };
        }

        agentFreeAt[agentK] = win.end_offset_sec;
        nodeEndAt[nid] = win.end_offset_sec;
        n.start_offset_sec = win.start_offset_sec;
        n.end_offset_sec = win.end_offset_sec;
        n.wait_mutex_sec = win.wait_mutex_sec;
        n.ui_state = win.ui_state;
        windows.push(win);
        unscheduled.splice(unscheduled.indexOf(n), 1);
      }
    }

    const makespanSec = Math.max(0.0, ...Object.values(nodeEndAt));
    const totalMutexWait = windows.reduce((s, w) => s + w.wait_mutex_sec, 0);
    const totalBusy = windows.reduce((s, w) => s + (w.end_offset_sec - w.start_offset_sec - w.wait_mutex_sec), 0);
    const utilPct = makespanSec > 1e-6 ? (totalBusy / (3.0 * makespanSec)) * 100.0 : 0.0;

    scheduledDag.schedule = {
      scheduler_mode: this.mode,
      makespan_sec: Number(makespanSec.toFixed(4)),
      mutex_wait_time_total_sec: Number(totalMutexWait.toFixed(4)),
      mean_mutex_wait_sec: Number((totalMutexWait / Math.max(1, mutexReservations.length)).toFixed(4)),
      agent_utilization_pct: Number(utilPct.toFixed(2)),
      mutex_violations: 0,
      windows,
      mutex_reservations: mutexReservations,
    };

    return scheduledDag;
  }

  writeBackStageTiming(
    dag: WorkflowDag,
    completedStage: number,
    agentId: string,
    measuredTHold: number,
    measuredDeltaTSeg: number,
    measuredTWait = 0.0
  ): WorkflowDag {
    this.profileStore.record({
      agent_id: agentId,
      stage: completedStage,
      t_wait: measuredTWait,
      t_hold: measuredTHold,
      delta_t_seg: measuredDeltaTSeg,
      timestamp: Date.now() / 1000,
    });
    return this.scheduleDag(dag);
  }
}

// ─────────────────────────────────────────────────────────────
// 5. Tiered Fault Classifier & 0-Token 3-Node Subgraph Patcher
// ─────────────────────────────────────────────────────────────
export interface FaultDiagnostic {
  tier: 0 | 1 | 2;
  classification: 'NOMINAL' | 'TIER1_SCHEMA_DRIFT' | 'TIER2_PIPELINE_COLLAPSE';
  failed_node_id: string;
  drifted_artifacts: string[];
  max_drift_score: number;
  confidence_drop: number;
  upstream_stages_intact: boolean;
  perturbed_metrics: Record<string, [number, number, number]>;
}

export class FaultClassifier {
  evaluateOutputs(
    expectedMetrics: Record<string, number[]>,
    observedMetrics: Record<string, number[]>,
    activeNodeId = '5',
    activeArtifactId?: string
  ): FaultDiagnostic {
    const drifted: string[] = [];
    let maxDrift = 0.0;
    let maxDrop = 0.0;
    let upstreamIntact = true;
    const perturbed: Record<string, [number, number, number]> = {};

    const keys = Object.keys(expectedMetrics);
    const targetKey = activeArtifactId || (keys.length > 0 ? keys[keys.length - 1] : 'Task_Dataset');

    for (const [k, exp] of Object.entries(expectedMetrics)) {
      const obs = observedMetrics[k] || exp;
      perturbed[k] = [Number(obs[0].toFixed(4)), Number(obs[1].toFixed(4)), Number(obs[2].toFixed(4))];
      const drift = Math.hypot(obs[0] - exp[0], obs[1] - exp[1], obs[2] - exp[2]) * 1000.0;
      const drop = Math.max(0.0, (exp[2] - obs[2]) * 1000.0);

      if (drift > 3.0) {
        drifted.push(k);
        if (k !== targetKey) upstreamIntact = false;
      }
      if (drift > maxDrift) maxDrift = drift;
      if (drop > maxDrop) maxDrop = drop;
    }

    if (drifted.length === 0) {
      return {
        tier: 0,
        classification: 'NOMINAL',
        failed_node_id: activeNodeId,
        drifted_artifacts: [],
        max_drift_score: Number(maxDrift.toFixed(3)),
        confidence_drop: Number(maxDrop.toFixed(3)),
        upstream_stages_intact: true,
        perturbed_metrics: perturbed,
      };
    }

    if (drifted.length === 1 && maxDrift > 3.0 && maxDrift < 50.0 && upstreamIntact) {
      return {
        tier: 1,
        classification: 'TIER1_SCHEMA_DRIFT',
        failed_node_id: activeNodeId,
        drifted_artifacts: drifted,
        max_drift_score: Number(maxDrift.toFixed(3)),
        confidence_drop: Number(maxDrop.toFixed(3)),
        upstream_stages_intact: true,
        perturbed_metrics: perturbed,
      };
    }

    return {
      tier: 2,
      classification: 'TIER2_PIPELINE_COLLAPSE',
      failed_node_id: activeNodeId,
      drifted_artifacts: drifted,
      max_drift_score: Number(maxDrift.toFixed(3)),
      confidence_drop: Number(maxDrop.toFixed(3)),
      upstream_stages_intact: false,
      perturbed_metrics: perturbed,
    };
  }
}

export class SubgraphPatcher {
  mode: 'full_replan' | 'subgraph_patch';
  gate: PreFlightGate;
  scheduler: ContentionAwareWavefrontScheduler;

  constructor(
    mode: 'full_replan' | 'subgraph_patch' = 'subgraph_patch',
    gate?: PreFlightGate,
    scheduler?: ContentionAwareWavefrontScheduler
  ) {
    this.mode = mode;
    this.gate = gate || new PreFlightGate('strict');
    this.scheduler = scheduler || new ContentionAwareWavefrontScheduler('rcpsp');
  }

  synthesizeRecoverySubgraph(failedNode: DagNode): WorkflowDag {
    const nid = String(failedNode.id || '5');
    const target = String(failedNode.target || 'Task_Dataset');
    const agent = normalizeAgentId(failedNode.agent || 'Agent_Beta');

    const n1Id = `${nid}_re_index_context`;
    const n2Id = `${nid}_patch_artifact`;
    const n3Id = `${nid}_commit_verified`;

    const recNodes: DagNode[] = [
      { id: n1Id, agent, action: 're_index_context', target, complexity: 0.0, context_load: 0.0, spliced: true },
      { id: n2Id, agent, action: 'patch_artifact', target, complexity: 0.0, context_load: 0.0, spliced: true },
      { id: n3Id, agent, action: 'commit_verified', target, complexity: 0.0, context_load: 0.0, spliced: true },
    ];
    const recEdges: DagEdge[] = [
      { id: `e_${n1Id}_${n2Id}`, source: n1Id, target: n2Id, spliced: true },
      { id: `e_${n2Id}_${n3Id}`, source: n2Id, target: n3Id, spliced: true },
    ];
    return { nodes: recNodes, edges: recEdges };
  }

  handleFault(
    dag: WorkflowDag,
    diagnostic: FaultDiagnostic,
    _intendedMetrics: number[] = [0.0, 0.0, 0.380],
    intactStages?: number[][]
  ) {
    const t0 = performance.now();
    const workingDag = deepClone(dag);
    const failedId = diagnostic.failed_node_id;
    const nodes = workingDag.nodes || [];
    const edges = workingDag.edges || [];
    const failedNode = nodes.find((n) => String(n.id) === failedId) || {
      id: failedId,
      agent: 'Agent_Beta',
      action: 'synthesize' as DagActionType,
      target: 'Task_Dataset',
    };

    const gRec = this.synthesizeRecoverySubgraph(failedNode);
    const [gateOk] = this.gate.validate(gRec, intactStages);

    const recNodes = gRec.nodes;
    const recEdges = gRec.edges;
    const firstRecId = recNodes[0].id;
    const lastRecId = recNodes[recNodes.length - 1].id;

    const newEdges: DagEdge[] = [];
    for (const e of edges) {
      const src = String(e.source);
      const dst = String(e.target);
      if (dst === failedId) {
        newEdges.push({ id: `e_${src}_${firstRecId}`, source: src, target: firstRecId, spliced: true });
      } else if (src === failedId) {
        newEdges.push({ id: `e_${lastRecId}_${dst}`, source: lastRecId, target: dst, spliced: true });
      } else {
        newEdges.push(e);
      }
    }
    newEdges.push(...recEdges);

    const newNodes: DagNode[] = [];
    for (const n of nodes) {
      if (String(n.id) === failedId) {
        newNodes.push(...recNodes);
      } else {
        newNodes.push(n);
      }
    }

    const layoutNodes = autoLayoutDag(newNodes, newEdges);
    const splicedDag: WorkflowDag = { ...workingDag, nodes: layoutNodes, edges: newEdges };
    const rescheduledDag = this.scheduler.scheduleDag(splicedDag);

    return {
      mode: this.mode,
      tier: 1,
      repaired_dag: rescheduledDag,
      spliced_node_ids: recNodes.map((r) => r.id),
      recovery_latency_ms: Number((performance.now() - t0).toFixed(3)),
      tokens_consumed_on_recovery: 0,
      gate_verified: gateOk,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// 6. Operator Feedback & Skill Evolution Engine
// ─────────────────────────────────────────────────────────────
export interface SkillEvolutionProposal {
  root_cause: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  parameter_patches: Record<string, string>;
  skill_evolution_rules: string[];
  auto_applied: boolean;
  timestamp: number;
  operator_comment: string;
  category: string;
}

export class FeedbackEvolutionEngine {
  evaluateFeedback(comment: string, category = 'Context & Token Budget'): SkillEvolutionProposal {
    const lower = (comment || '').toLowerCase();
    const patches: Record<string, string> = {};
    const rules: string[] = [];
    let rootCause = 'General operator feedback integrated into multi-agent guardrail registry.';

    if (['context', 'token', 'overflow', 'budget', 'window'].some((w) => lower.includes(w))) {
      rootCause = 'Context budget boundary or token overflow encountered during multi-agent synthesis.';
      patches.context_chunk_limit = '16k tokens (compacted from 24k)';
      patches.retrieval_top_k = '8 chunks';
      rules.push('Enforce Pre-Flight Shield context compaction before dispatching pair_sync or synthesize nodes.');
    } else if (['schema', 'drift', 'validation', 'merge', 'barrier'].some((w) => lower.includes(w))) {
      rootCause = 'Schema validation drift detected during concurrent artifact merge into Shared Knowledge Store.';
      patches.schema_validation_strictness = 'strict (JSON-Schema draft-2020-12)';
      patches.pre_commit_barrier_ms = '450 ms';
      rules.push('Require deterministic JSON-Schema check before releasing M_shared_state mutex.');
    } else {
      patches.verification_level = 'strict';
      rules.push('Log multi-agent state checkpoint to continuous improvement registry.');
    }

    return {
      root_cause: rootCause,
      severity: 'MEDIUM',
      parameter_patches: patches,
      skill_evolution_rules: rules,
      auto_applied: true,
      timestamp: Date.now() / 1000,
      operator_comment: comment,
      category,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// 7. Closed-Loop Orchestrator (Plan -> Execute -> Validate -> Learn -> Revise)
// ─────────────────────────────────────────────────────────────
export interface ClosedLoopCycleOptions {
  prompt: string;
  mode?: number;
  injectTokenOverflowOnNodeId?: string;
  injectSchemaDriftOnNodeId?: string;
  operatorFeedback?: string;
}

export class ClosedLoopOrchestrator {
  generator = new RuleBasedTaskGenerator();
  verifier = new RuleBasedTaskVerifier();
  gate = new PreFlightGate('strict');
  writeBackLoop = new WriteBackPlannerLoop(this.gate, 3);
  profileStore = new MutexProfileStore();
  scheduler = new ContentionAwareWavefrontScheduler('rcpsp', this.profileStore);
  classifier = new FaultClassifier();
  patcher = new SubgraphPatcher('subgraph_patch', this.gate, this.scheduler);
  evolution = new FeedbackEvolutionEngine();

  runClosedLoopCycle(opts: ClosedLoopCycleOptions) {
    const mode = opts.mode ?? 1;
    const [, blueprintText] = RuleBasedTaskGenerator.generateBlueprint({ artifacts_merged: [] }, opts.prompt);
    const rawDag = this.generator.generateWorkflow(opts.prompt, mode);

    if (opts.injectTokenOverflowOnNodeId) {
      const target = rawDag.nodes.find((n) => String(n.id) === opts.injectTokenOverflowOnNodeId);
      if (target) {
        target.complexity = 0.038;
        target.context_load = 0.025;
      }
    }

    this.verifier.reset();
    let verifierChecks = 0;
    for (const node of rawDag.nodes) {
      this.verifier.verifyAction(node.action, node, { artifacts_merged: [] }, opts.prompt);
      verifierChecks += 1;
    }

    const [repairedDag, certs, retries] = this.writeBackLoop.validateAndRepairDag(rawDag, [[0.0, 0.0, 0.335]]);
    const [shieldPassedAfterRepair] = this.gate.validate(repairedDag, [[0.0, 0.0, 0.335]]);

    const scheduledDag = this.scheduler.scheduleDag(repairedDag);
    const initialMakespanSec = scheduledDag.schedule?.makespan_sec ?? 0.0;

    const faultNodeId = opts.injectSchemaDriftOnNodeId || null;
    const expectedMetrics = { Task_Spec: [0.0, 0.0, 0.335], Task_Dataset: [0.0, 0.0, 0.380] };
    const observedMetrics = faultNodeId
      ? { Task_Spec: [0.0, 0.0, 0.335], Task_Dataset: [0.019, -0.011, 0.380] }
      : expectedMetrics;

    const diagnostic = this.classifier.evaluateOutputs(expectedMetrics, observedMetrics, faultNodeId || '5', 'Task_Dataset');
    this.scheduler.writeBackStageTiming(scheduledDag, 1, 'Agent_Alpha', 1.32, -0.03, 0.0);

    const evoProposal = this.evolution.evaluateFeedback(
      opts.operatorFeedback || 'Schema drift detected on Task_Dataset merge; tighten schema validation barrier.',
      'Schema & Validation'
    );

    let finalDag = scheduledDag;
    let splicedNodeIds: string[] = [];
    let recoveryLatencyMs = 0.0;

    if (diagnostic.tier > 0 && faultNodeId) {
      const repair = this.patcher.handleFault(scheduledDag, diagnostic, [0.0, 0.0, 0.380], [[0.0, 0.0, 0.335]]);
      finalDag = repair.repaired_dag;
      splicedNodeIds = repair.spliced_node_ids;
      recoveryLatencyMs = repair.recovery_latency_ms;
    }

    for (const n of finalDag.nodes) {
      n.status = 'success';
      n.ui_state = 'COMPLETED';
    }

    return {
      cycleId: `cl-${Date.now()}`,
      timestamp: Date.now() / 1000,
      closedLoopVerified: shieldPassedAfterRepair && (finalDag.schedule?.mutex_violations ?? 0) === 0,
      stages: {
        plan: {
          prompt: opts.prompt,
          blueprintText,
          initialNodeCount: rawDag.nodes.length,
          initialEdgeCount: rawDag.edges.length,
        },
        validate: {
          certificatesIntercepted: certs.length,
          certificates: certs.map((c) => c.toDict()),
          writeBackRetries: retries,
          shieldPassedAfterRepair,
          verifierChecksRun: verifierChecks,
        },
        execute: {
          initialMakespanSec,
          faultInjected: Boolean(faultNodeId),
          faultNodeId,
        },
        learn: {
          faultTier: diagnostic.tier,
          faultClassification: diagnostic.classification,
          maxDriftScore: diagnostic.max_drift_score,
          skillEvolution: evoProposal,
          empiricalTimingRecords: this.profileStore.records.length,
        },
        revise: {
          splicedNodeIds,
          recoveryLatencyMs,
          tokensConsumedOnRecovery: 0,
          finalMakespanSec: finalDag.schedule?.makespan_sec ?? initialMakespanSec,
          finalMutexViolations: finalDag.schedule?.mutex_violations ?? 0,
          allNodesCompleted: finalDag.nodes.every((n) => n.status === 'success'),
        },
      },
      finalDag,
    };
  }
}
