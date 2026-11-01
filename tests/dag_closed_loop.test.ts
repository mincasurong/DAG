import { describe, test, expect } from "bun:test";
import {
  RuleBasedTaskGenerator,
  RuleBasedTaskVerifier,
  PreFlightGate,
  WriteBackPlannerLoop,
  ContentionAwareWavefrontScheduler,
  FaultClassifier,
  SubgraphPatcher,
  FeedbackEvolutionEngine,
  ClosedLoopOrchestrator,
} from "../src/engine/ruleEngine";

describe("1. Plan Stage — Multi-Agent Rule-Based Task Generator & Auto-Layout DAG", () => {
  test("generates parallel 3-agent research & synthesis DAG with topological wave layout", () => {
    const gen = new RuleBasedTaskGenerator();
    const wf = gen.generateWorkflow("Synthesize a 3-stage multi-agent research report with maximum parallelism", 1);
    expect(wf.nodes.length).toBe(6);
    expect(wf.edges.length).toBe(5);
    const retrieves = wf.nodes.filter((n) => n.action === "retrieve");
    expect(retrieves.length).toBe(3);
    expect(new Set(retrieves.map((p) => p.agent))).toEqual(new Set(["Agent_Alpha", "Agent_Beta", "Agent_Gamma"]));
    expect(retrieves.every((p) => p.y_pos === 45)).toBe(true);
  });

  test("generates full-stack pipeline and event stream triage workflows", () => {
    const gen = new RuleBasedTaskGenerator();
    const pipeline = gen.generateWorkflow("Build full-stack feature bundle and run collaborative pair_sync", 3);
    expect(pipeline.nodes.length).toBe(9);
    expect(pipeline.nodes[8].action).toBe("pair_sync");
    expect(pipeline.nodes[8].agent).toBe("Agent_Alpha+Agent_Beta");

    const stream = gen.generateWorkflow("Triage real-time event stream batches in parallel", 2);
    expect(stream.nodes.length).toBe(4);
    expect(stream.edges.length).toBe(2);
  });

  test("generates grounded blueprint for multi-agent synthesis, stream triage, and enterprise compliance pipeline", () => {
    const [synData, synText] = RuleBasedTaskGenerator.generateBlueprint(
      { artifacts_merged: ["Task_Spec", "Task_Dataset"] },
      "Synthesize multi-agent report"
    );
    expect(synData.task_type).toBe("multi_agent_synthesis");
    expect(synData.merged_artifact_count).toBe(2);
    expect(synText).toContain("Merged Artifacts: 2/9");

    const [secData, secText] = RuleBasedTaskGenerator.generateBlueprint(
      null,
      "Audit PII_Compliance_Shard in Z4_Security_Sandbox"
    );
    expect(secData.task_type).toBe("enterprise_compliance_pipeline");
    expect(secText).toContain("Z4_Security_Sandbox");
  });
});

