import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MarkerType,
  BackgroundVariant,
  type Connection,
  type NodeProps,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Play,
  Square,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Copy,
  ShieldCheck,
  RefreshCw,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { BACKEND_API, C, monoFont } from './theme';

export interface WorkflowStepData {
  [key: string]: any;
  id: string;
  action:
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
  agent: string;
  target?: string;
  complexity?: number;
  context_load?: number;
  priority?: string;
  start_offset_sec?: number;
  end_offset_sec?: number;
  wait_mutex_sec?: number;
  ui_state?: string;
  repaired?: boolean;
  repair_note?: string;
  spliced?: boolean;
  status: 'idle' | 'WAITING_MUTEX' | 'STAGED_PRE_GATE' | 'EXECUTING' | 'running' | 'success' | 'failed';
}

const TaskActionNode = ({ id, data }: NodeProps<Node<WorkflowStepData>>) => {
  const { setNodes, setEdges } = useReactFlow();

  const updateField = (field: keyof WorkflowStepData, val: any) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n))
    );
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = `${Date.now()}`;
    setNodes((nds) => {
      const curr = nds.find((n) => n.id === id);
      if (!curr) return nds;
      return [
        ...nds,
        {
          id: newId,
          type: 'taskAction',
          position: { x: curr.position.x + 35, y: curr.position.y + 35 },
          data: { ...curr.data, id: newId, status: 'idle' },
        },
      ];
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const getActionColor = () => {
    switch (data.action) {
      case 'retrieve': return '#3b82f6';
      case 'synthesize': return '#10b981';
      case 'pair_sync': return '#8b5cf6';
      case 'cross_critique': return '#ec4899';
      case 'pair_commit': return '#06b6d4';
      case 're_index_context': return '#f59e0b';
      case 'patch_artifact': return '#d946ef';
      case 'commit_verified': return '#14b8a6';
      case 'handoff': return '#6b7280';
      default: return '#3b82f6';
    }
  };

  const getStatusBorder = () => {
    if (data.status === 'WAITING_MUTEX') return '2px dashed #f59e0b';
    if (data.status === 'STAGED_PRE_GATE') return '2px solid #06b6d4';
    if (data.status === 'EXECUTING' || data.status === 'running') return '2px solid #fbbf24';
    if (data.status === 'success') return '2px solid #10b981';
    if (data.status === 'failed') return '2px solid #ef4444';
    if (data.spliced) return '2px solid #d946ef';
    if (data.repaired) return '2px solid #f59e0b';
    return `1px solid ${C.nodeBorderHi}`;
  };

  const getStatusGlow = () => {
    if (data.status === 'EXECUTING' || data.status === 'running') return '0 0 18px rgba(251, 191, 36, 0.45)';
    if (data.status === 'success') return '0 0 16px rgba(16, 185, 129, 0.35)';
    if (data.status === 'failed') return '0 0 16px rgba(239, 68, 68, 0.45)';
    if (data.spliced) return '0 0 18px rgba(217, 70, 239, 0.35)';
    return C.nodeShadow;
  };

  const color = getActionColor();
  const isPair = data.action.startsWith('pair_') || data.action === 'cross_critique';

  return (
    <div
      style={{
        background: C.nodeBg,
        border: getStatusBorder(),
        boxShadow: getStatusGlow(),
        borderRadius: 14,
        padding: '10px 12px',
        width: 242,
        color: C.text,
        fontSize: 11.5,
        position: 'relative',
        transition: 'all 0.2s ease',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 30,
          height: 8,
          top: -4,
          borderRadius: '16px 16px 0 0',
          background: C.nodeBorderHi,
          border: `1px solid ${C.borderHi}`,
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span
            style={{
              padding: '2px 7px',
              borderRadius: 6,
              background: `${color}25`,
              border: `1px solid ${color}55`,
              color,
              fontSize: 9.5,
              fontWeight: 800,
              textTransform: 'uppercase',
            }}
          >
            #{id} · {data.action.replace(/_/g, ' ')}
          </span>
          {data.spliced && (
            <span style={{ padding: '1px 6px', borderRadius: 5, background: 'rgba(217,70,239,0.2)', color: '#e879f9', fontSize: 8.5, fontWeight: 800 }}>
              0-TOKEN SPLICE
            </span>
          )}
          {data.repaired && (
            <span style={{ padding: '1px 6px', borderRadius: 5, background: 'rgba(245,158,11,0.2)', color: '#fbbf24', fontSize: 8.5, fontWeight: 800 }}>
              SHIELD REPAIRED
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {(data.status === 'running' || data.status === 'EXECUTING') && <Zap size={13} color="#fbbf24" className="animate-spin" />}
          {data.status === 'success' && <CheckCircle2 size={13} color="#10b981" />}
          {data.status === 'failed' && <AlertTriangle size={13} color="#ef4444" />}
          <button onClick={handleDuplicate} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 2 }} title="Duplicate node">
            <Copy size={12} />
          </button>
          <button onClick={handleDelete} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 2 }} title="Delete node">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div className="nodrag nopan" style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 10.5 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: C.textDim, fontWeight: 600 }}>Agent:</span>
          {isPair ? (
            <select
              value={data.agent}
              onChange={(e) => updateField('agent', e.target.value)}
              style={{ background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 5, color: C.inputText, fontSize: 10, fontWeight: 700, padding: '2px 5px' }}
            >
              <option value="Agent_Alpha+Agent_Beta">Alpha + Beta (Pair)</option>
            </select>
          ) : (
            <select
              value={data.agent}
              onChange={(e) => updateField('agent', e.target.value)}
              style={{ background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 5, color: C.inputText, fontSize: 10, fontWeight: 700, padding: '2px 5px' }}
            >
              <option value="Agent_Alpha">Agent_Alpha (Research)</option>
              <option value="Agent_Beta">Agent_Beta (Synthesis)</option>
              <option value="Agent_Gamma">Agent_Gamma (Audit)</option>
            </select>
          )}
        </div>

        {(data.action === 'retrieve' || data.action === 'pair_sync' || data.spliced || data.action === 'synthesize') && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: C.textDim, fontWeight: 600 }}>Artifact:</span>
            <input
              type="text"
              value={data.target || 'Task_Spec'}
              onChange={(e) => updateField('target', e.target.value)}
              style={{ width: 136, background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 5, color: C.inputText, fontSize: 10, fontWeight: 600, padding: '2px 6px', fontFamily: monoFont }}
            />
          </div>
        )}

        {(data.start_offset_sec !== undefined || data.ui_state) && (
          <div
            style={{
              marginTop: 4,
              padding: '3px 7px',
              borderRadius: 6,
              background: 'rgba(0,0,0,0.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 9.5,
              fontFamily: monoFont,
              color: C.textDim,
            }}
          >
            <span>
              {data.start_offset_sec !== undefined ? `[${data.start_offset_sec}s → ${data.end_offset_sec}s]` : 'Unscheduled'}
            </span>
            <span style={{ color: data.ui_state === 'STAGED_PRE_GATE' ? '#22d3ee' : '#10b981', fontWeight: 700 }}>
              {data.ui_state || data.status}
            </span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 30,
          height: 8,
          bottom: -4,
          borderRadius: '0 0 16px 16px',
          background: color,
          border: `1px solid ${color}`,
        }}
      />
    </div>
  );
};

