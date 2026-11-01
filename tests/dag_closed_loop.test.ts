import { describe, test, expect } from "bun:test";
import {
  RuleBasedTaskGenerator,
  RuleBasedTaskVerifier,
  PreFlightGate,
  WriteBackPlannerLoop,
  MutexProfileStore,
  ContentionAwareWavefrontScheduler,
  FaultClassifier,
  SubgraphPatcher,
  FeedbackEvolutionEngine,
  ClosedLoopOrchestrator,
  autoLayoutDag,
} from "../src/engine/ruleEngine";

describe("1. Plan Stage — Rule-Based Task Generator & Auto-Layout DAG", () => {
  test("generates parallel 3-arm tower DAG with topological wave layout", () => {
    const gen = new RuleBasedTaskGenerator();
    const wf = gen.generateWorkflow("Build a 3-layer tower with maximum parallelism", 1);
    expect(wf.nodes.length).toBe(6);
    expect(wf.edges.length).toBe(5);
    // Wave 0: nodes 1, 2, 3 are parallel picks at y_pos = 50
    const picks = wf.nodes.filter((n) => n.action === "pick");
    expect(picks.length).toBe(3);
    expect(new Set(picks.map((p) => p.robot))).toEqual(new Set(["FR3_1", "FR3_2", "FR3_3"]));
    expect(picks.every((p) => p.y_pos === 50)).toBe(true);
  });

  test("generates flexible basket packing and bimanual conveyor workflows", () => {
    const gen = new RuleBasedTaskGenerator();
    const basket = gen.generateWorkflow("Pack RedBall and YellowBall into FlexibleBasket", 3);
    expect(basket.nodes.length).toBe(9);
    expect(basket.nodes[8].action).toBe("dual_arm_pick");
    expect(basket.nodes[8].robot).toBe("FR3_1+FR3_2");

    const conv = gen.generateWorkflow("Intercept moving conveyor stream items at 50Hz", 2);
    expect(conv.nodes.length).toBe(4);
    expect(conv.edges.length).toBe(2);
  });

  test("generates grounded blueprint for tower, conveyor, and SDL workcell V2", () => {
    const [towerData, towerText] = RuleBasedTaskGenerator.generateBlueprint({ blocks_on_tower: ["Block1", "Block4"] }, "Build tower");
    expect(towerData.task_type).toBe("tower_stacking");
    expect(towerData.current_tower_height).toBe(2);
    expect(towerText).toContain("Current Tower Height: 2/9");

    const [sdlData, sdlText] = RuleBasedTaskGenerator.generateBlueprint(null, "Transfer ReagentVial_20mL to Z4_SDL_ThermalChamber");
    expect(sdlData.task_type).toBe("stamp_v2_cellular_sdl_workcell");
    expect(sdlText).toContain("Z4_SDL_ThermalChamber");
  });
});

describe("2. Validate Stage — Rule-Based Verifier & Pre-Flight Safety Shield", () => {
  test("RuleBasedTaskVerifier auto-promotes bimanual objects and enforces SDL tilt/temp limits", () => {
    const verifier = new RuleBasedTaskVerifier();
    const [ok1, san1, msg1] = verifier.verifyAction("pick", { robot: "FR3_1", target: "LongBar" }, null, "lift bar");
    expect(ok1).toBe(true);
    expect(san1.action).toBe("dual_arm_pick");
    expect(msg1).toContain("Promoted single-arm pick");

    verifier.reset();
    const [okTilt, , msgTilt] = verifier.verifyAction(
      "pick",
      { robot: "FR3_2", target: "ReagentVial_20mL", tilt_angle_rad: 0.35 },
      null,
      "sdl"
    );
    expect(okTilt).toBe(false);
    expect(msgTilt).toContain("SDL Safety Gate");

    const [okSlow, sanSlow] = verifier.verifyAction(
      "pick",
      { robot: "FR3_2", target: "ReagentVial_20mL", tilt_angle_rad: 0.05, temperature_c: 25.0 },
      null,
      "sdl"
    );
    expect(okSlow).toBe(true);
    expect(sanSlow.speed).toBe("slow");
  });

  test("PreFlightGate + WriteBackPlannerLoop intercepts COM_OVERHANG, IK_OUT_OF_BOUNDS, and SWEPT_VOLUME_COLLISION without mutating input", () => {
    const gate = new PreFlightGate("strict");
    const loop = new WriteBackPlannerLoop(gate, 3);

    const badDag = {
      nodes: [
        { id: "1", robot: "FR3_1", action: "place", x: 0.035, y: 0.0, z: 0.38 },
        { id: "2", robot: "FR3_2", action: "place", x: 1.45, y: 1.45, z: 0.425 },
        { id: "3", robot: "FR3_3", action: "place", x: 0.0, y: 0.0, z: 0.38 },
      ],
      edges: [],
    };
    const originalSnapshot = JSON.stringify(badDag);

    const [repairedDag, certs, retries] = loop.validateAndRepairDag(badDag, [[0.0, 0.0, 0.335]]);
    expect(JSON.stringify(badDag)).toBe(originalSnapshot); // immutability invariant
    expect(certs.length).toBeGreaterThanOrEqual(2);
    expect(retries).toBeGreaterThanOrEqual(1);

    const [finalPass, remainingCerts] = gate.validate(repairedDag, [[0.0, 0.0, 0.335]]);
    expect(finalPass).toBe(true);
    expect(remainingCerts.length).toBe(0);
  });
});