describe("2. Validate Stage — Multi-Agent Rule-Based Verifier & Pre-Flight Safety Shield", () => {
  test("RuleBasedTaskVerifier auto-promotes collaborative pair tasks and enforces compliance guardrails", () => {
    const verifier = new RuleBasedTaskVerifier();
    const [ok1, san1, msg1] = verifier.verifyAction(
      "retrieve",
      { agent: "Agent_Alpha", target: "SharedSchemaContract" },
      null,
      "align schema"
    );
    expect(ok1).toBe(true);
    expect(san1.action).toBe("pair_sync");
    expect(msg1).toContain("Promoted single-agent task");

    verifier.reset();
    const [okRisk, , msgRisk] = verifier.verifyAction(
      "retrieve",
      { agent: "Agent_Beta", target: "PII_Compliance_Shard", drift_score: 0.35 },
      null,
      "compliance"
    );
    expect(okRisk).toBe(false);
    expect(msgRisk).toContain("Compliance Safety Gate");

    const [okSlow, sanSlow] = verifier.verifyAction(
      "retrieve",
      { agent: "Agent_Beta", target: "PII_Compliance_Shard", drift_score: 0.05, token_temp: 0.2 },
      null,
      "compliance"
    );
    expect(okSlow).toBe(true);
    expect(sanSlow.priority).toBe("careful");
  });

  test("PreFlightGate + WriteBackPlannerLoop intercepts TOKEN_BUDGET_OVERFLOW, CAPABILITY_SCOPE_MISMATCH, and SHARED_STATE_WRITE_CONFLICT without mutating input", () => {
    const gate = new PreFlightGate("strict");
    const loop = new WriteBackPlannerLoop(gate, 3);

    const badDag = {
      nodes: [
        { id: "1", agent: "Agent_Alpha", action: "synthesize", complexity: 0.038, context_load: 0.0 },
        { id: "2", agent: "Agent_Beta", action: "synthesize", complexity: 1.45, context_load: 1.45 },
        { id: "3", agent: "Agent_Gamma", action: "synthesize", complexity: 0.0, context_load: 0.0 },
      ],
      edges: [],
    };
    const originalSnapshot = JSON.stringify(badDag);

    const [repairedDag, certs, retries] = loop.validateAndRepairDag(badDag, [[0.0, 0.0, 0.335]]);
    expect(JSON.stringify(badDag)).toBe(originalSnapshot);
    expect(certs.length).toBeGreaterThanOrEqual(2);
    expect(retries).toBeGreaterThanOrEqual(1);

    const [finalPass, remainingCerts] = gate.validate(repairedDag, [[0.0, 0.0, 0.335]]);
    expect(finalPass).toBe(true);
    expect(remainingCerts.length).toBe(0);
  });
});

describe("3. Schedule Stage — Contention-Aware Wavefront RCPSP Scheduler", () => {
  test("serializes shared-state mutex writes with zero mutex_violations and writes back empirical timing", () => {
    const gen = new RuleBasedTaskGenerator();
    const dag = gen.generateWorkflow("Build 3-stage multi-agent synthesis", 1);

    const greedy = new ContentionAwareWavefrontScheduler("greedy");
    const rcpsp = new ContentionAwareWavefrontScheduler("rcpsp");

    const gSched = greedy.scheduleDag(dag);
    const rSched = rcpsp.scheduleDag(dag);

    expect(rSched.schedule?.mutex_violations).toBe(0);
    expect(gSched.schedule?.mutex_violations).toBe(0);
    expect(rSched.schedule!.makespan_sec).toBeLessThanOrEqual(gSched.schedule!.makespan_sec);
    expect(rSched.schedule!.windows.some((w: any) => w.ui_state === "STAGED_PRE_GATE")).toBe(true);

    const updated = rcpsp.writeBackStageTiming(dag, 1, "Agent_Alpha", 1.25, -0.05, 0.02);
    expect(rcpsp.profileStore.toSummaryDict().total_records).toBe(1);
    expect(updated.schedule?.mutex_violations).toBe(0);
  });
});