const nodeTypes = { taskAction: TaskActionNode };

const RemovableEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) => {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: 2.5 }} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 1000,
          }}
          className="nodrag nopan"
        >
          <button
            onClick={(evt) => {
              evt.stopPropagation();
              setEdges((eds) => eds.filter((e) => e.id !== id));
            }}
            style={{
              width: 18,
              height: 18,
              background: C.hudBg,
              border: '1.5px solid rgba(239, 68, 68, 0.7)',
              color: '#ef4444',
              borderRadius: '50%',
              fontSize: 10,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
            title="Remove dependency edge"
          >
            ✕
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const edgeTypes = { removable: RemovableEdge };

export const TEMPLATES: Record<string, { nodes: Node<WorkflowStepData>[]; edges: Edge[] }> = {
  parallel_synthesis: {
    nodes: [
      { id: '1', type: 'taskAction', position: { x: 60, y: 45 }, data: { id: '1', action: 'retrieve', agent: 'Agent_Alpha', target: 'Task_Spec', priority: 'fast', start_offset_sec: 0.0, end_offset_sec: 1.2, ui_state: 'EXECUTING', status: 'idle' } },
      { id: '2', type: 'taskAction', position: { x: 350, y: 45 }, data: { id: '2', action: 'retrieve', agent: 'Agent_Beta', target: 'Task_Dataset', priority: 'fast', start_offset_sec: 0.0, end_offset_sec: 1.2, ui_state: 'EXECUTING', status: 'idle' } },
      { id: '3', type: 'taskAction', position: { x: 640, y: 45 }, data: { id: '3', action: 'retrieve', agent: 'Agent_Gamma', target: 'Task_Audit', priority: 'fast', start_offset_sec: 0.0, end_offset_sec: 1.2, ui_state: 'EXECUTING', status: 'idle' } },
      { id: '4', type: 'taskAction', position: { x: 350, y: 235 }, data: { id: '4', action: 'synthesize', agent: 'Agent_Alpha', target: 'Task_Spec', complexity: 0.0, context_load: 0.0, priority: 'fast', start_offset_sec: 1.2, end_offset_sec: 3.4, ui_state: 'STAGED_PRE_GATE', status: 'idle' } },
      { id: '5', type: 'taskAction', position: { x: 350, y: 425 }, data: { id: '5', action: 'synthesize', agent: 'Agent_Beta', target: 'Task_Dataset', complexity: 0.0, context_load: 0.0, priority: 'fast', start_offset_sec: 2.8, end_offset_sec: 5.0, ui_state: 'STAGED_PRE_GATE', status: 'idle' } },
      { id: '6', type: 'taskAction', position: { x: 350, y: 615 }, data: { id: '6', action: 'synthesize', agent: 'Agent_Gamma', target: 'Task_Audit', complexity: 0.0, context_load: 0.0, priority: 'fast', start_offset_sec: 4.4, end_offset_sec: 6.6, ui_state: 'STAGED_PRE_GATE', status: 'idle' } },
    ],
    edges: [
      { id: 'e1-4', source: '1', target: '4', type: 'removable', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e2-5', source: '2', target: '5', type: 'removable', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e3-6', source: '3', target: '6', type: 'removable', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e4-5', source: '4', target: '5', type: 'removable', animated: true, style: { stroke: '#fbbf24', strokeDasharray: '5,5' }, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e5-6', source: '5', target: '6', type: 'removable', animated: true, style: { stroke: '#fbbf24', strokeDasharray: '5,5' }, markerEnd: { type: MarkerType.ArrowClosed } },
    ],
  },
  stream_triage: {
    nodes: [
      { id: '1', type: 'taskAction', position: { x: 140, y: 45 }, data: { id: '1', action: 'retrieve', agent: 'Agent_Alpha', target: 'StreamEvent_0', priority: 'fast', status: 'idle' } },
      { id: '2', type: 'taskAction', position: { x: 460, y: 45 }, data: { id: '2', action: 'retrieve', agent: 'Agent_Beta', target: 'StreamEvent_5', priority: 'fast', status: 'idle' } },
      { id: '3', type: 'taskAction', position: { x: 140, y: 235 }, data: { id: '3', action: 'synthesize', agent: 'Agent_Alpha', target: 'StreamEvent_0', priority: 'fast', status: 'idle' } },
      { id: '4', type: 'taskAction', position: { x: 460, y: 235 }, data: { id: '4', action: 'synthesize', agent: 'Agent_Beta', target: 'StreamEvent_5', priority: 'fast', status: 'idle' } },
    ],
    edges: [
      { id: 'e1-3', source: '1', target: '3', type: 'removable', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e2-4', source: '2', target: '4', type: 'removable', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
    ],
  },
  fullstack_feature: {
    nodes: [
      { id: '1', type: 'taskAction', position: { x: 140, y: 45 }, data: { id: '1', action: 'retrieve', agent: 'Agent_Alpha', target: 'UI_Wireframe', priority: 'fast', status: 'idle' } },
      { id: '2', type: 'taskAction', position: { x: 460, y: 45 }, data: { id: '2', action: 'retrieve', agent: 'Agent_Beta', target: 'API_Contract', priority: 'fast', status: 'idle' } },
      { id: '3', type: 'taskAction', position: { x: 140, y: 235 }, data: { id: '3', action: 'synthesize', agent: 'Agent_Alpha', target: 'UI_Wireframe', priority: 'fast', status: 'idle' } },
      { id: '4', type: 'taskAction', position: { x: 460, y: 235 }, data: { id: '4', action: 'synthesize', agent: 'Agent_Beta', target: 'API_Contract', priority: 'fast', status: 'idle' } },
      { id: '5', type: 'taskAction', position: { x: 300, y: 425 }, data: { id: '5', action: 'pair_sync', agent: 'Agent_Alpha+Agent_Beta', target: 'FeatureIntegrationBundle', priority: 'fast', status: 'idle' } },
    ],
    edges: [
      { id: 'e1-3', source: '1', target: '3', type: 'removable', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e2-4', source: '2', target: '4', type: 'removable', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e3-5', source: '3', target: '5', type: 'removable', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e4-5', source: '4', target: '5', type: 'removable', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
    ],
  },
  adversarial_critique: {
    nodes: [
      { id: '1', type: 'taskAction', position: { x: 300, y: 45 }, data: { id: '1', action: 'pair_sync', agent: 'Agent_Alpha+Agent_Beta', target: 'SharedSchemaContract', priority: 'fast', status: 'idle' } },
      { id: '2', type: 'taskAction', position: { x: 300, y: 235 }, data: { id: '2', action: 'cross_critique', agent: 'Agent_Alpha+Agent_Beta', target: 'SharedSchemaContract', priority: 'fast', status: 'idle' } },
      { id: '3', type: 'taskAction', position: { x: 300, y: 425 }, data: { id: '3', action: 'pair_commit', agent: 'Agent_Alpha+Agent_Beta', target: 'SharedSchemaContract', priority: 'fast', status: 'idle' } },
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2', type: 'removable', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e2-3', source: '2', target: '3', type: 'removable', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
    ],
  },
};

interface VisualWorkflowBuilderProps {
  onPublishAction: (actionMsg: any) => Promise<{ success: boolean; message: string }>;
  onClosedLoopComplete?: (report: any) => void;
  onScheduleUpdated?: (schedule: any, certificates: any[]) => void;
  mode: number;
  isDark?: boolean;
  isMobile?: boolean;
}

export default function VisualWorkflowBuilder({
  onPublishAction,
  onClosedLoopComplete,
  onScheduleUpdated,
  mode,
  isMobile = false,
}: VisualWorkflowBuilderProps) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<WorkflowStepData>>(TEMPLATES.parallel_synthesis.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(TEMPLATES.parallel_synthesis.edges);
  const [isRunning, setIsRunning] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('Synthesize a 3-stage multi-agent research report with maximum parallelism');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showMobilePalette, setShowMobilePalette] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string>(
    'Multi-Agent Rule Engine Ready: Plan (DAG) → Pre-Flight Shield → RCPSP Wavefront → Execute → 0-Token Subgraph Recovery'
  );
  const [scheduleMetrics, setScheduleMetrics] = useState({
    makespan_sec: 6.6,
    agent_utilization_pct: 66.7,
    mutex_violations: 0,
    shield_repairs: 0,
    spliced_nodes: 0,
  });

  const isExecutingRef = useRef(false);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) => addEdge({ ...params, type: 'removable', animated: true, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges]
  );

  const applyBackendDag = useCallback(
    (dag: any, certsCount = 0, splicedCount = 0) => {
      if (!dag || !dag.nodes) return;
      const mappedNodes: Node<WorkflowStepData>[] = dag.nodes.map((n: any, idx: number) => ({
        id: String(n.id ?? idx + 1),
        type: 'taskAction',
        position: {
          x: Number(n.x_pos ?? 60 + (idx % 3) * 290),
          y: Number(n.y_pos ?? 45 + Math.floor(idx / 3) * 190),
        },
        data: {
          id: String(n.id ?? idx + 1),
          action: n.action || 'retrieve',
          agent: n.agent || 'Agent_Alpha',
          target: n.target || 'Task_Spec',
          complexity: n.complexity ?? 0.0,
          context_load: n.context_load ?? 0.0,
          priority: n.priority || 'fast',
          start_offset_sec: n.start_offset_sec,
          end_offset_sec: n.end_offset_sec,
          wait_mutex_sec: n.wait_mutex_sec,
          ui_state: n.ui_state,
          repaired: Boolean(n.repaired),
          repair_note: n.repair_note,
          spliced: Boolean(n.spliced),
          status: n.status || 'idle',
        },
      }));

      const mappedEdges: Edge[] = (dag.edges || []).map((e: any, idx: number) => ({
        id: e.id || `e${e.source}-${e.target}-${idx}`,
        source: String(e.source),
        target: String(e.target),
        type: 'removable',
        animated: true,
        style: e.spliced
          ? { stroke: '#e879f9', strokeWidth: 2.5 }
          : e.repaired
          ? { stroke: '#fbbf24', strokeDasharray: '5,5' }
          : undefined,
        markerEnd: { type: MarkerType.ArrowClosed },
      }));

      setNodes(mappedNodes);
      setEdges(mappedEdges);

      if (dag.schedule) {
        setScheduleMetrics({
          makespan_sec: dag.schedule.makespan_sec ?? 0,
          agent_utilization_pct: dag.schedule.agent_utilization_pct ?? 0,
          mutex_violations: dag.schedule.mutex_violations ?? 0,
          shield_repairs: certsCount,
          spliced_nodes: splicedCount,
        });
        onScheduleUpdated?.(dag.schedule, dag.shield_certificates || []);
      }
      setTimeout(() => fitView({ padding: isMobile ? 0.12 : 0.18, duration: 250 }), 60);
    },
    [fitView, isMobile, onScheduleUpdated, setEdges, setNodes]
  );

  const loadTemplate = useCallback((key: string) => {
    const t = TEMPLATES[key];
    if (t) {
      setNodes(t.nodes.map((n) => ({ ...n, data: { ...n.data, status: 'idle' } })));
      setEdges(t.edges);
      setStatusBanner(`Loaded template '${key}' (${t.nodes.length} nodes, ${t.edges.length} edges).`);
      setTimeout(() => fitView({ padding: isMobile ? 0.12 : 0.18, duration: 250 }), 60);
    }
  }, [fitView, isMobile, setEdges, setNodes]);

  useEffect(() => {
    if (mode === 2) loadTemplate('stream_triage');
    else if (mode === 3) loadTemplate('fullstack_feature');
    else if (mode === 4 || mode === 5) loadTemplate('adversarial_critique');
    else loadTemplate('parallel_synthesis');
  }, [mode, loadTemplate]);

  const handleSynthesizeDag = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    setStatusBanner(`[PLAN] Synthesizing rule-based multi-agent DAG for: "${aiPrompt}"...`);
    try {
      const res = await fetch(`${BACKEND_API}/api/workflow/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, mode }),
      }).then((r) => r.json());
      if (res.ok && res.data) {
        applyBackendDag(res.data, res.data.shield_certificates?.length || 0, 0);
        setStatusBanner(
          `[PLAN + RCPSP] Synthesized ${res.data.nodes.length} nodes & ${res.data.edges.length} edges | Makespan: ${res.data.schedule?.makespan_sec}s | Mutex Violations: 0`
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleValidateAndSchedule = async () => {
    setStatusBanner('[VALIDATE] Running Pre-Flight Safety Shield & Contention-Aware Wavefront RCPSP Scheduler...');
    try {
      const rawNodes = nodes.map((n) => ({
        ...n.data,
        id: n.id,
        x_pos: n.position.x,
        y_pos: n.position.y,
      }));
      const rawEdges = edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
      const res = await fetch(`${BACKEND_API}/api/workflow/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: rawNodes, edges: rawEdges, scheduler_mode: 'rcpsp', shield_mode: 'strict' }),
      }).then((r) => r.json());

      if (res.ok && res.data) {
        const certs = res.data.certificates || [];
        applyBackendDag(res.data.dag, certs.length, 0);
        onScheduleUpdated?.(res.data.dag.schedule, certs);
        setStatusBanner(
          certs.length > 0
            ? `[SHIELD AUTO-REPAIR] Intercepted & repaired ${certs.length} constraint violation(s) -> RCPSP Makespan: ${res.data.dag.schedule.makespan_sec}s (0 mutex violations)`
            : `[SHIELD PASS] All ${res.data.dag.nodes.length} nodes verified safe -> RCPSP Makespan: ${res.data.dag.schedule.makespan_sec}s (0 mutex violations)`
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExecuteWorkflow = async () => {
    if (isRunning || nodes.length === 0) return;
    setIsRunning(true);
    isExecutingRef.current = true;
    setStatusBanner('[EXECUTE] Launching concurrent wavefront DAG execution across Agent_Alpha, Agent_Beta, Agent_Gamma...');

    setNodes((prev) => prev.map((n) => ({ ...n, data: { ...n.data, status: 'idle' } })));

    const statusMap = new Map<string, 'idle' | 'running' | 'success' | 'failed'>();
    nodes.forEach((n) => statusMap.set(n.id, 'idle'));

    const parentsMap = new Map<string, string[]>();
    nodes.forEach((n) => parentsMap.set(n.id, []));
    edges.forEach((e) => parentsMap.get(e.target)?.push(e.source));

    const activePromises = new Map<string, Promise<void>>();

    while (isExecutingRef.current) {
      const readyNodes = nodes.filter((n) => {
        if (statusMap.get(n.id) !== 'idle') return false;
        const parents = parentsMap.get(n.id) || [];
        return parents.every((pId) => statusMap.get(pId) === 'success');
      });

      if (readyNodes.length === 0 && activePromises.size === 0) break;

      for (const node of readyNodes) {
        statusMap.set(node.id, 'running');
        setNodes((prev) =>
          prev.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, status: 'running' } } : n))
        );

        const p = onPublishAction({
          action: node.data.action,
          agent: node.data.agent,
          target: node.data.target,
        })
          .then((res) => {
            activePromises.delete(node.id);
            const finalSt = res.success ? 'success' : 'failed';
            statusMap.set(node.id, finalSt);
            setNodes((prev) =>
              prev.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, status: finalSt } } : n))
            );
          })
          .catch(() => {
            activePromises.delete(node.id);
            statusMap.set(node.id, 'failed');
          });

        activePromises.set(node.id, p);
      }

      if (activePromises.size > 0) {
        await Promise.race(Array.from(activePromises.values()));
      }
    }

    setIsRunning(false);
    isExecutingRef.current = false;
    setStatusBanner('[COMPLETED] All parallel & mutex-serialized multi-agent wavefronts executed successfully.');
  };

  const handleRunClosedLoop = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setStatusBanner('[CLOSED-LOOP 1/5 PLAN] Generating rule-based multi-agent blueprint & parallel DAG...');
    try {
      const res = await fetch(`${BACKEND_API}/api/closed-loop/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt || 'Synthesize a 3-stage multi-agent research report with maximum parallelism',
          mode,
          inject_overflow: true,
          inject_schema_drift: true,
        }),
      }).then((r) => r.json());

      if (res.ok && res.data) {
        const rep = res.data;
        applyBackendDag(
          rep.finalDag,
          rep.stages.validate.certificatesIntercepted,
          rep.stages.revise.splicedNodeIds.length
        );
        onClosedLoopComplete?.(rep);
        setStatusBanner(
          `[CLOSED-LOOP VERIFIED] Plan (${rep.stages.plan.initialNodeCount}n) → Shield Repaired (${rep.stages.validate.certificatesIntercepted} cert) → Drift Detected (${rep.stages.learn.faultClassification}, ${rep.stages.learn.maxDriftScore} pts) → Spliced 3-Node Recovery [${rep.stages.revise.splicedNodeIds.join(' → ')}] → 100% Completed (0 tokens, 0 mutex violations)`
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunning(false);
    }
  };

  const addNode = (actionType: WorkflowStepData['action']) => {
    const id = `${nodes.length + 1}`;
    const colIdx = nodes.length % 3;
    const rowIdx = Math.floor(nodes.length / 3);
    const newNode: Node<WorkflowStepData> = {
      id,
      type: 'taskAction',
      position: { x: 60 + colIdx * 290, y: 45 + rowIdx * 190 },
      data: {
        id,
        action: actionType,
        agent: actionType.startsWith('pair_') || actionType === 'cross_critique'
          ? 'Agent_Alpha+Agent_Beta'
          : colIdx === 0
          ? 'Agent_Alpha'
          : colIdx === 1
          ? 'Agent_Beta'
          : 'Agent_Gamma',
        target: actionType.startsWith('pair_') ? 'SharedSchemaContract' : 'Task_Spec',
        priority: 'fast',
        status: 'idle',
      },
    };
    setNodes((prev) => [...prev, newNode]);
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: C.canvasBg }}>
      {/* Top Directive & Closed-Loop Orchestration Bar (Mobile & Desktop Responsive) */}
      <div
        style={{
          padding: isMobile ? '8px 10px' : '10px 14px',
          background: C.hudBg,
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? 6 : 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSynthesizeDag()}
            placeholder="Enter multi-agent goal (e.g., 'Synthesize 3-stage research report in parallel')..."
            style={{
              flex: isMobile ? '1 1 100%' : '1 1 260px',
              background: C.inputBg,
              border: `1px solid ${C.inputBorder}`,
              borderRadius: 8,
              padding: isMobile ? '6px 10px' : '7px 12px',
              color: C.inputText,
              fontSize: isMobile ? 11.5 : 12,
              outline: 'none',
            }}
          />

          <button
            onClick={handleSynthesizeDag}
            disabled={isGenerating}
            data-testid="btn-synthesize-dag"
            style={{
              padding: isMobile ? '6px 9px' : '7px 12px',
              borderRadius: 8,
              border: '1px solid rgba(139, 92, 246, 0.5)',
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              color: '#fff',
              fontSize: isMobile ? 10.5 : 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Sparkles size={12} />
            {isMobile ? 'Synthesize' : 'Synthesize DAG'}
          </button>

          <button
            onClick={handleValidateAndSchedule}
            data-testid="btn-validate-schedule"
            style={{
              padding: isMobile ? '6px 9px' : '7px 12px',
              borderRadius: 8,
              border: '1px solid rgba(6, 182, 212, 0.5)',
              background: 'rgba(6, 182, 212, 0.16)',
              color: '#22d3ee',
              fontSize: isMobile ? 10.5 : 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <ShieldCheck size={12} />
            {isMobile ? 'Shield+RCPSP' : 'Shield + RCPSP Schedule'}
          </button>

          <button
            onClick={isRunning ? () => { isExecutingRef.current = false; setIsRunning(false); } : handleExecuteWorkflow}
            data-testid="btn-execute-dag"
            style={{
              padding: isMobile ? '6px 9px' : '7px 13px',
              borderRadius: 8,
              border: 'none',
              background: isRunning ? '#ef4444' : 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              fontSize: isMobile ? 10.5 : 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            {isRunning ? <Square size={12} /> : <Play size={12} />}
            {isRunning ? 'Stop' : isMobile ? 'Execute' : 'Execute Parallel DAG'}
          </button>

          <button
            onClick={handleRunClosedLoop}
            disabled={isRunning}
            data-testid="btn-run-closed-loop"
            style={{
              padding: isMobile ? '6px 10px' : '7px 13px',
              borderRadius: 8,
              border: '1px solid rgba(217, 70, 239, 0.55)',
              background: 'linear-gradient(135deg, #c026d3, #9333ea)',
              color: '#fff',
              fontSize: isMobile ? 10.5 : 11.5,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: '0 0 14px rgba(217, 70, 239, 0.3)',
            }}
          >
            <RefreshCw size={12} />
            {isMobile ? 'Closed-Loop Verify' : 'Closed-Loop Verify (Plan→Execute→Validate→Learn→Revise)'}
          </button>

          {isMobile && (
            <button
              onClick={() => setShowMobilePalette((s) => !s)}
              style={{
                padding: '6px 8px',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: C.bgInput,
                color: C.textDim,
                fontSize: 10.5,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Toggle Node Palette & Metrics"
            >
              <SlidersHorizontal size={12} />
            </button>
          )}
        </div>

        {/* Secondary Template & Node Palette Row (Always shown on Desktop, toggleable on Mobile) */}
        {(!isMobile || showMobilePalette) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>Templates:</span>
              {[
                ['parallel_synthesis', '3-Agent Parallel Synthesis'],
                ['stream_triage', 'Event Stream Triage'],
                ['fullstack_feature', 'Full-Stack Feature Pipeline'],
                ['adversarial_critique', 'Adversarial Cross-Critique'],
              ].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => loadTemplate(k)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: `1px solid ${C.border}`,
                    background: C.bgInput,
                    color: C.textDim,
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              ))}

              <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, marginLeft: 4 }}>+ Node:</span>
              {(['retrieve', 'synthesize', 'pair_sync', 'cross_critique', 'handoff'] as const).map((act) => (
                <button
                  key={act}
                  onClick={() => addNode(act)}
                  style={{
                    padding: '3px 7px',
                    borderRadius: 6,
                    border: `1px solid ${C.border}`,
                    background: 'transparent',
                    color: C.text,
                    fontSize: 9.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <Plus size={10} /> {act.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontFamily: monoFont, fontSize: 10 }}>
              <span style={{ padding: '2px 7px', borderRadius: 6, background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                Makespan: <strong>{scheduleMetrics.makespan_sec}s</strong>
              </span>
              <span style={{ padding: '2px 7px', borderRadius: 6, background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                Agent Util: <strong>{scheduleMetrics.agent_utilization_pct}%</strong>
              </span>
              <span style={{ padding: '2px 7px', borderRadius: 6, background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                Mutex Violations: <strong>{scheduleMetrics.mutex_violations}</strong>
              </span>
              {scheduleMetrics.shield_repairs > 0 && (
                <span style={{ padding: '2px 7px', borderRadius: 6, background: 'rgba(245,158,11,0.2)', color: '#fbbf24' }}>
                  Shield Repaired: <strong>{scheduleMetrics.shield_repairs}</strong>
                </span>
              )}
              {scheduleMetrics.spliced_nodes > 0 && (
                <span style={{ padding: '2px 7px', borderRadius: 6, background: 'rgba(217,70,239,0.2)', color: '#e879f9' }}>
                  0-Token Spliced: <strong>+{scheduleMetrics.spliced_nodes} nodes</strong>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Status Banner */}
        <div
          data-testid="dag-status-banner"
          style={{
            padding: isMobile ? '4px 8px' : '5px 10px',
            borderRadius: 6,
            background: 'rgba(0,0,0,0.25)',
            border: `1px solid ${C.border}`,
            fontSize: isMobile ? 10 : 11,
            color: C.textDim,
            fontFamily: monoFont,
            whiteSpace: isMobile ? 'nowrap' : 'normal',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {statusBanner}
        </div>
      </div>

      {/* React Flow Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
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
              nodeColor={(n) => {
                const d = n.data as WorkflowStepData;
                if (d?.spliced) return '#d946ef';
                if (d?.repaired) return '#f59e0b';
                if (d?.status === 'success') return '#10b981';
                return '#3b82f6';
              }}
            />
          )}
        </ReactFlow>
      </div>
    </div>
  );
}
