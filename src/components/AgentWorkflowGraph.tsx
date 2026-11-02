import React, { useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  MarkerType,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Bot,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { C, type MetricsData, type ChatMessage, type RobotAction } from './theme';

interface AgentWorkflowGraphProps {
  metrics: MetricsData | null;
  chatMessages: ChatMessage[];
  actions: RobotAction[];
  results: RobotAction[];
  userGoal: string;
  mode?: number;
  isDark?: boolean;
  isMobile?: boolean;
}

const fontSans = '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif';
const fontMono = '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace';

const baseFlowCardStyle = {
  background: C.nodeBg,
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${C.nodeBorder}`,
  boxShadow: C.nodeShadow,
  borderRadius: 18,
  padding: '14px 16px',
  color: C.text,
  fontFamily: fontSans,
  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
};

const makeHandleStyle = (color: string) => ({
  width: 10,
  height: 10,
  borderRadius: '50%',
  background: color,
  border: '2px solid var(--canvasBg, #09090b)',
  boxShadow: `0 0 10px ${color}`,
});

const Pill = ({ color, children, pulse = false }: { color: string; children: React.ReactNode; pulse?: boolean }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 9px',
      borderRadius: 9999,
      background: `${color}18`,
      border: `1px solid ${color}35`,
      color,
      fontSize: 9.5,
      fontWeight: 700,
    }}
  >
    {pulse && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />}
    {children}
  </div>
);

const GoalNode = ({ data }: { data: { goal: string } }) => (
  <div style={{ ...baseFlowCardStyle, width: 270, border: '1px solid rgba(34, 197, 94, 0.35)' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 9, background: 'linear-gradient(135deg, #22c55e, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={15} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Operator Directive</div>
          <div style={{ fontSize: 9.5, color: C.textMuted }}>High-Level Goal</div>
        </div>
      </div>
      <Pill color="#38bdf8" pulse>Goal Input</Pill>
    </div>
    <div style={{ background: C.subCardBg, borderRadius: 12, padding: '8px 11px', border: `1px solid ${C.subCardBorder}`, color: C.subCardText, fontSize: 10.5, fontStyle: 'italic' }}>
      "{data.goal}"
    </div>
    <Handle type="source" position={Position.Bottom} style={makeHandleStyle(C.green)} />
  </div>
);

const PipelineStageNode = ({ data }: any) => (
  <div style={{ ...baseFlowCardStyle, width: 265, border: `1px solid ${data.color}55` }}>
    <Handle type="target" position={Position.Top} style={makeHandleStyle(data.color)} />
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${data.color}20`, border: `1px solid ${data.color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
          {data.emoji}
        </div>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text }}>{data.title}</div>
          <div style={{ fontSize: 9.5, color: data.color, fontFamily: fontMono }}>{data.subtitle}</div>
        </div>
      </div>
      <Pill color={data.color} pulse>{data.badge}</Pill>
    </div>
    <div style={{ background: C.subCardBg, borderRadius: 12, padding: '8px 10px', border: `1px solid ${C.subCardBorder}`, color: C.textDim, fontSize: 10, lineHeight: 1.4 }}>
      {data.desc}
    </div>
    <Handle type="source" position={Position.Bottom} style={makeHandleStyle(data.color)} />
  </div>
);

const SpecialistAgentNode = ({ data }: any) => (
  <div style={{ ...baseFlowCardStyle, width: 245, border: `1px solid ${data.color}55` }}>
    <Handle type="target" position={Position.Top} style={makeHandleStyle(data.color)} />
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 9, background: `${data.color}20`, border: `1px solid ${data.color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bot size={15} color={data.color} />
        </div>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text }}>{data.name}</div>
          <div style={{ fontSize: 9.5, color: C.textMuted }}>{data.domain}</div>
        </div>
      </div>
      <Pill color={data.color}>{data.phase || 'IDLE'}</Pill>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.subCardBg, borderRadius: 10, padding: '6px 10px', fontSize: 10, fontFamily: fontMono, color: C.textDim }}>
      <span>Util: <strong style={{ color: C.text }}>{data.busyPct}%</strong></span>
      <span>Done: <strong style={{ color: data.color }}>{data.completed}</strong></span>
    </div>
    <Handle type="source" position={Position.Bottom} style={makeHandleStyle(data.color)} />
  </div>
);

const MutexNode = ({ data }: any) => {
  const isLocked = Boolean(data.lockedBy);
  const color = isLocked ? '#f97316' : C.green;
  return (
    <div style={{ ...baseFlowCardStyle, width: 260, border: `1px solid ${color}60` }}>
      <Handle type="target" position={Position.Top} style={makeHandleStyle(color)} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 9, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isLocked ? <ShieldAlert size={15} color={color} /> : <ShieldCheck size={15} color={color} />}
          </div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text }}>Shared-State Arbiter</div>
            <div style={{ fontSize: 9.5, color: C.textMuted }}>Mutex: M_shared_state</div>
          </div>
        </div>
        <Pill color={color} pulse={isLocked}>{isLocked ? 'Locked' : 'Clear'}</Pill>
      </div>
      <div style={{ background: C.subCardBg, borderRadius: 10, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
        <span style={{ color: C.textMuted }}>Holder:</span>
        <span style={{ fontWeight: 700, color: C.text }}>{data.lockedBy || 'Available'}</span>
      </div>
      <Handle type="source" position={Position.Bottom} style={makeHandleStyle(color)} />
    </div>
  );
};