describe("4. Learn & Revise Stage — Fault Classifier, 3-Node Subgraph Patcher, Skill Evolution & Closed-Loop Orchestrator", () => {
  test("classifies Tier-1 schema drift and splices 0-token 3-node recovery subgraph", () => {
    const classifier = new FaultClassifier();
    const diag = classifier.evaluateOutputs(
      { Task_Spec: [0.0, 0.0, 0.335], Task_Code: [0.0, 0.0, 0.380] },
      { Task_Spec: [0.0, 0.0, 0.335], Task_Code: [0.018, -0.012, 0.380] },
      "4",
      "Task_Code"
    );
    expect(diag.tier).toBe(1);
    expect(diag.classification).toBe("TIER1_SCHEMA_DRIFT");

    const gen = new RuleBasedTaskGenerator();
    const dag = gen.generateWorkflow("Build 3-stage synthesis", 1);
    const patcher = new SubgraphPatcher("subgraph_patch");
    const repair = patcher.handleFault(dag, diag, [0.0, 0.0, 0.380], [[0.0, 0.0, 0.335]]);

    expect(repair.tokens_consumed_on_recovery).toBe(0);
    expect(repair.spliced_node_ids).toEqual([
      "4_re_index_context",
      "4_patch_artifact",
      "4_commit_verified",
    ]);
    expect(repair.gate_verified).toBe(true);
    expect(repair.repaired_dag.schedule?.mutex_violations).toBe(0);
  });

  test("FeedbackEvolutionEngine synthesizes root cause, parameter patches, and guardrail rules", () => {
    const evo = new FeedbackEvolutionEngine();
    const res = evo.evaluateFeedback("Agent_Beta encountered context window overflow during pair_sync", "Context & Token Budget");
    expect(res.root_cause).toContain("Context budget boundary");
    expect(res.parameter_patches.context_chunk_limit).toBeDefined();
    expect(res.skill_evolution_rules.length).toBeGreaterThan(0);
  });

  test("ClosedLoopOrchestrator executes full Plan -> Execute -> Validate -> Learn -> Revise closed loop with fault recovery", () => {
    const orchestrator = new ClosedLoopOrchestrator();
    const report = orchestrator.runClosedLoopCycle({
      prompt: "Synthesize a 3-stage multi-agent research report in parallel",
      mode: 1,
      injectSchemaDriftOnNodeId: "5",
      injectTokenOverflowOnNodeId: "4",
      operatorFeedback: "Ensure schema validation barrier completes before committing shared state",
    });

    expect(report.stages.plan.initialNodeCount).toBe(6);
    expect(report.stages.validate.certificatesIntercepted).toBeGreaterThanOrEqual(1);
    expect(report.stages.validate.shieldPassedAfterRepair).toBe(true);
    expect(report.stages.execute.faultInjected).toBe(true);
    expect(report.stages.learn.faultTier).toBe(1);
    expect(report.stages.revise.splicedNodeIds.length).toBe(3);
    expect(report.stages.revise.finalMutexViolations).toBe(0);
    expect(report.stages.revise.allNodesCompleted).toBe(true);
    expect(report.closedLoopVerified).toBe(true);
  });
});