describe("3. Schedule Stage — Contention-Aware Wavefront RCPSP Scheduler", () => {
  test("serializes central-zone mutex placements with zero mutex_violations and writes back empirical timing", () => {
    const gen = new RuleBasedTaskGenerator();
    const dag = gen.generateWorkflow("Build 3-layer tower", 1);

    const greedy = new ContentionAwareWavefrontScheduler("greedy");
    const rcpsp = new ContentionAwareWavefrontScheduler("rcpsp");

    const gSched = greedy.scheduleDag(dag);
    const rSched = rcpsp.scheduleDag(dag);

    expect(rSched.schedule.mutex_violations).toBe(0);
    expect(gSched.schedule.mutex_violations).toBe(0);
    expect(rSched.schedule.makespan_sec).toBeLessThanOrEqual(gSched.schedule.makespan_sec);
    expect(rSched.schedule.windows.some((w: any) => w.ui_state === "STAGED_PRE_GATE")).toBe(true);

    // Write back empirical layer timing
    const updated = rcpsp.writeBackLayerTiming(dag, 1, "FR3_1", 1.25, -0.05, 0.02);
    expect(rcpsp.profileStore.toSummaryDict().total_records).toBe(1);
    expect(updated.schedule.mutex_violations).toBe(0);
  });
});