const OutputStoreNode = ({ data }: any) => (
  <div style={{ ...baseFlowCardStyle, width: 260, border: '1px solid rgba(34, 197, 94, 0.4)' }}>
    <Handle type="target" position={Position.Top} style={makeHandleStyle(C.green)} />
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 9, background: 'rgba(34, 197, 94, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Layers size={15} color="#38bdf8" />
        </div>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text }}>Shared Knowledge Store</div>
          <div style={{ fontSize: 9.5, color: C.textMuted }}>Verified Artifact Graph</div>
        </div>
      </div>
      <Pill color="#10b981"><CheckCircle2 size={10} /> Synced</Pill>
    </div>
    <div style={{ background: C.subCardBg, borderRadius: 10, padding: '8px 10px', textAlign: 'center', fontFamily: fontMono }}>
      <span style={{ fontSize: 15, fontWeight: 800, color: C.green }}>{data.mergedCount ?? 0}</span>
      <span style={{ fontSize: 10.5, color: C.textMuted }}> / 9 Shards Merged</span>
    </div>
  </div>
);

const nodeTypes = {
  goalNode: GoalNode,
  stageNode: PipelineStageNode,
  agentNode: SpecialistAgentNode,
  mutexNode: MutexNode,
  storeNode: OutputStoreNode,
};

export const AgentWorkflowGraph: React.FC<AgentWorkflowGraphProps> = ({
  metrics,
  userGoal,
  isMobile = false,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const agentsMap = metrics?.agents || metrics?.robots || {};
    const alpha = agentsMap.Agent_Alpha || { phase: 'IDLE', busy_pct: 74, tasks_completed: 2 };
    const beta = agentsMap.Agent_Beta || { phase: 'IDLE', busy_pct: 78, tasks_completed: 2 };
    const gamma = agentsMap.Agent_Gamma || { phase: 'IDLE', busy_pct: 71, tasks_completed: 2 };

    const gNodes: Node[] = [
      { id: 'goal', type: 'goalNode', position: { x: 365, y: 20 }, data: { goal: userGoal } },
      {
        id: 'gen',
        type: 'stageNode',
        position: { x: 180, y: 185 },
        data: {
          emoji: '📋',
          title: 'Rule-Based Blueprint',
          subtitle: 'Deterministic Decomposer',
          badge: 'Ready',
          color: C.green,
          desc: 'Partitions multi-agent tasks into parallel retrieval & serialized synthesis waves.',
        },
      },
      {
        id: 'orch',
        type: 'stageNode',
        position: { x: 540, y: 185 },
        data: {
          emoji: '🧠',
          title: 'RCPSP Wavefront Planner',
          subtitle: 'Contention-Aware Scheduler',
          badge: 'Active',
          color: C.green,
          desc: 'Pre-stages agents at STAGED_PRE_GATE and schedules M_shared_state windows.',
        },
      },
      {
        id: 'verifier',
        type: 'stageNode',
        position: { x: 365, y: 355 },
        data: {
          emoji: '🛡️',
          title: 'Pre-Flight Safety Shield',
          subtitle: 'Write-Back & Subgraph Patcher',
          badge: 'Guarding',
          color: '#a855f7',
          desc: 'Intercepts token overflows & schema drift; splices 0-token 3-node recovery subgraphs.',
        },
      },
      {
        id: 'alpha',
        type: 'agentNode',
        position: { x: 70, y: 530 },
        data: { name: 'Agent_Alpha', domain: 'Research & Retrieval', color: '#ef4444', phase: alpha.phase, busyPct: alpha.busy_pct, completed: alpha.tasks_completed },
      },
      {
        id: 'beta',
        type: 'agentNode',
        position: { x: 375, y: 530 },
        data: { name: 'Agent_Beta', domain: 'Code & Synthesis', color: C.green, phase: beta.phase, busyPct: beta.busy_pct, completed: beta.tasks_completed },
      },
      {
        id: 'gamma',
        type: 'agentNode',
        position: { x: 680, y: 530 },
        data: { name: 'Agent_Gamma', domain: 'Audit & Verification', color: C.green, phase: gamma.phase, busyPct: gamma.busy_pct, completed: gamma.tasks_completed },
      },
      {
        id: 'mutex',
        type: 'mutexNode',
        position: { x: 370, y: 695 },
        data: { lockedBy: metrics?.shared_state_locked_by ?? null },
      },
      {
        id: 'store',
        type: 'storeNode',
        position: { x: 370, y: 850 },
        data: { mergedCount: metrics?.merged_count ?? 3 },
      },
    ];

    const gEdges: Edge[] = [
      { id: 'e-goal-gen', source: 'goal', target: 'gen', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e-goal-orch', source: 'goal', target: 'orch', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e-gen-ver', source: 'gen', target: 'verifier', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e-orch-ver', source: 'orch', target: 'verifier', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e-ver-a', source: 'verifier', target: 'alpha', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e-ver-b', source: 'verifier', target: 'beta', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e-ver-g', source: 'verifier', target: 'gamma', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e-a-m', source: 'alpha', target: 'mutex', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e-b-m', source: 'beta', target: 'mutex', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e-g-m', source: 'gamma', target: 'mutex', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e-m-s', source: 'mutex', target: 'store', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
    ];

    setNodes(gNodes);
    setEdges(gEdges);
  }, [metrics, setEdges, setNodes, userGoal]);

  return (
    <div style={{ width: '100%', height: '100%', background: C.canvasBg }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: isMobile ? 0.12 : 0.18 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color={C.canvasGridDots} />
        <Controls style={{ background: C.controlsBg, border: `1px solid ${C.controlsBorder}`, borderRadius: 8 }} />
        {!isMobile && (
          <MiniMap
            style={{ background: C.miniMapBg, border: `1px solid ${C.miniMapBorder}`, borderRadius: 8 }}
            maskColor={C.miniMapMask}
          />
        )}
      </ReactFlow>
    </div>
  );
};