describe("5. Backend API Server Integration Tests (Multi-Agent Express REST + Closed-Loop Endpoints)", () => {
  test("serves /api/status, /api/workflow/generate, /api/workflow/validate, /api/workflow/execute-step, /api/closed-loop/run, and /api/feedback", async () => {
    delete require.cache[require.resolve("../server.cjs")];
    const { app } = require("../server.cjs");
    const srv = app.listen(0);
    const port = srv.address().port;
    const base = `http://127.0.0.1:${port}`;

    try {
      const stRes = await fetch(`${base}/api/status`).then((r) => r.json());
      expect(stRes.ok).toBe(true);
      expect(stRes.running).toBe(true);

      const genRes = await fetch(`${base}/api/workflow/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Synthesize 3-stage multi-agent report in parallel", mode: 1 }),
      }).then((r) => r.json());
      expect(genRes.ok).toBe(true);
      expect(genRes.data.nodes.length).toBe(6);
      expect(genRes.data.schedule.mutex_violations).toBe(0);
      expect(genRes.data.schedule.windows.slice(0, 3).map((w: any) => w.agent_id)).toEqual([
        "agent_alpha",
        "agent_beta",
        "agent_gamma",
      ]);

      const valRes = await fetch(`${base}/api/workflow/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: [
            { id: "1", action: "synthesize", agent: "Agent_Alpha", complexity: 0.04, context_load: 0.0 },
            { id: "2", action: "synthesize", agent: "Agent_Beta", complexity: 0.0, context_load: 0.0 },
          ],
          edges: [],
        }),
      }).then((r) => r.json());
      expect(valRes.ok).toBe(true);
      expect(valRes.data.certificates.length).toBeGreaterThanOrEqual(2);
      expect(valRes.data.dag.schedule.mutex_violations).toBe(0);

      const execRes = await fetch(`${base}/api/workflow/execute-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retrieve", agent: "Agent_Alpha", target: "Task_Spec", sim_delay_ms: 10 }),
      }).then((r) => r.json());
      expect(execRes.ok).toBe(true);
      expect(execRes.success).toBe(true);

      const clRes = await fetch(`${base}/api/closed-loop/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Synthesize a 3-stage multi-agent report with maximum parallelism",
          mode: 1,
          inject_overflow: true,
          inject_schema_drift: true,
        }),
      }).then((r) => r.json());
      expect(clRes.ok).toBe(true);
      expect(clRes.data.closedLoopVerified).toBe(true);
      expect(clRes.data.stages.revise.splicedNodeIds).toEqual([
        "5_re_index_context",
        "5_patch_artifact",
        "5_commit_verified",
      ]);
      expect(clRes.data.finalDag.nodes.length).toBe(8);

      const nodesById = Object.fromEntries(clRes.data.finalDag.nodes.map((n: any) => [String(n.id), n]));
      for (const edge of clRes.data.finalDag.edges) {
        const src = nodesById[String(edge.source)];
        const dst = nodesById[String(edge.target)];
        expect(dst.y_pos - src.y_pos).toBeGreaterThanOrEqual(180);
      }

      const fbRes = await fetch(`${base}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: "Schema drift on Task_Code merge", category: "Schema & Validation" }),
      }).then((r) => r.json());
      expect(fbRes.ok).toBe(true);
      expect(fbRes.data.parameter_patches.schema_validation_strictness).toBeDefined();
    } finally {
      srv.close();
    }
  });
});


describe("6. ComfyUI Model/Parameter Widgets & Simulink Hierarchical Subsystem Blocks", () => {
  test("every generated block contains ComfyUI model/parameter widgets, typed I/O sockets, and a Simulink subsystem with connected sub_blocks", () => {
    const gen = new RuleBasedTaskGenerator();
    const dag = gen.generateWorkflow("Synthesize 3-stage multi-agent report", 1);
    for (const node of dag.nodes) {
      // ComfyUI widget parameters & typed sockets
      expect(node.comfy_params).toBeDefined();
      expect(typeof node.comfy_params?.model_checkpoint).toBe("string");
      expect(typeof node.comfy_params?.temperature).toBe("number");
      expect(typeof node.comfy_params?.max_tokens).toBe("number");
      expect(typeof node.comfy_params?.seed).toBe("number");
      expect(typeof node.comfy_params?.steps).toBe("number");
      expect(typeof node.comfy_params?.cfg_scale).toBe("number");
      expect(typeof node.comfy_params?.sampler_name).toBe("string");
      expect(Array.isArray(node.inputs)).toBe(true);
      expect(Array.isArray(node.outputs)).toBe(true);

      // Simulink hierarchical subsystem (Inport -> Sub-Blocks -> Outport)
      expect(node.subsystem).toBeDefined();
      expect(node.subsystem?.sub_blocks.length).toBeGreaterThanOrEqual(4);
      expect(node.subsystem?.sub_blocks[0].block_type).toBe("Inport");
      expect(node.subsystem?.sub_blocks[node.subsystem.sub_blocks.length - 1].block_type).toBe("Outport");
      expect(node.subsystem?.sub_edges.length).toBeGreaterThanOrEqual(3);
      expect(node.subsystem?.mask_params).toBeDefined();
    }
  });

  test("server /api/workflow/execute-step executes internal Simulink sub_blocks and returns sub_block_trace + ComfyUI model metadata", async () => {
    delete require.cache[require.resolve("../server.cjs")];
    const { app } = require("../server.cjs");
    const srv = app.listen(0);
    const port = srv.address().port;
    const base = `http://127.0.0.1:${port}`;

    try {
      const genRes = await fetch(`${base}/api/workflow/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Synthesize 3-stage report", mode: 1 }),
      }).then((r) => r.json());

      const firstNode = genRes.data.nodes[0];
      expect(firstNode.comfy_params.model_checkpoint).toBeDefined();
      expect(firstNode.subsystem.sub_blocks.length).toBeGreaterThanOrEqual(4);

      const execRes = await fetch(`${base}/api/workflow/execute-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: firstNode.action,
          agent: firstNode.agent,
          target: firstNode.target,
          comfy_params: firstNode.comfy_params,
          subsystem: firstNode.subsystem,
          sim_delay_ms: 10,
        }),
      }).then((r) => r.json());

      expect(execRes.ok).toBe(true);
      expect(Array.isArray(execRes.sub_block_trace)).toBe(true);
      expect(execRes.sub_block_trace.length).toBe(firstNode.subsystem.sub_blocks.length);
      expect(execRes.sub_block_trace.every((sb: any) => sb.status === "success")).toBe(true);
    } finally {
      srv.close();
    }
  });
});
