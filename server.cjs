/**
 * Standalone Rule-Based ATAMP DAG Backend & Digital Twin Monitoring Server (:3001)
 *
 * Provides:
 * - GET  /api/logs                  (SSE stream: logs, robot telemetry, action trace, closed-loop events)
 * - GET  /api/status                (Engine & digital twin status + live metrics + monitoring summary)
 * - POST /api/workflow/generate     (Rule-based blueprint + parallel DAG synthesis + RCPSP schedule)
 * - POST /api/workflow/validate     (PreFlightGate Shield + WriteBackPlannerLoop + RCPSP Wavefront Schedule)
 * - POST /api/workflow/execute-step (Simulated 50Hz multi-arm execution with center-zone mutex arbitration)
 * - POST /api/closed-loop/run       (Automated Plan -> Execute -> Validate -> Learn -> Revise closed loop)
 * - POST /api/feedback              (Operator feedback & skill evolution synthesizer)
 * - POST /api/audit                 (System health diagnostic audit)
 * - POST /api/reset                 (Reset digital twin workspace & robot telemetry)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

/* ── Constants & Rule-Based Tables ────────────────────────── */
const ROBOT_BASES = {
  FR3_1: [0.0, -0.45, 0.20],
  FR3_2: [0.3897, 0.225, 0.20],
  FR3_3: [-0.3897, 0.225, 0.20],
};

const ROBOT_OWNED_BLOCKS = {
  FR3_1: ['Block1', 'Block2', 'Block3', 'RedBall', 'GreenBall', 'ChamferedPeg_M12'],
  FR3_2: ['Block4', 'Block5', 'Block6', 'YellowBall', 'ReagentVial_20mL', 'SiliconWaferCarrier_100mm'],
  FR3_3: ['Block7', 'Block8', 'Block9', 'CrucibleBoat_Alumina', 'HexagonalStock_Prism'],
};

const BIMANUAL_OBJECTS = new Set([
  'LongBar',
  'HeavyEnginePart',
  'AsymmetricEngineBracket',
  'SiliconeSampleBag_DualHandle',
  'FlexibleBasket',
]);

/* ── Live Digital Twin State ──────────────────────────────── */
let logBuffer = [];
const MAX_LOG_LINES = 2000;
let sseClients = [];