describe("4. Learn & Revise Stage — Fault Classifier, 3-Node Subgraph Patcher, Skill Evolution & Closed-Loop Orchestrator", () => {
  test("classifies Tier-1 local pose slip and splices 0-token 3-node recovery subgraph", () => {
    const classifier = new FaultClassifier();
    const diag = classifier.evaluatePoses(
      { Block1: [0.0, 0.0, 0.335], Block4: [0.0, 0.0, 0.380] },
      { Block1: [0.0, 0.0, 0.335], Block4: [0.018, -0.012, 0.380] },
      "4",
      "Block4"
    );
    expect(diag.tier).toBe(1);
    expect(diag.classification).toBe("TIER1_LOCAL_POSE_SLIP");

    const gen = new RuleBasedTaskGenerator();
    const dag = gen.generateWorkflow("Build 3-layer tower", 1);
    const patcher = new SubgraphPatcher("subgraph_patch");
    const repair = patcher.handleFault(dag, diag, [0.0, 0.0, 0.380], [[0.0, 0.0, 0.335]]);

    expect(repair.tokens_consumed_on_recovery).toBe(0);
    expect(repair.spliced_node_ids).toEqual([
      "4_re_perceive_pose",
      "4_regrasp_offset",
      "4_replace_verified",
    ]);
    expect(repair.gate_verified).toBe(true);
    expect(repair.repaired_dag.schedule.mutex_violations).toBe(0);
  });

  test("FeedbackEvolutionEngine synthesizes root cause, parameter patches, and skill evolution rules", () => {
    const evo = new FeedbackEvolutionEngine();
    const res = evo.evaluateFeedback("Robot 2 encountered IK singularity and reach limit during LongBar pick", "Kinematics & Reach");
    expect(res.root_cause).toContain("Kinematic reachability");
    expect(res.parameter_patches.dls_damping_lambda).toBeDefined();
    expect(res.skill_evolution_rules.length).toBeGreaterThan(0);
  });

  test("ClosedLoopOrchestrator executes full Plan -> Execute -> Validate -> Learn -> Revise closed loop with fault injection recovery", () => {
    const orchestrator = new ClosedLoopOrchestrator();
    const report = orchestrator.runClosedLoopCycle({
      prompt: "Build a 3-layer tower with maximum parallelism",
      mode: 1,
      injectPoseSlipOnNodeId: "5",
      injectUnsafeOverhangOnNodeId: "4",
      operatorFeedback: "Ensure finger release dwell is sufficient to avoid block slip on layer 2",
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


describe("5. Backend API Server Integration Tests (Express REST + Closed-Loop Endpoints)", () => {
  test("serves /api/status, /api/workflow/generate, /api/workflow/validate, /api/workflow/execute-step, /api/closed-loop/run, and /api/feedback", async () => {
    const { app } = require("../server.cjs");
    const srv = app.listen(0);
    const port = srv.address().port;
    const base = `http://127.0.0.1:${port}`;

    try {
      // 1. Status
      const stRes = await fetch(`${base}/api/status`).then((r) => r.json());
      expect(stRes.ok).toBe(true);
      expect(stRes.running).toBe(true);

      // 2. Generate workflow
      const genRes = await fetch(`${base}/api/workflow/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Build 3-layer tower in parallel", mode: 1 }),
      }).then((r) => r.json());
      expect(genRes.ok).toBe(true);
      expect(genRes.data.nodes.length).toBe(6);
      expect(genRes.data.schedule.mutex_violations).toBe(0);
      expect(genRes.data.schedule.windows.slice(0, 3).map((w: any) => w.arm_id)).toEqual(["fr3_1", "fr3_2", "fr3_3"]);

      // 3. Validate workflow with unsafe overhang & missing mutex serialization edge
      const valRes = await fetch(`${base}/api/workflow/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: [
            { id: "1", action: "place", robot: "FR3_1", x: 0.04, y: 0.0 },
            { id: "2", action: "place", robot: "FR3_2", x: 0.0, y: 0.0 },
          ],
          edges: [],
        }),
      }).then((r) => r.json());
      expect(valRes.ok).toBe(true);
      expect(valRes.data.certificates.length).toBeGreaterThanOrEqual(2);
      expect(valRes.data.dag.schedule.mutex_violations).toBe(0);

      // 4. Execute single step
      const execRes = await fetch(`${base}/api/workflow/execute-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pick", robot: "FR3_1", target: "Block1", sim_delay_ms: 10 }),
      }).then((r) => r.json());
      expect(execRes.ok).toBe(true);
      expect(execRes.success).toBe(true);

      // 5. Run Closed Loop (Plan -> Execute -> Validate -> Learn -> Revise)
      const clRes = await fetch(`${base}/api/closed-loop/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Build a 3-layer tower with maximum parallelism",
          mode: 1,
          inject_overhang: true,
          inject_pose_slip: true,
        }),
      }).then((r) => r.json());
      expect(clRes.ok).toBe(true);
      expect(clRes.data.closedLoopVerified).toBe(true);
      expect(clRes.data.stages.revise.splicedNodeIds.length).toBe(3);
      expect(clRes.data.finalDag.nodes.length).toBe(8); // 6 original - 1 failed + 3 spliced = 8

      // 6. Operator feedback
      const fbRes = await fetch(`${base}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: "Gripper slip on Block4 release", category: "Grasping & Release" }),
      }).then((r) => r.json());
      expect(fbRes.ok).toBe(true);
      expect(fbRes.data.parameter_patches.gripper_dwell_steps).toBeDefined();
    } finally {
      srv.close();
    }
  });

  test("recomputes topological y_pos coordinates after 3-node subgraph splice with zero vertical node overlap", async () => {
    const { app } = require("../server.cjs");
    const srv = app.listen(0);
    const port = srv.address().port;
    try {
      const clRes = await fetch(`http://127.0.0.1:${port}/api/closed-loop/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Build a 3-layer tower with maximum parallelism",
          mode: 1,
          inject_overhang: true,
          inject_pose_slip: true,
        }),
      }).then((r) => r.json());

      const nodesById = Object.fromEntries(clRes.data.finalDag.nodes.map((n: any) => [String(n.id), n]));
      for (const edge of clRes.data.finalDag.edges) {
        const src = nodesById[String(edge.source)];
        const dst = nodesById[String(edge.target)];
        expect(dst.y_pos - src.y_pos).toBeGreaterThanOrEqual(180);
      }
    } finally {
      srv.close();
    }
  });

});
