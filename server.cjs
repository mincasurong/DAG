/**
 * Standalone Rule-Based Multi-Agent DAG Backend & Monitoring Server (:3001 / :8080)
 *
 * Provides:
 * - GET  /api/logs                  (SSE stream: logs, agent telemetry, action trace, closed-loop events)
 * - GET  /api/status                (Engine status + live agent metrics + monitoring summary)
 * - POST /api/workflow/generate     (Rule-based blueprint + parallel multi-agent DAG synthesis + RCPSP schedule)
 * - POST /api/workflow/validate     (PreFlightGate Shield + WriteBackPlannerLoop + RCPSP Wavefront Schedule)
 * - POST /api/workflow/execute-step (Simulated concurrent multi-agent execution with M_shared_state mutex arbitration)
 * - POST /api/closed-loop/run       (Automated Plan -> Execute -> Validate -> Learn -> Revise closed loop)
 * - POST /api/feedback              (Operator feedback & guardrail evolution synthesizer)
 * - POST /api/audit                 (System health diagnostic audit)
 * - POST /api/reset                 (Reset multi-agent workspace & telemetry)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

let logBuffer = [];
const MAX_LOG_LINES = 2000;
let sseClients = [];

function createInitialState() {
  return {
    running: true,
    mode: 1,
    merged_count: 0,
    artifacts_merged: [],
    shared_state_locked_by: null,
    agents: {
      Agent_Alpha: {
        state: 'READY',
        phase: 'IDLE',
        action: 'idle',
        target: '',
        busy_pct: 22,
        idle_pct: 78,
        tasks_completed: 0,
        tasks_failed: 0,
        role: 'Research & Retrieval',
      },
      Agent_Beta: {
        state: 'READY',
        phase: 'IDLE',
        action: 'idle',
        target: '',
        busy_pct: 19,
        idle_pct: 81,
        tasks_completed: 0,
        tasks_failed: 0,
        role: 'Code & Synthesis',
      },
      Agent_Gamma: {
        state: 'READY',
        phase: 'IDLE',
        action: 'idle',
        target: '',
        busy_pct: 17,
        idle_pct: 83,
        tasks_completed: 0,
        tasks_failed: 0,
        role: 'Audit & Verification',
      },
    },
    shield_telemetry: {
      shield_mode: 'strict',
      total_proposals_evaluated: 0,
      gate_interception_count: 0,
      write_back_iterations: 0,
      last_certificates: [],
    },
    closed_loop_history: [],
    skill_evolution_history: [],
  };
}

let simState = createInitialState();

function getMetricsSnapshot() {
  return {
    timestamp: Date.now() / 1000,
    agents: simState.agents,
    merged_count: simState.merged_count,
    shared_state_locked_by: simState.shared_state_locked_by,
  };
}

function getMonitoringSummary() {
  const totalCompleted =
    simState.agents.Agent_Alpha.tasks_completed +
    simState.agents.Agent_Beta.tasks_completed +
    simState.agents.Agent_Gamma.tasks_completed;
  const totalFailed =
    simState.agents.Agent_Alpha.tasks_failed +
    simState.agents.Agent_Beta.tasks_failed +
    simState.agents.Agent_Gamma.tasks_failed;
  const denies = simState.shield_telemetry.gate_interception_count;
  const totalOps = Math.max(1, totalCompleted + totalFailed);
  const successRate = Math.round((totalCompleted / totalOps) * 100);
  const healthScore = Math.max(68, Math.min(100, 100 - totalFailed * 8 - Math.min(15, denies * 2)));

  const anomalies = [];
  for (const cert of simState.shield_telemetry.last_certificates.slice(-4)) {
    anomalies.push({
      severity: 'WARN',
      component: `PreFlightGate:${cert.violation_type}`,
      description: `Node #${cert.node_id} (${cert.agent_id}) intercepted (${cert.measured_value}${cert.unit} > ${cert.limit_value}${cert.unit}) -> ${cert.correction_hint}`,
    });
  }
  if (simState.closed_loop_history.length > 0) {
    const lastCl = simState.closed_loop_history[simState.closed_loop_history.length - 1];
    if (lastCl.stages?.learn?.faultTier === 1) {
      anomalies.push({
        severity: 'INFO',
        component: 'SubgraphPatcher:Tier1',
        description: `Schema drift (${lastCl.stages.learn.maxDriftScore} pts) repaired via 0-token 3-node splice [${lastCl.stages.revise.splicedNodeIds.join(' -> ')}].`,
      });
    }
  }

  return {
    health_score: healthScore,
    status: healthScore >= 90 ? 'HEALTHY' : healthScore >= 75 ? 'DEGRADED' : 'ANOMALOUS',
    executive_summary: `Multi-Agent Rule-Based DAG Engine active (Shield: ${simState.shield_telemetry.shield_mode}, Scheduler: RCPSP Wavefront). Evaluated ${simState.shield_telemetry.total_proposals_evaluated} DAG nodes with ${denies} pre-flight interceptions auto-repaired via Write-Back Loop and ${simState.closed_loop_history.length} closed-loop verification cycles completed.`,
    anomalies,
    recommendations: [
      'Use RCPSP Wavefront Scheduling to pre-stage agents at STAGED_PRE_GATE before acquiring the shared-state mutex (M_shared_state).',
      'Keep Pre-Flight Safety Shield in strict mode to auto-repair TOKEN_BUDGET_OVERFLOW and SHARED_STATE_WRITE_CONFLICT before execution.',
      'Route localized schema drifts (Tier-1) through 0-token 3-node Subgraph Splicing (re_index_context -> patch_artifact -> commit_verified).',
    ],
    timestamp: Date.now() / 1000,
    model: 'multi-agent-dag-engine-v2',
    stats: {
      total_logs: logBuffer.length,
      errors: totalFailed,
      warnings: denies,
      guardrail_denies: denies,
      task_success_rate_pct: totalCompleted === 0 && totalFailed === 0 ? 100 : successRate,
    },
  };
}

function broadcast(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((res) => {
    try { res.write(payload); } catch {}
  });
}

function appendLog(line, level = 20, component = 'dag_engine') {
  const ts = new Date().toISOString();
  const formatted = `[${ts.slice(11, 19)}] [${component}] ${line}`;
  logBuffer.push(formatted);
  if (logBuffer.length > MAX_LOG_LINES) logBuffer = logBuffer.slice(-MAX_LOG_LINES);
  broadcast({
    type: 'log',
    line: formatted,
    level,
    name: component,
    msg: line,
    metrics: getMetricsSnapshot(),
  });
}


function attachComfyAndSimulink(n, idx = 0) {
  const agent = String(n.agent || 'Agent_Alpha');
  const action = String(n.action || 'retrieve');
  const defaultModel = agent.includes('Beta')
    ? 'claude-opus-4'
    : agent.includes('Gamma')
    ? 'gemini-3.5-flash-lite'
    : 'gemini-4-argon';

  if (!n.comfy_params) {
    n.comfy_params = {
      model_checkpoint: defaultModel,
      temperature: action === 'synthesize' ? 0.15 : 0.25,
      top_p: 0.95,
      max_tokens: action === 'synthesize' ? 8192 : 4096,
      seed: 42819001 + idx * 137,
      control_after_generate: 'fixed',
      steps: action === 'cross_critique' ? 30 : 20,
      cfg_scale: 7.5,
      sampler_name: 'rcpsp_wavefront',
      scheduler: 'rcpsp_pipelined',
    };
  }

  if (!n.inputs) {
    n.inputs = [
      { name: 'MODEL', type: 'MODEL', color: '#a78bfa' },
      { name: 'CONTEXT', type: 'CONTEXT', color: '#fbbf24' },
      { name: 'PROMPT', type: 'PROMPT', color: '#fb923c' },
    ];
  }

  if (!n.outputs) {
    n.outputs = [
      { name: 'ARTIFACT', type: 'ARTIFACT', color: '#38bdf8' },
      { name: 'STATE', type: 'STATE', color: '#f472b6' },
    ];
  }

  if (!n.subsystem) {
    const modelUsed = n.comfy_params.model_checkpoint || defaultModel;
    n.subsystem = {
      name: `${action.toUpperCase()}_SubSystem`,
      inports: ['In1 (Context)', 'In2 (Model)'],
      outports: ['Out1 (Artifact)', 'Out2 (State)'],
      mask_params: { gain_k: 1.0, filter_tau_s: 0.12, schema_guard: 'strict' },
      sub_blocks: [
        { id: 'sb_in', label: 'In1: ContextBus', block_type: 'Inport', model: 'simulink/Inport', params: { port: 1, bus_width: 4 }, status: 'idle' },
        { id: 'sb_filter', label: action === 'synthesize' ? 'StateMux & Pre-Filter' : 'Tokenizer & Embedder', block_type: action === 'synthesize' ? 'Mux' : 'Filter', model: 'text-embedding-004', params: { chunk_size: 512, tau_s: 0.12 }, status: 'idle' },
        { id: 'sb_sampler', label: `KSampler (${modelUsed})`, block_type: 'ModelOp', model: modelUsed, params: { steps: n.comfy_params.steps, cfg: n.comfy_params.cfg_scale, temp: n.comfy_params.temperature }, status: 'idle' },
        { id: 'sb_verify', label: 'Schema & Gain Guard', block_type: 'Verifier', model: 'shield-verifier-v2', params: { gain_k: 1.0, threshold: 0.95 }, status: 'idle' },
        { id: 'sb_out', label: 'Out1: ArtifactOut', block_type: 'Outport', model: 'simulink/Outport', params: { port: 1 }, status: 'idle' },
      ],
      sub_edges: [
        { id: 'se_1', source: 'sb_in', target: 'sb_filter' },
        { id: 'se_2', source: 'sb_filter', target: 'sb_sampler' },
        { id: 'se_3', source: 'sb_sampler', target: 'sb_verify' },
        { id: 'se_4', source: 'sb_verify', target: 'sb_out' },
      ],
    };
  }
}

function autoLayoutDag(nodesInput, edgesInput) {
  const nodes = JSON.parse(JSON.stringify(nodesInput || []));
  const edges = edgesInput || [];
  if (!nodes.length) return [];

  const nodeIds = nodes.map((n, idx) => String(n.id ?? idx + 1));
  const preds = {};
  nodeIds.forEach((id) => { preds[id] = []; });
  edges.forEach((e) => {
    const s = String(e.source ?? '');
    const t = String(e.target ?? '');
    if (s in preds && t in preds && s !== t) preds[t].push(s);
  });

  const depth = {};
  function getDepth(nid, visited = new Set()) {
    if (nid in depth) return depth[nid];
    if (visited.has(nid) || !preds[nid] || preds[nid].length === 0) {
      depth[nid] = 0;
      return 0;
    }
    visited.add(nid);
    const d = 1 + Math.max(...preds[nid].map((p) => getDepth(p, new Set(visited))));
    depth[nid] = d;
    return d;
  }
  nodeIds.forEach((id) => getDepth(id));

  const waves = {};
  nodes.forEach((n, idx) => {
    const nid = String(n.id ?? idx + 1);
    n.id = nid;
    const w = depth[nid] ?? 0;
    if (!waves[w]) waves[w] = [];
    waves[w].push(n);
  });

  Object.keys(waves).map(Number).sort((a, b) => a - b).forEach((wIdx) => {
    const wNodes = waves[wIdx];
    wNodes.forEach((n, colIdx) => {
      const defaultX = wNodes.length === 1 ? 360 : wNodes.length === 2 ? 180 + colIdx * 360 : 50 + colIdx * 310;
      const defaultY = 45 + wIdx * 265;
      n.x_pos = defaultX;
      n.y_pos = defaultY;
      n.complexity = Number(n.complexity ?? 0.0);
      n.context_load = Number(n.context_load ?? 0.0);
      n.priority = n.priority || 'fast';
      attachComfyAndSimulink(n, wIdx * 10 + colIdx);
    });
  });

  return nodes;
}

function validateAndScheduleDag(dagInput, schedulerMode = 'rcpsp', shieldMode = 'strict') {
  const dag = JSON.parse(JSON.stringify(dagInput || { nodes: [], edges: [] }));
  const nodes = dag.nodes || [];
  const edges = dag.edges || [];
  const certificates = [];
  let retries = 0;

  if (shieldMode === 'strict') {
    const priorStages = [[0.0, 0.0, 0.335]];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      simState.shield_telemetry.total_proposals_evaluated += 1;
      const act = String(n.action || 'retrieve').toLowerCase();
      const agent = String(n.agent || 'Agent_Alpha').split('+')[0];
      const cx = Number(n.complexity ?? 0.0);
      const cl = Number(n.context_load ?? 0.0);

      if (act === 'synthesize' || act === 'commit_verified') {
        const scopeDist = Math.hypot(cx, cl);
        if (scopeDist > 0.85) {
          const cert = {
            status: 'REJECT',
            node_id: String(n.id),
            agent_id: agent.toLowerCase(),
            violation_type: 'CAPABILITY_SCOPE_MISMATCH',
            measured_value: Number((scopeDist * 1000).toFixed(1)),
            limit_value: 850.0,
            unit: 'pts',
            correction_hint: `Clamp complexity/context into ${agent} capability envelope [-0.12, +0.12]`,
          };
          certificates.push(cert);
          simState.shield_telemetry.gate_interception_count += 1;
          simState.shield_telemetry.write_back_iterations += 1;
          retries += 1;
          n.complexity = 0.0;
          n.context_load = 0.0;
          n.repaired = true;
          n.repair_note = cert.correction_hint;
        }

        const prev = priorStages[priorStages.length - 1];
        const driftKTok = Math.max(Math.abs(Number(n.complexity ?? 0) - prev[0]), Math.abs(Number(n.context_load ?? 0) - prev[1])) * 1000.0;
        if (driftKTok > 17.5) {
          const cert = {
            status: 'REJECT',
            node_id: String(n.id),
            agent_id: agent.toLowerCase(),
            violation_type: 'TOKEN_BUDGET_OVERFLOW',
            measured_value: Number(driftKTok.toFixed(1)),
            limit_value: 17.5,
            unit: 'kTok',
            correction_hint: 'Compact context window payload toward baseline budget [0.0, 0.0]',
          };
          certificates.push(cert);
          simState.shield_telemetry.gate_interception_count += 1;
          simState.shield_telemetry.write_back_iterations += 1;
          retries += 1;
          n.complexity = 0.0;
          n.context_load = 0.0;
          n.repaired = true;
          n.repair_note = cert.correction_hint;
        }

        priorStages.push([Number(n.complexity ?? 0), Number(n.context_load ?? 0), 0.335]);
      }
    }

    const synNodes = nodes.filter((n) => ['synthesize', 'commit_verified'].includes(String(n.action || '').toLowerCase()));
    for (let i = 0; i < synNodes.length - 1; i++) {
      const a = synNodes[i];
      const b = synNodes[i + 1];
      const hasEdge = edges.some(
        (e) =>
          (String(e.source) === String(a.id) && String(e.target) === String(b.id)) ||
          (String(e.source) === String(b.id) && String(e.target) === String(a.id))
      );
      if (!hasEdge && Math.abs(Number(a.complexity ?? 0)) <= 0.18 && Math.abs(Number(b.complexity ?? 0)) <= 0.18) {
        const cert = {
          status: 'REJECT',
          node_id: String(b.id),
          agent_id: String(b.agent || 'Agent_Beta').toLowerCase(),
          violation_type: 'SHARED_STATE_WRITE_CONFLICT',
          measured_value: 45.0,
          limit_value: 0.0,
          unit: 'ms_overlap',
          correction_hint: `Serialize node '${b.id}' after node '${a.id}' on M_shared_state`,
        };
        certificates.push(cert);
        simState.shield_telemetry.gate_interception_count += 1;
        simState.shield_telemetry.write_back_iterations += 1;
        retries += 1;
        edges.push({ id: `e_shield_${a.id}-${b.id}`, source: String(a.id), target: String(b.id), repaired: true });
      }
    }
  }

  simState.shield_telemetry.last_certificates = certificates;

  const parentsMap = {};
  nodes.forEach((n) => { parentsMap[String(n.id)] = []; });
  edges.forEach((e) => {
    const s = String(e.source);
    const t = String(e.target);
    if (t in parentsMap && s in parentsMap) parentsMap[t].push(s);
  });

  const agentFreeAt = { agent_alpha: 0, agent_beta: 0, agent_gamma: 0 };
  const nodeEndAt = {};
  let mutexFreeAt = 0;
  const windows = [];
  const mutexReservations = [];
  const unscheduled = [...nodes];
  let stageCounter = 0;

  while (unscheduled.length > 0) {
    let ready = unscheduled.filter((n) => (parentsMap[String(n.id)] || []).every((p) => p in nodeEndAt));
    if (!ready.length) ready = [unscheduled[0]];

    for (const n of ready) {
      const nid = String(n.id);
      const aNorm = String(n.agent || 'Agent_Alpha').toLowerCase();
      const agentK = aNorm.includes('beta') && !aNorm.includes('alpha')
        ? 'agent_beta'
        : aNorm.includes('gamma')
        ? 'agent_gamma'
        : 'agent_alpha';
      const act = String(n.action || 'retrieve').toLowerCase();
      const depReady = Math.max(0, ...(parentsMap[nid] || []).map((p) => nodeEndAt[p] ?? 0));
      const agentReady = Math.max(agentFreeAt[agentK] ?? 0, depReady);

      if (['synthesize', 'commit_verified', 'pair_commit'].includes(act)) {
        stageCounter += 1;
        const preSec = 0.6;
        const mutexSec = 1.6;
        const earliestGate = agentReady + preSec;
        const mutexEnter = Math.max(earliestGate, mutexFreeAt);
        const startOffset = schedulerMode === 'rcpsp' ? Math.max(agentReady, mutexEnter - preSec) : agentReady;
        const waitSec = Math.max(0, mutexEnter - (startOffset + preSec));
        const mutexExit = mutexEnter + mutexSec;
        const endOffset = mutexExit;
        mutexFreeAt = mutexExit;

        const win = {
          node_id: nid,
          agent_id: agentK,
          action: act,
          stage: stageCounter,
          start_offset_sec: Number(startOffset.toFixed(3)),
          end_offset_sec: Number(endOffset.toFixed(3)),
          mutex_enter_sec: Number(mutexEnter.toFixed(3)),
          mutex_exit_sec: Number(mutexExit.toFixed(3)),
          wait_mutex_sec: Number(waitSec.toFixed(3)),
          pipelined_pre_positioned: schedulerMode === 'rcpsp',
          ui_state: schedulerMode === 'rcpsp' ? 'STAGED_PRE_GATE' : (waitSec > 0 ? 'WAITING_MUTEX' : 'EXECUTING'),
        };
        windows.push(win);
        mutexReservations.push({
          node_id: nid,
          agent_id: agentK,
          stage: stageCounter,
          enter_sec: win.mutex_enter_sec,
          exit_sec: win.mutex_exit_sec,
          wait_sec: win.wait_mutex_sec,
        });
        agentFreeAt[agentK] = endOffset;
        nodeEndAt[nid] = endOffset;
        n.start_offset_sec = win.start_offset_sec;
        n.end_offset_sec = win.end_offset_sec;
        n.wait_mutex_sec = win.wait_mutex_sec;
        n.ui_state = win.ui_state;
      } else {
        const dur = 1.2;
        const startOffset = agentReady;
        const endOffset = startOffset + dur;
        const win = {
          node_id: nid,
          agent_id: agentK,
          action: act,
          stage: Math.max(1, stageCounter),
          start_offset_sec: Number(startOffset.toFixed(3)),
          end_offset_sec: Number(endOffset.toFixed(3)),
          mutex_enter_sec: null,
          mutex_exit_sec: null,
          wait_mutex_sec: 0,
          pipelined_pre_positioned: schedulerMode === 'rcpsp',
          ui_state: 'EXECUTING',
        };
        windows.push(win);
        agentFreeAt[agentK] = endOffset;
        nodeEndAt[nid] = endOffset;
        n.start_offset_sec = win.start_offset_sec;
        n.end_offset_sec = win.end_offset_sec;
        n.wait_mutex_sec = 0;
        n.ui_state = 'EXECUTING';
      }

      unscheduled.splice(unscheduled.indexOf(n), 1);
    }
  }

  const makespanSec = Math.max(0, ...Object.values(nodeEndAt));
  const totalWait = windows.reduce((s, w) => s + w.wait_mutex_sec, 0);
  const totalBusy = windows.reduce((s, w) => s + (w.end_offset_sec - w.start_offset_sec - w.wait_mutex_sec), 0);
  const utilPct = makespanSec > 0 ? (totalBusy / (3 * makespanSec)) * 100 : 0;

  dag.nodes = autoLayoutDag(nodes, edges);
  dag.edges = edges;
  dag.schedule = {
    scheduler_mode: schedulerMode,
    makespan_sec: Number(makespanSec.toFixed(3)),
    mutex_wait_time_total_sec: Number(totalWait.toFixed(3)),
    mean_mutex_wait_sec: Number((totalWait / Math.max(1, mutexReservations.length)).toFixed(3)),
    agent_utilization_pct: Number(utilPct.toFixed(1)),
    mutex_violations: 0,
    windows,
    mutex_reservations: mutexReservations,
  };

  return { dag, certificates, retries };
}

function generateRuleBasedWorkflow(prompt, mode = 1) {
  const lower = String(prompt || '').toLowerCase();
  let rawDag;

  if (mode === 3 || ['feature', 'bundle', 'wireframe', 'pair_sync', 'fullstack'].some((k) => lower.includes(k))) {
    rawDag = {
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
  } else if (mode === 2 || ['stream', 'triage', 'event'].some((k) => lower.includes(k))) {
    rawDag = {
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
        { source: '3', target: '4' },
      ],
    };
  } else if (mode === 4 || mode === 5 || ['critique', 'adversarial', 'contract'].some((k) => lower.includes(k))) {
    rawDag = {
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
    rawDag = {
      reasoning:
        'Parallel 3-Agent Research & Synthesis: Agent_Alpha, Agent_Beta, and Agent_Gamma retrieve domain shards simultaneously in Wave 1, then serialize writes to the Shared Knowledge Store protected by M_shared_state.',
      nodes: [
        { id: '1', action: 'retrieve', agent: 'Agent_Alpha', target: 'Task_Spec', priority: 'fast' },
        { id: '2', action: 'retrieve', agent: 'Agent_Beta', target: 'Task_Dataset', priority: 'fast' },
        { id: '3', action: 'retrieve', agent: 'Agent_Gamma', target: 'Task_Audit', priority: 'fast' },
        { id: '4', action: 'synthesize', agent: 'Agent_Alpha', target: 'Task_Spec', complexity: 0.0, context_load: 0.0, priority: 'fast' },
        { id: '5', action: 'synthesize', agent: 'Agent_Beta', target: 'Task_Dataset', complexity: 0.0, context_load: 0.0, priority: 'fast' },
        { id: '6', action: 'synthesize', agent: 'Agent_Gamma', target: 'Task_Audit', complexity: 0.0, context_load: 0.0, priority: 'fast' },
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

  const { dag, certificates, retries } = validateAndScheduleDag(rawDag, 'rcpsp', 'strict');
  dag.model = 'multi-agent-dag-engine-v2';
  dag.shield_certificates = certificates;
  dag.write_back_retries = retries;
  return dag;
}

app.get('/api/logs', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  logBuffer.forEach((line) => res.write(`data: ${JSON.stringify({ type: 'log', line })}\n\n`));
  res.write(`data: ${JSON.stringify({ type: 'metrics', metrics: getMetricsSnapshot() })}\n\n`);
  sseClients.push(res);
  req.on('close', () => {
    sseClients = sseClients.filter((c) => c !== res);
  });
});

app.get('/api/status', (_req, res) => {
  res.json({
    ok: true,
    running: simState.running,
    metrics: getMetricsSnapshot(),
    monitoring_summary: getMonitoringSummary(),
    shield_telemetry: simState.shield_telemetry,
    closed_loop_history: simState.closed_loop_history.slice(-10),
  });
});

app.post('/api/workflow/generate', (req, res) => {
  const { prompt, mode } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ ok: false, msg: 'Prompt is required' });
  }
  appendLog(`Generating rule-based multi-agent DAG for directive: "${prompt}" (Mode ${mode || 1})`, 20, 'workflow_generator');
  const dag = generateRuleBasedWorkflow(prompt, Number(mode || 1));
  appendLog(
    `Synthesized ${dag.nodes.length}-node DAG (${dag.edges.length} edges) | RCPSP makespan=${dag.schedule.makespan_sec}s, mutex_violations=${dag.schedule.mutex_violations}`,
    20,
    'rcpsp_scheduler'
  );
  res.json({ ok: true, data: dag });
});

app.post('/api/workflow/validate', (req, res) => {
  const { nodes, edges, scheduler_mode, shield_mode } = req.body || {};
  const { dag, certificates, retries } = validateAndScheduleDag(
    { nodes: nodes || [], edges: edges || [] },
    scheduler_mode || 'rcpsp',
    shield_mode || 'strict'
  );
  if (certificates.length > 0) {
    appendLog(
      `Pre-Flight Safety Shield intercepted ${certificates.length} violation(s) and auto-repaired in ${retries} write-back iteration(s).`,
      30,
      'pre_flight_gate'
    );
  } else {
    appendLog(`Pre-Flight Safety Shield PASS: 0 violations, RCPSP makespan=${dag.schedule.makespan_sec}s.`, 20, 'pre_flight_gate');
  }
  broadcast({ type: 'metrics', metrics: getMetricsSnapshot(), monitoring_summary: getMonitoringSummary() });
  res.json({
    ok: true,
    data: {
      dag,
      certificates,
      retries,
      shield_telemetry: simState.shield_telemetry,
    },
  });
});

app.post('/api/workflow/execute-step', async (req, res) => {
  const payload = req.body || {};
  const action = String(payload.action || 'retrieve').toLowerCase();
  const rawAgent = String(payload.agent || (action.startsWith('pair_') ? 'Agent_Alpha+Agent_Beta' : 'Agent_Alpha'));
  const target = String(payload.target || (action.includes('synthesize') ? 'Shared_Artifact' : 'Task_Spec'));
  const delayMs = Number(payload.sim_delay_ms ?? 160);

  const agentsInvolved = rawAgent.includes('+')
    ? ['Agent_Alpha', 'Agent_Beta']
    : [rawAgent in simState.agents ? rawAgent : 'Agent_Alpha'];
  const isSyn = ['synthesize', 'commit_verified', 'pair_commit'].includes(action);

  for (const a of agentsInvolved) {
    simState.agents[a].phase = isSyn ? 'SYNTHESIZING' : action === 'handoff' ? 'HANDOFF' : 'RETRIEVING';
    simState.agents[a].action = action;
    simState.agents[a].target = target;
    simState.agents[a].busy_pct = Math.min(96, simState.agents[a].busy_pct + 14);
    simState.agents[a].idle_pct = 100 - simState.agents[a].busy_pct;
  }
  if (isSyn) {
    simState.shared_state_locked_by = rawAgent;
  }

  broadcast({
    type: 'action',
    action: { id: Date.now(), raw: JSON.stringify({ action, agent: rawAgent, target }), ts: new Date().toISOString() },
    metrics: getMetricsSnapshot(),
  });
  appendLog(`Executing ${action.toUpperCase()} on ${rawAgent} -> target=${target}`, 20, 'agent_orchestrator');

  await new Promise((r) => setTimeout(r, delayMs));

  for (const a of agentsInvolved) {
    simState.agents[a].phase = 'IDLE';
    simState.agents[a].tasks_completed += 1;
  }

  if (isSyn) {
    simState.shared_state_locked_by = null;
    simState.merged_count = Math.min(9, simState.merged_count + 1);
    if (target && !simState.artifacts_merged.includes(target)) {
      simState.artifacts_merged.push(target);
    }
  }

  const resultMsg = `Completed ${action} (${rawAgent} -> ${target})`;
  broadcast({
    type: 'action_result',
    result: {
      id: Date.now(),
      raw: JSON.stringify({ success: true, agent_id: rawAgent, message: resultMsg }),
      ts: new Date().toISOString(),
    },
    metrics: getMetricsSnapshot(),
  });

  const subBlocks = (payload.subsystem && Array.isArray(payload.subsystem.sub_blocks))
    ? payload.subsystem.sub_blocks
    : [
        { id: 'sb_in', label: 'In1: ContextBus', block_type: 'Inport' },
        { id: 'sb_filter', label: 'Tokenizer & Embedder', block_type: 'Filter' },
        { id: 'sb_sampler', label: 'KSampler / ModelOp', block_type: 'ModelOp' },
        { id: 'sb_verify', label: 'Schema & Gain Guard', block_type: 'Verifier' },
        { id: 'sb_out', label: 'Out1: ArtifactOut', block_type: 'Outport' },
      ];
  const subBlockTrace = subBlocks.map((sb, idx) => ({
    id: sb.id,
    label: sb.label,
    block_type: sb.block_type,
    status: 'success',
    latency_ms: Math.round((delayMs / Math.max(1, subBlocks.length)) * (idx + 1)),
  }));

  res.json({
    ok: true,
    success: true,
    agent_id: rawAgent,
    message: resultMsg,
    comfy_params: payload.comfy_params || null,
    sub_block_trace: subBlockTrace,
    metrics: getMetricsSnapshot(),
  });
});

app.post('/api/closed-loop/run', (req, res) => {
  const {
    prompt = 'Synthesize a 3-stage multi-agent research report with maximum parallelism',
    mode = 1,
    inject_overflow = true,
    inject_schema_drift = true,
  } = req.body || {};

  appendLog(`[CLOSED-LOOP] Starting Plan -> Execute -> Validate -> Learn -> Revise cycle for: "${prompt}"`, 20, 'closed_loop');

  const rawDag = generateRuleBasedWorkflow(prompt, Number(mode));
  if (inject_overflow) {
    const synNode = rawDag.nodes.find((n) => n.action === 'synthesize');
    if (synNode) {
      synNode.complexity = 0.038;
      synNode.context_load = 0.024;
    }
  }

  const { dag: validatedDag, certificates, retries } = validateAndScheduleDag(rawDag, 'rcpsp', 'strict');
  appendLog(
    `[VALIDATE] Pre-Flight Shield intercepted ${certificates.length} certificate(s) and repaired in ${retries} write-back iteration(s).`,
    certificates.length > 0 ? 30 : 20,
    'pre_flight_gate'
  );

  let finalDag = JSON.parse(JSON.stringify(validatedDag));
  let splicedNodeIds = [];
  let faultTier = 0;
  let faultClass = 'NOMINAL';
  let maxDrift = 0.8;

  if (inject_schema_drift) {
    faultTier = 1;
    faultClass = 'TIER1_SCHEMA_DRIFT';
    maxDrift = 21.4;
    const targetFailNode = finalDag.nodes.find((n) => String(n.id) === '5') || finalDag.nodes[finalDag.nodes.length - 1];
    const fid = String(targetFailNode.id);
    const targetShard = targetFailNode.target || 'Task_Dataset';
    const agent = targetFailNode.agent || 'Agent_Beta';

    const n1 = `${fid}_re_index_context`;
    const n2 = `${fid}_patch_artifact`;
    const n3 = `${fid}_commit_verified`;
    splicedNodeIds = [n1, n2, n3];

    const recNodes = [
      { id: n1, action: 're_index_context', agent, target: targetShard, complexity: 0.0, context_load: 0.0, priority: 'fast', spliced: true },
      { id: n2, action: 'patch_artifact', agent, target: targetShard, complexity: 0.0, context_load: 0.0, priority: 'fast', spliced: true },
      { id: n3, action: 'commit_verified', agent, target: targetShard, complexity: 0.0, context_load: 0.0, priority: 'fast', spliced: true },
    ];
    const recEdges = [
      { id: `e_${n1}_${n2}`, source: n1, target: n2, spliced: true },
      { id: `e_${n2}_${n3}`, source: n2, target: n3, spliced: true },
    ];

    const newEdges = [];
    for (const e of finalDag.edges) {
      if (String(e.target) === fid) {
        newEdges.push({ id: `e_${e.source}_${n1}`, source: String(e.source), target: n1, spliced: true });
      } else if (String(e.source) === fid) {
        newEdges.push({ id: `e_${n3}_${e.target}`, source: n3, target: String(e.target), spliced: true });
      } else {
        newEdges.push(e);
      }
    }
    newEdges.push(...recEdges);

    const newNodes = [];
    for (const n of finalDag.nodes) {
      if (String(n.id) === fid) {
        newNodes.push(...recNodes);
      } else {
        newNodes.push(n);
      }
    }

    const revised = validateAndScheduleDag({ nodes: newNodes, edges: newEdges }, 'rcpsp', 'strict');
    finalDag = revised.dag;
    appendLog(
      `[LEARN & REVISE] Classified ${faultClass} (${maxDrift} pts drift on node #${fid}) -> Spliced 0-token 3-node recovery subgraph [${splicedNodeIds.join(' -> ')}] and rescheduled with 0 mutex violations.`,
      20,
      'subgraph_patcher'
    );
  }

  finalDag.nodes.forEach((n) => {
    n.status = 'success';
  });

  simState.merged_count = Math.min(9, simState.merged_count + 3);
  simState.agents.Agent_Alpha.tasks_completed += 2;
  simState.agents.Agent_Beta.tasks_completed += 2;
  simState.agents.Agent_Gamma.tasks_completed += 2;
  simState.agents.Agent_Alpha.busy_pct = 74;
  simState.agents.Agent_Beta.busy_pct = 78;
  simState.agents.Agent_Gamma.busy_pct = 71;

  const skillEvo = {
    root_cause: 'Context window overflow & schema drift encountered during concurrent multi-agent synthesis; auto-repaired by Pre-Flight Shield + 3-node Subgraph Patcher.',
    severity: 'MEDIUM',
    parameter_patches: {
      schema_validation_strictness: 'strict (JSON-Schema draft-2020-12)',
      context_chunk_limit: '16k tokens',
      rcpsp_pre_gate_lead_sec: '0.55 s',
    },
    skill_evolution_rules: [
      'Enforce deterministic JSON-Schema check before releasing M_shared_state mutex.',
      'Pre-stage agents at STAGED_PRE_GATE using empirical MutexProfileStore hold times.',
    ],
    auto_applied: true,
    timestamp: Date.now() / 1000,
  };
  simState.skill_evolution_history.push(skillEvo);

  const report = {
    cycleId: `cl-${Date.now()}`,
    timestamp: Date.now() / 1000,
    closedLoopVerified: true,
    stages: {
      plan: {
        prompt,
        initialNodeCount: rawDag.nodes.length,
        initialEdgeCount: rawDag.edges.length,
      },
      validate: {
        certificatesIntercepted: certificates.length,
        certificates,
        writeBackRetries: retries,
        shieldPassedAfterRepair: true,
      },
      execute: {
        initialMakespanSec: validatedDag.schedule.makespan_sec,
        faultInjected: Boolean(inject_schema_drift),
        faultNodeId: inject_schema_drift ? '5' : null,
      },
      learn: {
        faultTier,
        faultClassification: faultClass,
        maxDriftScore: maxDrift,
        skillEvolution: skillEvo,
      },
      revise: {
        splicedNodeIds,
        recoveryLatencyMs: 2.4,
        tokensConsumedOnRecovery: 0,
        finalMakespanSec: finalDag.schedule.makespan_sec,
        finalMutexViolations: finalDag.schedule.mutex_violations,
        allNodesCompleted: true,
      },
    },
    finalDag,
  };

  simState.closed_loop_history.push(report);
  broadcast({
    type: 'closed_loop',
    report,
    metrics: getMetricsSnapshot(),
    monitoring_summary: getMonitoringSummary(),
  });

  res.json({ ok: true, data: report });
});

app.post('/api/feedback', (req, res) => {
  const { comment, category } = req.body || {};
  if (!comment) {
    return res.status(400).json({ ok: false, msg: 'Comment is required' });
  }
  const lower = String(comment).toLowerCase();
  const patches = {};
  const rules = [];
  let rootCause = 'Operator feedback integrated into continuous multi-agent guardrail registry.';

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

  const evo = {
    root_cause: rootCause,
    severity: 'MEDIUM',
    parameter_patches: patches,
    skill_evolution_rules: rules,
    auto_applied: true,
    timestamp: Date.now() / 1000,
    operator_comment: comment,
    category: category || 'general',
  };
  simState.skill_evolution_history.push(evo);
  appendLog(`[EVOLUTION] Synthesized guardrail rule: ${rootCause}`, 20, 'feedback_evolution');
  res.json({ ok: true, data: evo });
});

app.post('/api/audit', (_req, res) => {
  const summary = getMonitoringSummary();
  appendLog(`[AUDIT] Diagnostic health score: ${summary.health_score}/100 (${summary.status})`, 20, 'system_monitor');
  res.json({ ok: true, data: summary });
});

app.post('/api/reset', (_req, res) => {
  simState = createInitialState();
  appendLog('[RESET] Multi-agent workspace, active tasks, and shield counters reset.', 20, 'dag_engine');
  broadcast({ type: 'metrics', metrics: getMetricsSnapshot(), monitoring_summary: getMonitoringSummary() });
  res.json({ ok: true, metrics: getMetricsSnapshot() });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Multi-Agent DAG Studio Server] Running on http://localhost:${PORT}`);
  });
}

module.exports = { app, generateRuleBasedWorkflow, validateAndScheduleDag };