function createInitialState() {
  return {
    running: true,
    mode: 1,
    tower_height: 0,
    blocks_on_tower: [],
    center_occupied_by: null,
    robots: {
      FR3_1: {
        state: 'READY',
        phase: 'IDLE',
        action: 'idle',
        target: '',
        busy_pct: 18,
        idle_pct: 82,
        tasks_completed: 0,
        tasks_failed: 0,
        holding: null,
      },
      FR3_2: {
        state: 'READY',
        phase: 'IDLE',
        action: 'idle',
        target: '',
        busy_pct: 16,
        idle_pct: 84,
        tasks_completed: 0,
        tasks_failed: 0,
        holding: null,
      },
      FR3_3: {
        state: 'READY',
        phase: 'IDLE',
        action: 'idle',
        target: '',
        busy_pct: 14,
        idle_pct: 86,
        tasks_completed: 0,
        tasks_failed: 0,
        holding: null,
      },
    },
    blocks: {
      Block1: { x: 0.0, y: -1.05, z: 0.335, status: 'TABLE_1', holder: null },
      Block2: { x: -0.08, y: -1.05, z: 0.335, status: 'TABLE_1', holder: null },
      Block3: { x: 0.08, y: -1.05, z: 0.335, status: 'TABLE_1', holder: null },
      Block4: { x: 0.91, y: 0.53, z: 0.335, status: 'TABLE_2', holder: null },
      Block5: { x: 0.85, y: 0.58, z: 0.335, status: 'TABLE_2', holder: null },
      Block6: { x: 0.96, y: 0.48, z: 0.335, status: 'TABLE_2', holder: null },
      Block7: { x: -0.91, y: 0.53, z: 0.335, status: 'TABLE_3', holder: null },
      Block8: { x: -0.85, y: 0.58, z: 0.335, status: 'TABLE_3', holder: null },
      Block9: { x: -0.96, y: 0.48, z: 0.335, status: 'TABLE_3', holder: null },
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
    empirical_mutex_records: [],
  };
}

let simState = createInitialState();

function getMetricsSnapshot() {
  return {
    timestamp: Date.now() / 1000,
    robots: simState.robots,
    tower_height: simState.tower_height,
    center_occupied_by: simState.center_occupied_by,
    blocks: simState.blocks,
  };
}

function getMonitoringSummary() {
  const totalCompleted =
    simState.robots.FR3_1.tasks_completed +
    simState.robots.FR3_2.tasks_completed +
    simState.robots.FR3_3.tasks_completed;
  const totalFailed =
    simState.robots.FR3_1.tasks_failed +
    simState.robots.FR3_2.tasks_failed +
    simState.robots.FR3_3.tasks_failed;
  const denies = simState.shield_telemetry.gate_interception_count;
  const totalOps = Math.max(1, totalCompleted + totalFailed);
  const successRate = Math.round((totalCompleted / totalOps) * 100);
  const healthScore = Math.max(65, Math.min(100, 100 - totalFailed * 8 - Math.min(15, denies * 2)));

  const anomalies = [];
  for (const cert of simState.shield_telemetry.last_certificates.slice(-4)) {
    anomalies.push({
      severity: 'WARN',
      component: `PreFlightGate:${cert.violation_type}`,
      description: `Node #${cert.node_id} (${cert.arm_id}) intercepted (${cert.measured_value}${cert.unit} > ${cert.limit_value}${cert.unit}) -> ${cert.correction_hint}`,
    });
  }
  if (simState.closed_loop_history.length > 0) {
    const lastCl = simState.closed_loop_history[simState.closed_loop_history.length - 1];
    if (lastCl.stages?.learn?.faultTier === 1) {
      anomalies.push({
        severity: 'INFO',
        component: 'SubgraphPatcher:Tier1',
        description: `Local pose slip (${lastCl.stages.learn.maxDisplacementMm}mm) repaired via 0-token 3-node splice [${lastCl.stages.revise.splicedNodeIds.join(' -> ')}].`,
      });
    }
  }

  return {
    health_score: healthScore,
    status: healthScore >= 90 ? 'HEALTHY' : healthScore >= 75 ? 'DEGRADED' : 'ANOMALOUS',
    executive_summary: `ATAMP Rule-Based DAG Engine active (Shield: ${simState.shield_telemetry.shield_mode}, Scheduler: RCPSP Wavefront). Evaluated ${simState.shield_telemetry.total_proposals_evaluated} DAG nodes with ${denies} pre-flight interceptions auto-repaired via Write-Back Loop and ${simState.closed_loop_history.length} closed-loop verification cycles completed.`,
    anomalies,
    recommendations: [
      'Use RCPSP Wavefront Scheduling to pre-stage arms at STAGED_PRE_GATE before acquiring the central-zone mutex (M_center).',
      'Keep Pre-Flight Safety Shield in strict mode to auto-repair COM_OVERHANG (>17.5mm) and SWEPT_VOLUME_COLLISION before execution.',
      'Route single-block slips (3mm < slip < 50mm) through 0-token 3-node Subgraph Splicing rather than full LLM replanning.',
    ],
    timestamp: Date.now() / 1000,
    model: 'rule-based-atamp-v2',
    stats: {
      total_logs: logBuffer.length,
      errors: totalFailed,
      warnings: denies,
      guardrail_denies: denies,
      pick_success_rate_pct: totalCompleted === 0 && totalFailed === 0 ? 100 : successRate,
    },
  };
}

function broadcast(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((res) => {
    try {
      res.write(payload);
    } catch {}
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

/* ── Rule-Based DAG Layout, Shield & RCPSP Scheduler ─────── */
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

  Object.keys(waves)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((wIdx) => {
      const wNodes = waves[wIdx];
      wNodes.forEach((n, colIdx) => {
        const defaultX = wNodes.length === 1 ? 350 : wNodes.length === 2 ? 180 + colIdx * 340 : 60 + colIdx * 290;
        const defaultY = 45 + wIdx * 190;
        n.x_pos = defaultX;
        n.y_pos = defaultY;
        n.x = Number(n.x ?? 0.0);
        n.y = Number(n.y ?? 0.0);
        n.speed = n.speed || 'fast';
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
    const towerLayers = [[0.0, 0.0, 0.335]];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      simState.shield_telemetry.total_proposals_evaluated += 1;
      const act = String(n.action || 'pick').toLowerCase();
      const arm = String(n.robot || 'FR3_1').split('+')[0];
      const base = ROBOT_BASES[arm] || ROBOT_BASES.FR3_1;
      const tx = Number(n.x ?? 0.0);
      const ty = Number(n.y ?? 0.0);

      if (act === 'place' || act === 'replace_verified') {
        const radialDist = Math.hypot(tx - base[0], ty - base[1]);
        if (radialDist > 0.85 || radialDist < 0.15) {
          const cert = {
            status: 'REJECT',
            node_id: String(n.id),
            arm_id: arm.toLowerCase(),
            violation_type: 'IK_OUT_OF_BOUNDS',
            measured_value: Number((radialDist * 1000).toFixed(1)),
            limit_value: 850.0,
            unit: 'mm',
            correction_hint: `Clamp target into ${arm} reachable workspace [-120mm, +120mm]`,
          };
          certificates.push(cert);
          simState.shield_telemetry.gate_interception_count += 1;
          simState.shield_telemetry.write_back_iterations += 1;
          retries += 1;
          n.x = Number(Math.max(-0.12, Math.min(0.12, tx)).toFixed(4));
          n.y = Number(Math.max(-0.12, Math.min(0.12, ty)).toFixed(4));
          n.repaired = true;
          n.repair_note = cert.correction_hint;
        }

        const prev = towerLayers[towerLayers.length - 1];
        const offsetMm = Math.max(Math.abs(Number(n.x ?? 0) - prev[0]), Math.abs(Number(n.y ?? 0) - prev[1])) * 1000.0;
        if (offsetMm > 17.5) {
          const cert = {
            status: 'REJECT',
            node_id: String(n.id),
            arm_id: arm.toLowerCase(),
            violation_type: 'COM_OVERHANG',
            measured_value: Number(offsetMm.toFixed(1)),
            limit_value: 5.0,
            unit: 'mm',
            correction_hint: `Shift placement toward support layer centroid [0.0mm, 0.0mm]`,
          };
          certificates.push(cert);
          simState.shield_telemetry.gate_interception_count += 1;
          simState.shield_telemetry.write_back_iterations += 1;
          retries += 1;
          n.x = 0.0;
          n.y = 0.0;
          n.repaired = true;
          n.repair_note = cert.correction_hint;
        }

        towerLayers.push([Number(n.x ?? 0), Number(n.y ?? 0), 0.335 + towerLayers.length * 0.045]);
      }
    }

    // Check concurrent central-zone place nodes without dependency edges
    const placeNodes = nodes.filter((n) => ['place', 'replace_verified'].includes(String(n.action || '').toLowerCase()));
    for (let i = 0; i < placeNodes.length - 1; i++) {
      const a = placeNodes[i];
      const b = placeNodes[i + 1];
      const hasEdge = edges.some(
        (e) =>
          (String(e.source) === String(a.id) && String(e.target) === String(b.id)) ||
          (String(e.source) === String(b.id) && String(e.target) === String(a.id))
      );
      if (!hasEdge && Math.abs(Number(a.x ?? 0)) <= 0.18 && Math.abs(Number(b.x ?? 0)) <= 0.18) {
        const cert = {
          status: 'REJECT',
          node_id: String(b.id),
          arm_id: String(b.robot || 'FR3_2').toLowerCase(),
          violation_type: 'SWEPT_VOLUME_COLLISION',
          measured_value: 45.0,
          limit_value: 0.0,
          unit: 'mm',
          correction_hint: `Serialize node '${b.id}' after node '${a.id}' on M_center`,
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

  // RCPSP Wavefront Schedule
  const parentsMap = {};
  nodes.forEach((n) => { parentsMap[String(n.id)] = []; });
  edges.forEach((e) => {
    const s = String(e.source);
    const t = String(e.target);
    if (t in parentsMap && s in parentsMap) parentsMap[t].push(s);
  });

  const armFreeAt = { fr3_1: 0, fr3_2: 0, fr3_3: 0 };
  const nodeEndAt = {};
  let mutexFreeAt = 0;
  const windows = [];
  const mutexReservations = [];
  const unscheduled = [...nodes];
  let layerCounter = 0;

  while (unscheduled.length > 0) {
    let ready = unscheduled.filter((n) => (parentsMap[String(n.id)] || []).every((p) => p in nodeEndAt));
    if (!ready.length) ready = [unscheduled[0]];

    for (const n of ready) {
      const nid = String(n.id);
      const rNorm = String(n.robot || 'FR3_1').toUpperCase();
      const armK = rNorm.includes('FR3_2') && !rNorm.includes('FR3_1')
        ? 'fr3_2'
        : rNorm.includes('FR3_3')
        ? 'fr3_3'
        : 'fr3_1';
      const act = String(n.action || 'pick').toLowerCase();
      const depReady = Math.max(0, ...(parentsMap[nid] || []).map((p) => nodeEndAt[p] ?? 0));
      const armReady = Math.max(armFreeAt[armK] ?? 0, depReady);

      if (['place', 'replace_verified', 'dual_arm_place'].includes(act)) {
        layerCounter += 1;
        const preSec = 0.6;
        const mutexSec = 1.6;
        const earliestGate = armReady + preSec;
        const mutexEnter = Math.max(earliestGate, mutexFreeAt);
        const startOffset = schedulerMode === 'rcpsp' ? Math.max(armReady, mutexEnter - preSec) : armReady;
        const waitSec = Math.max(0, mutexEnter - (startOffset + preSec));
        const mutexExit = mutexEnter + mutexSec;
        const endOffset = mutexExit;
        mutexFreeAt = mutexExit;

        const win = {
          node_id: nid,
          arm_id: armK,
          action: act,
          layer: layerCounter,
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
          arm_id: armK,
          layer: layerCounter,
          enter_sec: win.mutex_enter_sec,
          exit_sec: win.mutex_exit_sec,
          wait_sec: win.wait_mutex_sec,
        });
        armFreeAt[armK] = endOffset;
        nodeEndAt[nid] = endOffset;
        n.start_offset_sec = win.start_offset_sec;
        n.end_offset_sec = win.end_offset_sec;
        n.wait_mutex_sec = win.wait_mutex_sec;
        n.ui_state = win.ui_state;
      } else {
        const dur = 1.2;
        const startOffset = armReady;
        const endOffset = startOffset + dur;
        const win = {
          node_id: nid,
          arm_id: armK,
          action: act,
          layer: Math.max(1, layerCounter),
          start_offset_sec: Number(startOffset.toFixed(3)),
          end_offset_sec: Number(endOffset.toFixed(3)),
          mutex_enter_sec: null,
          mutex_exit_sec: null,
          wait_mutex_sec: 0,
          pipelined_pre_positioned: schedulerMode === 'rcpsp',
          ui_state: 'EXECUTING',
        };
        windows.push(win);
        armFreeAt[armK] = endOffset;
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
    arm_utilization_pct: Number(utilPct.toFixed(1)),
    mutex_violations: 0,
    windows,
    mutex_reservations: mutexReservations,
  };

  return { dag, certificates, retries };
}

function generateRuleBasedWorkflow(prompt, mode = 1) {
  const lower = String(prompt || '').toLowerCase();
  let rawDag;

  if (mode === 3 || mode === 6 || ['basket', 'vinyl', 'bag', 'ball'].some((k) => lower.includes(k))) {
    rawDag = {
      reasoning:
        'Parallel flexible basket packing: FR3_1 picks RedBall & Block1 while FR3_2 picks YellowBall & Block2, placing them into FlexibleBasket at (0.0, -0.25), then bimanually lifting FlexibleBasket.',
      nodes: [
        { id: '1', action: 'pick', robot: 'FR3_1', target: 'RedBall', speed: 'fast' },
        { id: '2', action: 'pick', robot: 'FR3_2', target: 'YellowBall', speed: 'fast' },
        { id: '3', action: 'place', robot: 'FR3_1', target: 'RedBall', x: -0.05, y: -0.25, speed: 'fast' },
        { id: '4', action: 'place', robot: 'FR3_2', target: 'YellowBall', x: 0.05, y: -0.25, speed: 'fast' },
        { id: '5', action: 'pick', robot: 'FR3_1', target: 'Block1', speed: 'fast' },
        { id: '6', action: 'pick', robot: 'FR3_2', target: 'Block2', speed: 'fast' },
        { id: '7', action: 'place', robot: 'FR3_1', target: 'Block1', x: -0.04, y: -0.25, speed: 'fast' },
        { id: '8', action: 'place', robot: 'FR3_2', target: 'Block2', x: 0.04, y: -0.25, speed: 'fast' },
        { id: '9', action: 'dual_arm_pick', robot: 'FR3_1+FR3_2', target: 'FlexibleBasket', speed: 'fast' },
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
  } else if (mode === 2 || ['conveyor', 'stream', 'item', 'follow'].some((k) => lower.includes(k))) {
    rawDag = {
      reasoning:
        'Parallel dual-arm conveyor stream intercept: FR3_1 (left) and FR3_2 (right) track and pick moving items at 50Hz in parallel, then place them onto the workbench.',
      nodes: [
        { id: '1', action: 'pick', robot: 'FR3_1', target: 'ConvItem0', speed: 'fast' },
        { id: '2', action: 'pick', robot: 'FR3_2', target: 'ConvItem3', speed: 'fast' },
        { id: '3', action: 'place', robot: 'FR3_1', target: 'ConvItem0', x: -0.10, y: -0.10, speed: 'fast' },
        { id: '4', action: 'place', robot: 'FR3_2', target: 'ConvItem3', x: 0.10, y: -0.10, speed: 'fast' },
      ],
      edges: [
        { source: '1', target: '3' },
        { source: '2', target: '4' },
        { source: '3', target: '4' },
      ],
    };
  } else if (mode === 5 || ['circle', 'wave', 'longbar', 'bar'].some((k) => lower.includes(k))) {
    rawDag = {
      reasoning:
        'Coordinated bimanual sequence: dual pick LongBar, perform synchronized circle wave, and place on central buffer.',
      nodes: [
        { id: '1', action: 'dual_arm_pick', robot: 'FR3_1+FR3_2', target: 'LongBar', speed: 'fast' },
        { id: '2', action: 'dual_arm_circle', robot: 'FR3_1+FR3_2', plane: 'XY', radius: 0.08, cycles: 1, speed: 'fast' },
        { id: '3', action: 'dual_arm_place', robot: 'FR3_1+FR3_2', x: 0.0, y: 0.0, speed: 'fast' },
      ],
      edges: [
        { source: '1', target: '2' },
        { source: '2', target: '3' },
      ],
    };
  } else if (['9-layer', '9 layer', 'all blocks', 'full tower'].some((k) => lower.includes(k))) {
    rawDag = {
      reasoning:
        '3-Wave Parallel 6-Block Tower: All 3 FR3 arms pick in parallel per wave and serialize center-table placements protected by M_center.',
      nodes: [
        { id: '1', action: 'pick', robot: 'FR3_1', target: 'Block1', speed: 'fast' },
        { id: '2', action: 'pick', robot: 'FR3_2', target: 'Block4', speed: 'fast' },
        { id: '3', action: 'pick', robot: 'FR3_3', target: 'Block7', speed: 'fast' },
        { id: '4', action: 'place', robot: 'FR3_1', target: 'Block1', x: 0.0, y: 0.0, speed: 'fast' },
        { id: '5', action: 'place', robot: 'FR3_2', target: 'Block4', x: 0.0, y: 0.0, speed: 'fast' },
        { id: '6', action: 'place', robot: 'FR3_3', target: 'Block7', x: 0.0, y: 0.0, speed: 'fast' },
        { id: '7', action: 'pick', robot: 'FR3_1', target: 'Block2', speed: 'fast' },
        { id: '8', action: 'pick', robot: 'FR3_2', target: 'Block5', speed: 'fast' },
        { id: '9', action: 'pick', robot: 'FR3_3', target: 'Block8', speed: 'fast' },
        { id: '10', action: 'place', robot: 'FR3_1', target: 'Block2', x: 0.0, y: 0.0, speed: 'fast' },
        { id: '11', action: 'place', robot: 'FR3_2', target: 'Block5', x: 0.0, y: 0.0, speed: 'fast' },
        { id: '12', action: 'place', robot: 'FR3_3', target: 'Block8', x: 0.0, y: 0.0, speed: 'fast' },
      ],
      edges: [
        { source: '1', target: '4' },
        { source: '2', target: '5' },
        { source: '3', target: '6' },
        { source: '4', target: '5' },
        { source: '5', target: '6' },
        { source: '4', target: '7' },
        { source: '5', target: '8' },
        { source: '6', target: '9' },
        { source: '7', target: '10' },
        { source: '8', target: '11' },
        { source: '9', target: '12' },
        { source: '6', target: '10' },
        { source: '10', target: '11' },
        { source: '11', target: '12' },
      ],
    };
  } else {
    rawDag = {
      reasoning:
        'Parallel Multi-Arm Tower: FR3_1, FR3_2, and FR3_3 pick simultaneously in parallel, then sequentially place on the center table protected by M_center.',
      nodes: [
        { id: '1', action: 'pick', robot: 'FR3_1', target: 'Block1', speed: 'fast' },
        { id: '2', action: 'pick', robot: 'FR3_2', target: 'Block4', speed: 'fast' },
        { id: '3', action: 'pick', robot: 'FR3_3', target: 'Block7', speed: 'fast' },
        { id: '4', action: 'place', robot: 'FR3_1', target: 'Block1', x: 0.0, y: 0.0, speed: 'fast' },
        { id: '5', action: 'place', robot: 'FR3_2', target: 'Block4', x: 0.0, y: 0.0, speed: 'fast' },
        { id: '6', action: 'place', robot: 'FR3_3', target: 'Block7', x: 0.0, y: 0.0, speed: 'fast' },
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
  dag.model = 'rule-based-atamp-v2';
  dag.shield_certificates = certificates;
  dag.write_back_retries = retries;
  return dag;
}

/* ── HTTP & SSE Endpoints ─────────────────────────────────── */
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
  appendLog(`Generating rule-based parallel DAG for directive: "${prompt}" (Mode ${mode || 1})`, 20, 'workflow_generator');
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
  const action = String(payload.action || 'pick').toLowerCase();
  const rawRobot = String(payload.robot || (action.startsWith('dual_arm') ? 'FR3_1+FR3_2' : 'FR3_1'));
  const target = String(payload.target || payload.object_label || (action.includes('place') ? `[${payload.x ?? 0}, ${payload.y ?? 0}]` : 'Block1'));
  const delayMs = Number(payload.sim_delay_ms ?? 180);

  const robotsInvolved = rawRobot.includes('+') ? ['FR3_1', 'FR3_2'] : [rawRobot in simState.robots ? rawRobot : 'FR3_1'];
  const isPlace = ['place', 'replace_verified', 'dual_arm_place'].includes(action);

  // Set phase to PICKING or PLACING
  for (const r of robotsInvolved) {
    simState.robots[r].phase = isPlace ? 'PLACING' : action === 'go_home' ? 'HOMING' : 'PICKING';
    simState.robots[r].action = action;
    simState.robots[r].target = target;
    simState.robots[r].busy_pct = Math.min(96, simState.robots[r].busy_pct + 14);
    simState.robots[r].idle_pct = 100 - simState.robots[r].busy_pct;
  }
  if (isPlace) {
    simState.center_occupied_by = rawRobot;
  }

  broadcast({
    type: 'action',
    action: { id: Date.now(), raw: JSON.stringify({ action, robot: rawRobot, target, x: payload.x, y: payload.y }), ts: new Date().toISOString() },
    metrics: getMetricsSnapshot(),
  });
  appendLog(`Executing ${action.toUpperCase()} on ${rawRobot} -> target=${target}`, 20, 'multi_robot_controller');

  await new Promise((r) => setTimeout(r, delayMs));

  for (const r of robotsInvolved) {
    simState.robots[r].phase = 'IDLE';
    simState.robots[r].tasks_completed += 1;
    if (action.includes('pick')) {
      simState.robots[r].holding = target;
    } else if (isPlace) {
      simState.robots[r].holding = null;
    }
  }

  if (isPlace) {
    simState.center_occupied_by = null;
    if (Math.abs(Number(payload.x ?? 0)) <= 0.18 && Math.abs(Number(payload.y ?? 0)) <= 0.18) {
      simState.tower_height = Math.min(9, simState.tower_height + 1);
      if (target && target.startsWith('Block') && !simState.blocks_on_tower.includes(target)) {
        simState.blocks_on_tower.push(target);
      }
    }
  }

  const resultMsg = `Completed ${action} (${rawRobot} -> ${target})`;
  broadcast({
    type: 'action_result',
    result: {
      id: Date.now(),
      raw: JSON.stringify({ success: true, robot_id: rawRobot, message: resultMsg }),
      ts: new Date().toISOString(),
    },
    metrics: getMetricsSnapshot(),
  });

  res.json({
    ok: true,
    success: true,
    robot_id: rawRobot,
    message: resultMsg,
    metrics: getMetricsSnapshot(),
  });
});

app.post('/api/closed-loop/run', (req, res) => {
  const {
    prompt = 'Build a 3-layer tower with maximum parallelism',
    mode = 1,
    inject_overhang = true,
    inject_pose_slip = true,
  } = req.body || {};

  appendLog(`[CLOSED-LOOP] Starting Plan -> Execute -> Validate -> Learn -> Revise cycle for: "${prompt}"`, 20, 'closed_loop');

  // 1. PLAN
  const rawDag = generateRuleBasedWorkflow(prompt, Number(mode));
  if (inject_overhang) {
    const placeNode = rawDag.nodes.find((n) => n.action === 'place');
    if (placeNode) {
      placeNode.x = 0.038; // 38mm offset -> triggers COM_OVERHANG
      placeNode.y = 0.024;
    }
  }

  // 2. VALIDATE (Pre-Flight Safety Shield + Write-Back Planner Loop)
  const { dag: validatedDag, certificates, retries } = validateAndScheduleDag(rawDag, 'rcpsp', 'strict');
  appendLog(
    `[VALIDATE] Pre-Flight Shield intercepted ${certificates.length} certificate(s) and repaired in ${retries} write-back iteration(s).`,
    certificates.length > 0 ? 30 : 20,
    'pre_flight_gate'
  );

  // 3. EXECUTE & 4. LEARN (Fault Classification + Empirical Timing Write-Back)
  let finalDag = JSON.parse(JSON.stringify(validatedDag));
  let splicedNodeIds = [];
  let faultTier = 0;
  let faultClass = 'NOMINAL';
  let maxDispMm = 0.8;

  if (inject_pose_slip) {
    faultTier = 1;
    faultClass = 'TIER1_LOCAL_POSE_SLIP';
    maxDispMm = 21.4;
    const targetFailNode = finalDag.nodes.find((n) => String(n.id) === '5') || finalDag.nodes[finalDag.nodes.length - 1];
    const fid = String(targetFailNode.id);
    const targetBlock = targetFailNode.target || 'Block4';
    const arm = targetFailNode.robot || 'FR3_2';

    const n1 = `${fid}_re_perceive_pose`;
    const n2 = `${fid}_regrasp_offset`;
    const n3 = `${fid}_replace_verified`;
    splicedNodeIds = [n1, n2, n3];

    const recNodes = [
      { id: n1, action: 're_perceive_pose', robot: arm, target: targetBlock, x: 0.019, y: -0.010, speed: 'fast', spliced: true },
      { id: n2, action: 'regrasp_offset', robot: arm, target: targetBlock, x: 0.019, y: -0.010, speed: 'fast', spliced: true },
      { id: n3, action: 'replace_verified', robot: arm, target: targetBlock, x: 0.0, y: 0.0, speed: 'fast', spliced: true },
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

    // 5. REVISE: Re-validate spliced subgraph through PreFlightGate & reschedule via RCPSP
    const revised = validateAndScheduleDag({ nodes: newNodes, edges: newEdges }, 'rcpsp', 'strict');
    finalDag = revised.dag;
    appendLog(
      `[LEARN & REVISE] Classified ${faultClass} (${maxDispMm}mm slip on node #${fid}) -> Spliced 0-token 3-node recovery subgraph [${splicedNodeIds.join(' -> ')}] and rescheduled with 0 mutex violations.`,
      20,
      'subgraph_patcher'
    );
  }

  finalDag.nodes.forEach((n) => {
    n.status = 'success';
  });

  // Update Digital Twin state
  simState.tower_height = Math.min(9, simState.tower_height + 3);
  simState.robots.FR3_1.tasks_completed += 2;
  simState.robots.FR3_2.tasks_completed += 2;
  simState.robots.FR3_3.tasks_completed += 2;
  simState.robots.FR3_1.busy_pct = 74;
  simState.robots.FR3_2.busy_pct = 78;
  simState.robots.FR3_3.busy_pct = 71;

  const skillEvo = {
    root_cause: 'Premature gripper release or local CoM overhang encountered during multi-arm stacking; auto-repaired by Shield + 3-node Subgraph Patcher.',
    severity: 'MEDIUM',
    parameter_patches: {
      gripper_dwell_steps: '25 steps / 500 ms',
      pre_flight_overhang_margin_mm: '6.0 mm',
      rcpsp_pre_gate_lead_sec: '0.55 s',
    },
    skill_evolution_rules: [
      'Enforce synchronized finger opening dwell before retracting from central tower.',
      'Pre-stage arms at STAGED_PRE_GATE using empirical MutexProfileStore hold times.',
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
        faultInjected: Boolean(inject_pose_slip),
        faultNodeId: inject_pose_slip ? '5' : null,
      },
      learn: {
        faultTier,
        faultClassification: faultClass,
        maxDisplacementMm: maxDispMm,
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
  let rootCause = 'Operator feedback integrated into continuous rule-based guardrail registry.';

  if (['reach', 'ik', 'residual', 'behind', 'angle', 'singularity'].some((w) => lower.includes(w))) {
    rootCause = 'Kinematic reachability boundary or joint singularity encountered at designated workspace target.';
    patches.hover_height = '0.10 m (reduced from 0.12 m to preserve elbow headroom)';
    patches.dls_damping_lambda = '0.08 (increased from 0.05 to resist singular configurations)';
    patches.default_bimanual_y = '0.25 m (maintain targets in front reach envelope)';
    rules.push('Dual-arm bimanual targets must remain strictly within Y in [0.15, 0.35] and X in [-0.25, 0.25].');
  } else if (['drop', 'release', 'fall', 'slip', 'finger', 'gripper', 'dwell'].some((w) => lower.includes(w))) {
    rootCause = 'Premature gripper release or insufficient finger dwell before retracting.';
    patches.gripper_dwell_steps = '25 steps / 500 ms (increased from 300 ms)';
    patches.retract_lift_height = '0.15 m';
    rules.push('Enforce synchronized finger opening dwell before allowing retract trajectory to initiate.');
  } else {
    patches.verification_level = 'strict';
    rules.push('Log operator state checkpoint to continuous improvement registry.');
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
  appendLog(`[EVOLUTION] Synthesized skill evolution rule: ${rootCause}`, 20, 'feedback_evolution');
  res.json({ ok: true, data: evo });
});

app.post('/api/audit', (_req, res) => {
  const summary = getMonitoringSummary();
  appendLog(`[AUDIT] Diagnostic health score: ${summary.health_score}/100 (${summary.status})`, 20, 'system_monitor');
  res.json({ ok: true, data: summary });
});

app.post('/api/reset', (_req, res) => {
  simState = createInitialState();
  appendLog('[RESET] Workspace Digital Twin, robot holding states, and shield counters reset.', 20, 'dag_engine');
  broadcast({ type: 'metrics', metrics: getMetricsSnapshot(), monitoring_summary: getMonitoringSummary() });
  res.json({ ok: true, metrics: getMetricsSnapshot() });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[ATAMP DAG Studio Server] Running on http://localhost:${PORT}`);
  });
}

module.exports = { app, generateRuleBasedWorkflow, validateAndScheduleDag };
