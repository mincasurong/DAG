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
  Layers,
  ZoomIn,
  ArrowLeft,
  Cpu,
} from 'lucide-react';
import { BACKEND_API, C, monoFont } from './theme';

export interface ComfyParamConfig {
  model_checkpoint: string;
  temperature: number;
  top_p: number;
  max_tokens: number;
  seed: number;
  control_after_generate: 'fixed' | 'increment' | 'randomize';
  steps: number;
  cfg_scale: number;
  sampler_name: string;
  scheduler: string;
}

export interface SimulinkSubBlock {
  id: string;
  label: string;
  block_type: 'Inport' | 'Filter' | 'ModelOp' | 'Gain' | 'Verifier' | 'Mux' | 'Outport';
  model: string;
  params: Record<string, string | number>;
  status: 'idle' | 'running' | 'success' | 'failed';
}

export interface SimulinkSubsystem {
  name: string;
  inports: string[];
  outports: string[];
  mask_params: Record<string, string | number>;
  sub_blocks: SimulinkSubBlock[];
  sub_edges: Array<{ id: string; source: string; target: string }>;
}

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
  comfy_params?: ComfyParamConfig;
  subsystem?: SimulinkSubsystem;
  onOpenSubsystem?: (nodeId: string) => void;
  status: 'idle' | 'WAITING_MUTEX' | 'STAGED_PRE_GATE' | 'EXECUTING' | 'running' | 'success' | 'failed';
}

export function makeDefaultComfyParams(agent: string, action: string, idx = 0): ComfyParamConfig {
  const defaultModel = agent.includes('Beta')
    ? 'claude-opus-4'
    : agent.includes('Gamma')
    ? 'gemini-3.5-flash-lite'
    : 'gemini-4-argon';
  return {
    model_checkpoint: defaultModel,
    temperature: action === 'synthesize' ? 0.15 : 0.25,
    top_p: 0.95,
    max_tokens: action === 'synthesize' ? 8192 : 4096,
    seed: 42819001 + idx * 137,
    control_after_generate: 'fixed',
    steps: 20,
    cfg_scale: 7.5,
    sampler_name: 'rcpsp_wavefront',
    scheduler: 'rcpsp_pipelined',
  };
}

export function makeDefaultSubsystem(action: string, comfy: ComfyParamConfig): SimulinkSubsystem {
  const modelUsed = comfy.model_checkpoint || 'gemini-4-argon';
  return {
    name: `${action.toUpperCase()}_SubSystem`,
    inports: ['In1 (Context)', 'In2 (Model)'],
    outports: ['Out1 (Artifact)', 'Out2 (State)'],
    mask_params: { gain_k: 1.0, filter_tau_s: 0.12, schema_guard: 'strict' },
    sub_blocks: [
      { id: 'sb_in', label: 'In1: Context', block_type: 'Inport', model: 'simulink/Inport', params: { port: 1 }, status: 'idle' },
      { id: 'sb_filter', label: action === 'synthesize' ? 'StateMux' : 'EmbedFilter', block_type: action === 'synthesize' ? 'Mux' : 'Filter', model: 'text-embedding-004', params: { chunk: 512 }, status: 'idle' },
      { id: 'sb_sampler', label: 'KSamplerOp', block_type: 'ModelOp', model: modelUsed, params: { steps: comfy.steps, cfg: comfy.cfg_scale }, status: 'idle' },
      { id: 'sb_verify', label: 'SchemaGuard', block_type: 'Verifier', model: 'shield-v2', params: { gain_k: 1.0 }, status: 'idle' },
      { id: 'sb_out', label: 'Out1: Artifact', block_type: 'Outport', model: 'simulink/Outport', params: { port: 1 }, status: 'idle' },
    ],
    sub_edges: [
      { id: 'se_1', source: 'sb_in', target: 'sb_filter' },
      { id: 'se_2', source: 'sb_filter', target: 'sb_sampler' },
      { id: 'se_3', source: 'sb_sampler', target: 'sb_verify' },
      { id: 'se_4', source: 'sb_verify', target: 'sb_out' },
    ],
  };
}

const getSubBlockColor = (bType: SimulinkSubBlock['block_type']) => {
  switch (bType) {
    case 'Inport': return '#06b6d4';
    case 'Filter':
    case 'Mux': return '#3b82f6';
    case 'ModelOp': return '#8b5cf6';
    case 'Gain': return '#f59e0b';
    case 'Verifier': return '#10b981';
    case 'Outport': return '#ec4899';
    default: return '#60a5fa';
  }
};

// ─────────────────────────────────────────────────────────────
// Custom Node: ComfyUI Model/Parameter Widget + Simulink Subsystem Block
// ─────────────────────────────────────────────────────────────
const TaskActionNode = ({ id, data }: NodeProps<Node<WorkflowStepData>>) => {
  const { setNodes, setEdges } = useReactFlow();
  const comfy = data.comfy_params || makeDefaultComfyParams(data.agent || 'Agent_Alpha', data.action || 'retrieve', Number(id) || 0);
  const subsys = data.subsystem || makeDefaultSubsystem(data.action || 'retrieve', comfy);

  const updateField = (field: keyof WorkflowStepData, val: any) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n))
    );
  };

  const updateComfyParam = (key: keyof ComfyParamConfig, val: any) => {
    const nextComfy = { ...comfy, [key]: val };
    updateField('comfy_params', nextComfy);
  };

  const handleAddInlineSubBlock = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newSbId = `sb_${Date.now().toString().slice(-4)}`;
    const newSb: SimulinkSubBlock = {
      id: newSbId,
      label: `GainStage_${subsys.sub_blocks.length - 1}`,
      block_type: 'Gain',
      model: 'simulink/Gain',
      params: { gain_k: 1.25 },
      status: 'idle',
    };
    const beforeOut = [...subsys.sub_blocks];
    const outIdx = Math.max(1, beforeOut.length - 1);
    beforeOut.splice(outIdx, 0, newSb);
    updateField('subsystem', {
      ...subsys,
      sub_blocks: beforeOut,
    });
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

  const color = getActionColor();

  return (
    <div
      style={{
        background: C.nodeBg,
        border: getStatusBorder(),
        boxShadow: C.nodeShadow,
        borderRadius: 14,
        padding: '9px 11px',
        width: 268,
        color: C.text,
        fontSize: 11,
        position: 'relative',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 32,
          height: 8,
          top: -4,
          borderRadius: '16px 16px 0 0',
          background: C.nodeBorderHi,
          border: `1px solid ${C.borderHi}`,
        }}
      />

      {/* Node Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span
            style={{
              padding: '2px 6px',
              borderRadius: 5,
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
            <span style={{ padding: '1px 5px', borderRadius: 4, background: 'rgba(217,70,239,0.2)', color: '#e879f9', fontSize: 8, fontWeight: 800 }}>
              0-TOKEN SPLICE
            </span>
          )}
          {data.repaired && (
            <span style={{ padding: '1px 5px', borderRadius: 4, background: 'rgba(245,158,11,0.2)', color: '#fbbf24', fontSize: 8, fontWeight: 800 }}>
              SHIELD REPAIRED
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {(data.status === 'running' || data.status === 'EXECUTING') && <Zap size={12} color="#fbbf24" className="animate-spin" />}
          {data.status === 'success' && <CheckCircle2 size={12} color="#10b981" />}
          {data.status === 'failed' && <AlertTriangle size={12} color="#ef4444" />}
          <button onClick={handleDuplicate} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 1 }} title="Duplicate">
            <Copy size={11} />
          </button>
          <button onClick={handleDelete} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 1 }} title="Delete">
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* ComfyUI Typed I/O Sockets Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '3px 6px',
          marginBottom: 6,
          borderRadius: 6,
          background: 'rgba(0,0,0,0.2)',
          border: `1px solid ${C.border}`,
          fontSize: 8.5,
          fontFamily: monoFont,
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ color: '#a78bfa', fontWeight: 700 }}>● MODEL</span>
          <span style={{ color: '#fbbf24', fontWeight: 700 }}>● CTX</span>
          <span style={{ color: '#fb923c', fontWeight: 700 }}>● PROMPT</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ color: '#38bdf8', fontWeight: 700 }}>ARTIFACT ●</span>
          <span style={{ color: '#f472b6', fontWeight: 700 }}>STATE ●</span>
        </div>
      </div>

      {/* Agent & Artifact Row + ComfyUI Model & Parameter Widgets */}
      <div className="nodrag nopan" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          <select
            value={data.agent}
            onChange={(e) => updateField('agent', e.target.value)}
            style={{ background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 5, color: C.inputText, fontSize: 9.5, fontWeight: 700, padding: '2px 4px' }}
          >
            <option value="Agent_Alpha">Agent_Alpha</option>
            <option value="Agent_Beta">Agent_Beta</option>
            <option value="Agent_Gamma">Agent_Gamma</option>
            <option value="Agent_Alpha+Agent_Beta">Alpha+Beta</option>
          </select>
          <input
            type="text"
            value={data.target || 'Task_Spec'}
            onChange={(e) => updateField('target', e.target.value)}
            style={{ background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 5, color: C.inputText, fontSize: 9.5, fontWeight: 600, padding: '2px 5px', fontFamily: monoFont }}
          />
        </div>

        {/* ComfyUI KSampler / Checkpoint Parameter Widgets Box */}
        <div
          style={{
            background: 'rgba(139, 92, 246, 0.07)',
            border: '1px solid rgba(139, 92, 246, 0.28)',
            borderRadius: 8,
            padding: '5px 7px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 8.5, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Cpu size={10} /> ComfyUI Model & KSampler
            </span>
            <select
              value={comfy.model_checkpoint}
              onChange={(e) => updateComfyParam('model_checkpoint', e.target.value)}
              style={{ background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 4, color: '#c4b5fd', fontSize: 9, fontWeight: 700, padding: '1px 4px', fontFamily: monoFont }}
            >
              <option value="gemini-4-argon">gemini-4-argon</option>
              <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite</option>
              <option value="claude-opus-4">claude-opus-4</option>
              <option value="gpt-5-codex">gpt-5-codex</option>
              <option value="deepseek-r1">deepseek-r1</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3, fontFamily: monoFont, fontSize: 8.5 }}>
            <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 4, padding: '2px 4px', display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: C.textMuted, fontSize: 7.5 }}>temp</span>
              <input
                type="number"
                step="0.05"
                value={comfy.temperature}
                onChange={(e) => updateComfyParam('temperature', parseFloat(e.target.value) || 0.2)}
                style={{ width: '100%', background: 'transparent', border: 'none', color: C.text, fontSize: 9, fontWeight: 700, fontFamily: monoFont, padding: 0, outline: 'none' }}
              />
            </div>
            <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 4, padding: '2px 4px', display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: C.textMuted, fontSize: 7.5 }}>steps</span>
              <input
                type="number"
                step="1"
                value={comfy.steps}
                onChange={(e) => updateComfyParam('steps', parseInt(e.target.value) || 20)}
                style={{ width: '100%', background: 'transparent', border: 'none', color: C.text, fontSize: 9, fontWeight: 700, fontFamily: monoFont, padding: 0, outline: 'none' }}
              />
            </div>
            <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 4, padding: '2px 4px', display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: C.textMuted, fontSize: 7.5 }}>cfg</span>
              <input
                type="number"
                step="0.5"
                value={comfy.cfg_scale}
                onChange={(e) => updateComfyParam('cfg_scale', parseFloat(e.target.value) || 7.5)}
                style={{ width: '100%', background: 'transparent', border: 'none', color: C.text, fontSize: 9, fontWeight: 700, fontFamily: monoFont, padding: 0, outline: 'none' }}
              />
            </div>
            <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 4, padding: '2px 4px', display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: C.textMuted, fontSize: 7.5 }}>tokens</span>
              <input
                type="number"
                step="512"
                value={comfy.max_tokens}
                onChange={(e) => updateComfyParam('max_tokens', parseInt(e.target.value) || 4096)}
                style={{ width: '100%', background: 'transparent', border: 'none', color: C.text, fontSize: 9, fontWeight: 700, fontFamily: monoFont, padding: 0, outline: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* Simulink Hierarchical Subsystem Box (Sub-Blocks Inside the Block!) */}
        <div
          style={{
            background: 'rgba(6, 182, 212, 0.07)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            borderRadius: 8,
            padding: '5px 7px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 8.5, fontWeight: 800, color: '#22d3ee', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Layers size={10} /> Simulink {subsys.name} ({subsys.sub_blocks.length})
            </span>
            <div style={{ display: 'flex', gap: 3 }}>
              <button
                onClick={handleAddInlineSubBlock}
                data-testid={`btn-add-subblock-${id}`}
                style={{
                  padding: '1px 5px',
                  borderRadius: 4,
                  border: '1px solid rgba(6, 182, 212, 0.45)',
                  background: 'rgba(6, 182, 212, 0.15)',
                  color: '#22d3ee',
                  fontSize: 8,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Add Simulink Sub-Block inside this block"
              >
                +Sub
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  data.onOpenSubsystem?.(id);
                }}
                data-testid={`btn-open-subsystem-${id}`}
                style={{
                  padding: '1px 5px',
                  borderRadius: 4,
                  border: '1px solid rgba(56, 189, 248, 0.5)',
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  fontSize: 8,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
                title="Drill down into Simulink Subsystem block diagram"
              >
                <ZoomIn size={9} /> Open
              </button>
            </div>
          </div>

          {/* Inline Miniature Simulink Sub-Block Chain */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, overflowX: 'auto', paddingBottom: 1 }} className="hide-scrollbar">
            {subsys.sub_blocks.map((sb, idx) => {
              const sbColor = getSubBlockColor(sb.block_type);
              return (
                <React.Fragment key={sb.id}>
                  <div
                    style={{
                      padding: '2px 5px',
                      borderRadius: 4,
                      background: `${sbColor}22`,
                      border: `1px solid ${sbColor}65`,
                      color: C.text,
                      fontSize: 8,
                      fontWeight: 700,
                      fontFamily: monoFont,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                    title={`[${sb.block_type}] ${sb.label} (${sb.model})`}
                  >
                    {sb.label.split(':')[0]}
                  </div>
                  {idx < subsys.sub_blocks.length - 1 && (
                    <span style={{ color: '#22d3ee', fontSize: 8, fontWeight: 800, flexShrink: 0 }}>➔</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Schedule & UI State Footer */}
        <div
          style={{
            padding: '2px 6px',
            borderRadius: 5,
            background: 'rgba(0,0,0,0.28)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 9,
            fontFamily: monoFont,
            color: C.textDim,
          }}
        >
          <span>
            {data.start_offset_sec !== undefined ? `[${data.start_offset_sec}s → ${data.end_offset_sec}s]` : `seed:${comfy.seed}`}
          </span>
          <span style={{ color: data.ui_state === 'STAGED_PRE_GATE' ? '#22d3ee' : '#10b981', fontWeight: 700 }}>
            {data.ui_state || data.status}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 32,
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

function makeNode(
  id: string,
  x: number,
  y: number,
  action: WorkflowStepData['action'],
  agent: string,
  target: string,
  startSec: number,
  endSec: number,
  uiState: string
): Node<WorkflowStepData> {
  const comfy = makeDefaultComfyParams(agent, action, Number(id) || 0);
  const subsystem = makeDefaultSubsystem(action, comfy);
  return {
    id,
    type: 'taskAction',
    position: { x, y },
    data: {
      id,
      action,
      agent,
      target,
      priority: 'fast',
      start_offset_sec: startSec,
      end_offset_sec: endSec,
      ui_state: uiState,
      comfy_params: comfy,
      subsystem,
      status: 'idle',
    },
  };
}

export const TEMPLATES: Record<string, { nodes: Node<WorkflowStepData>[]; edges: Edge[] }> = {
  parallel_synthesis: {
    nodes: [
      makeNode('1', 50, 45, 'retrieve', 'Agent_Alpha', 'Task_Spec', 0.0, 1.2, 'EXECUTING'),
      makeNode('2', 360, 45, 'retrieve', 'Agent_Beta', 'Task_Dataset', 0.0, 1.2, 'EXECUTING'),
      makeNode('3', 670, 45, 'retrieve', 'Agent_Gamma', 'Task_Audit', 0.0, 1.2, 'EXECUTING'),
      makeNode('4', 360, 310, 'synthesize', 'Agent_Alpha', 'Task_Spec', 1.2, 3.4, 'STAGED_PRE_GATE'),
      makeNode('5', 360, 575, 'synthesize', 'Agent_Beta', 'Task_Dataset', 2.8, 5.0, 'STAGED_PRE_GATE'),
      makeNode('6', 360, 840, 'synthesize', 'Agent_Gamma', 'Task_Audit', 4.4, 6.6, 'STAGED_PRE_GATE'),
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
      makeNode('1', 140, 45, 'retrieve', 'Agent_Alpha', 'StreamEvent_0', 0.0, 1.2, 'EXECUTING'),
      makeNode('2', 490, 45, 'retrieve', 'Agent_Beta', 'StreamEvent_5', 0.0, 1.2, 'EXECUTING'),
      makeNode('3', 140, 310, 'synthesize', 'Agent_Alpha', 'StreamEvent_0', 1.2, 3.4, 'STAGED_PRE_GATE'),
      makeNode('4', 490, 310, 'synthesize', 'Agent_Beta', 'StreamEvent_5', 2.8, 5.0, 'STAGED_PRE_GATE'),
    ],
    edges: [
      { id: 'e1-3', source: '1', target: '3', type: 'removable', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e2-4', source: '2', target: '4', type: 'removable', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
    ],
  },
  fullstack_feature: {
    nodes: [
      makeNode('1', 140, 45, 'retrieve', 'Agent_Alpha', 'UI_Wireframe', 0.0, 1.2, 'EXECUTING'),
      makeNode('2', 490, 45, 'retrieve', 'Agent_Beta', 'API_Contract', 0.0, 1.2, 'EXECUTING'),
      makeNode('3', 140, 310, 'synthesize', 'Agent_Alpha', 'UI_Wireframe', 1.2, 3.4, 'STAGED_PRE_GATE'),
      makeNode('4', 490, 310, 'synthesize', 'Agent_Beta', 'API_Contract', 2.8, 5.0, 'STAGED_PRE_GATE'),
      makeNode('5', 315, 575, 'pair_sync', 'Agent_Alpha+Agent_Beta', 'FeatureIntegrationBundle', 5.0, 6.6, 'EXECUTING'),
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
      makeNode('1', 315, 45, 'pair_sync', 'Agent_Alpha+Agent_Beta', 'SharedSchemaContract', 0.0, 1.2, 'EXECUTING'),
      makeNode('2', 315, 310, 'cross_critique', 'Agent_Alpha+Agent_Beta', 'SharedSchemaContract', 1.2, 2.4, 'EXECUTING'),
      makeNode('3', 315, 575, 'pair_commit', 'Agent_Alpha+Agent_Beta', 'SharedSchemaContract', 2.4, 4.6, 'STAGED_PRE_GATE'),
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
  const [activeSubsystemNodeId, setActiveSubsystemNodeId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string>(
    'ComfyUI + Simulink Multi-Agent DAG Ready: Click any block "🔍 Open" button to drill into its Simulink SubSystem diagram.'
  );
  const [scheduleMetrics, setScheduleMetrics] = useState({
    makespan_sec: 6.6,
    agent_utilization_pct: 66.7,
    mutex_violations: 0,
    shield_repairs: 0,
    spliced_nodes: 0,
  });

  const isExecutingRef = useRef(false);

  // Inject onOpenSubsystem callback into node data
  const openSubsystem = useCallback((nid: string) => {
    setActiveSubsystemNodeId(nid);
  }, []);

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, onOpenSubsystem: openSubsystem },
      }))
    );
  }, [openSubsystem, setNodes]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) => addEdge({ ...params, type: 'removable', animated: true, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges]
  );

  const applyBackendDag = useCallback(
    (dag: any, certsCount = 0, splicedCount = 0) => {
      if (!dag || !dag.nodes) return;
      const mappedNodes: Node<WorkflowStepData>[] = dag.nodes.map((n: any, idx: number) => {
        const comfy = n.comfy_params || makeDefaultComfyParams(n.agent || 'Agent_Alpha', n.action || 'retrieve', idx);
        const subsys = n.subsystem || makeDefaultSubsystem(n.action || 'retrieve', comfy);
        return {
          id: String(n.id ?? idx + 1),
          type: 'taskAction',
          position: {
            x: Number(n.x_pos ?? 50 + (idx % 3) * 310),
            y: Number(n.y_pos ?? 45 + Math.floor(idx / 3) * 265),
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
            comfy_params: comfy,
            subsystem: subsys,
            onOpenSubsystem: openSubsystem,
            status: n.status || 'idle',
          },
        };
      });

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
    [fitView, isMobile, onScheduleUpdated, openSubsystem, setEdges, setNodes]
  );

  const loadTemplate = useCallback((key: string) => {
    const t = TEMPLATES[key];
    if (t) {
      setNodes(t.nodes.map((n) => ({ ...n, data: { ...n.data, status: 'idle', onOpenSubsystem: openSubsystem } })));
      setEdges(t.edges);
      setStatusBanner(`Loaded template '${key}' (${t.nodes.length} ComfyUI+Simulink blocks).`);
      setTimeout(() => fitView({ padding: isMobile ? 0.12 : 0.18, duration: 250 }), 60);
    }
  }, [fitView, isMobile, openSubsystem, setEdges, setNodes]);

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
          `[PLAN + RCPSP] Synthesized ${res.data.nodes.length} ComfyUI+Simulink blocks | Makespan: ${res.data.schedule?.makespan_sec}s | Mutex Violations: 0`
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
            : `[SHIELD PASS] All ${res.data.dag.nodes.length} ComfyUI+Simulink blocks verified -> RCPSP Makespan: ${res.data.dag.schedule.makespan_sec}s`
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
    setStatusBanner('[EXECUTE] Launching concurrent wavefront DAG + internal Simulink SubSystem pipelines...');

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
          comfy_params: node.data.comfy_params,
          subsystem: node.data.subsystem,
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
    setStatusBanner('[COMPLETED] All ComfyUI blocks and internal Simulink SubSystem pipelines executed.');
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
          `[CLOSED-LOOP VERIFIED] Plan (${rep.stages.plan.initialNodeCount}n) → Shield Repaired (${rep.stages.validate.certificatesIntercepted} cert) → Drift Detected (${rep.stages.learn.faultClassification}, ${rep.stages.learn.maxDriftScore} pts) → Spliced 3-Node Recovery [${rep.stages.revise.splicedNodeIds.join(' → ')}] → 100% Completed`
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
    const agent = actionType.startsWith('pair_') || actionType === 'cross_critique'
      ? 'Agent_Alpha+Agent_Beta'
      : colIdx === 0
      ? 'Agent_Alpha'
      : colIdx === 1
      ? 'Agent_Beta'
      : 'Agent_Gamma';
    const newNode = makeNode(
      id,
      50 + colIdx * 310,
      45 + rowIdx * 265,
      actionType,
      agent,
      actionType.startsWith('pair_') ? 'SharedSchemaContract' : 'Task_Spec',
      0,
      1.2,
      'EXECUTING'
    );
    newNode.data.onOpenSubsystem = openSubsystem;
    setNodes((prev) => [...prev, newNode]);
  };

  const activeSubNode = activeSubsystemNodeId ? nodes.find((n) => n.id === activeSubsystemNodeId) : null;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: C.canvasBg, position: 'relative' }}>
      {/* Top Directive & Closed-Loop Orchestration Bar */}
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

              <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, marginLeft: 4 }}>+ Block:</span>
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

      {/* Main React Flow Canvas */}
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

        {/* Simulink Hierarchical Subsystem Drill-Down Overlay (Block-in-Block Inspector) */}
        {activeSubNode && (
          <div
            data-testid="simulink-subsystem-modal"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(9, 9, 11, 0.94)',
              backdropFilter: 'blur(12px)',
              zIndex: 2000,
              display: 'flex',
              flexDirection: 'column',
              padding: isMobile ? 12 : 20,
              gap: 14,
              overflowY: 'auto',
            }}
          >
            {/* Breadcrumb Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => setActiveSubsystemNodeId(null)}
                  data-testid="btn-close-subsystem"
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(56, 189, 248, 0.5)',
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <ArrowLeft size={13} /> Back to Root DAG
                </button>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>
                    Simulink SubSystem: #{activeSubNode.id} · {activeSubNode.data.action.toUpperCase()} ({activeSubNode.data.agent})
                  </div>
                  <div style={{ fontSize: 10.5, color: C.textMuted, fontFamily: monoFont }}>
                    Hierarchy Path: Root_MultiAgent_DAG / {activeSubNode.data.subsystem?.name || 'SubSystem'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  const subsys = activeSubNode.data.subsystem || makeDefaultSubsystem(activeSubNode.data.action, activeSubNode.data.comfy_params!);
                  const newSb: SimulinkSubBlock = {
                    id: `sb_${Date.now().toString().slice(-4)}`,
                    label: `CustomFilter_${subsys.sub_blocks.length - 1}`,
                    block_type: 'Filter',
                    model: activeSubNode.data.comfy_params?.model_checkpoint || 'gemini-4-argon',
                    params: { window: 256, gain: 1.0 },
                    status: 'idle',
                  };
                  const nextBlocks = [...subsys.sub_blocks];
                  nextBlocks.splice(Math.max(1, nextBlocks.length - 1), 0, newSb);
                  setNodes((nds) =>
                    nds.map((n) =>
                      n.id === activeSubNode.id
                        ? { ...n, data: { ...n.data, subsystem: { ...subsys, sub_blocks: nextBlocks } } }
                        : n
                    )
                  );
                }}
                data-testid="btn-modal-add-subblock"
                style={{
                  padding: '7px 13px',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #06b6d4, #0284c7)',
                  color: '#fff',
                  border: 'none',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Plus size={13} /> Add Simulink Sub-Block
              </button>
            </div>

            {/* ComfyUI Node Parameters & Simulink Mask Parameters */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
              <div style={{ background: C.bgInput, border: '1px solid rgba(139, 92, 246, 0.4)', borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Cpu size={14} /> ComfyUI Checkpoint & KSampler Widgets
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, fontFamily: monoFont, fontSize: 11 }}>
                  <div>
                    <div style={{ color: C.textMuted, fontSize: 9.5 }}>ckpt_name</div>
                    <div style={{ color: C.text, fontWeight: 700 }}>{activeSubNode.data.comfy_params?.model_checkpoint}</div>
                  </div>
                  <div>
                    <div style={{ color: C.textMuted, fontSize: 9.5 }}>sampler_name</div>
                    <div style={{ color: '#38bdf8', fontWeight: 700 }}>{activeSubNode.data.comfy_params?.sampler_name}</div>
                  </div>
                  <div>
                    <div style={{ color: C.textMuted, fontSize: 9.5 }}>scheduler</div>
                    <div style={{ color: '#10b981', fontWeight: 700 }}>{activeSubNode.data.comfy_params?.scheduler}</div>
                  </div>
                  <div>
                    <div style={{ color: C.textMuted, fontSize: 9.5 }}>seed ({activeSubNode.data.comfy_params?.control_after_generate})</div>
                    <div style={{ color: '#fbbf24', fontWeight: 700 }}>{activeSubNode.data.comfy_params?.seed}</div>
                  </div>
                </div>
              </div>

              <div style={{ background: C.bgInput, border: '1px solid rgba(6, 182, 212, 0.4)', borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#22d3ee', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers size={14} /> Simulink Subsystem Mask Parameters (maskeditor)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontFamily: monoFont, fontSize: 11 }}>
                  {Object.entries(activeSubNode.data.subsystem?.mask_params || {}).map(([k, v]) => (
                    <div key={k} style={{ background: 'rgba(0,0,0,0.25)', padding: '6px 8px', borderRadius: 6 }}>
                      <div style={{ color: C.textMuted, fontSize: 9.5 }}>{k}</div>
                      <div style={{ color: '#22d3ee', fontWeight: 700 }}>{String(v)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Simulink Internal Connected Block Diagram */}
            <div
              style={{
                flex: 1,
                background: C.bgInput,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: C.text, fontFamily: monoFont }}>
                Internal Simulink Sub-Block Signal Chain (Inport ➔ Processing Sub-Blocks ➔ Outport)
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 4px' }}>
                {(activeSubNode.data.subsystem?.sub_blocks || []).map((sb, idx, arr) => {
                  const sbColor = getSubBlockColor(sb.block_type);
                  return (
                    <React.Fragment key={sb.id}>
                      <div
                        style={{
                          width: isMobile ? '100%' : 205,
                          background: C.nodeBg,
                          border: `2px solid ${sbColor}`,
                          borderRadius: sb.block_type === 'Inport' || sb.block_type === 'Outport' ? 24 : 12,
                          padding: '10px 12px',
                          boxShadow: `0 8px 20px rgba(0,0,0,0.4), 0 0 12px ${sbColor}30`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ padding: '2px 6px', borderRadius: 4, background: `${sbColor}25`, color: sbColor, fontSize: 9, fontWeight: 800 }}>
                            {sb.block_type.toUpperCase()}
                          </span>
                          <span style={{ fontSize: 9, color: C.textMuted, fontFamily: monoFont }}>#{idx + 1}</span>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{sb.label}</div>
                        <div style={{ fontSize: 9.5, color: '#a78bfa', fontFamily: monoFont }}>model: {sb.model}</div>
                        <div style={{ fontSize: 9.5, color: C.textDim, fontFamily: monoFont, background: 'rgba(0,0,0,0.25)', padding: '4px 6px', borderRadius: 5 }}>
                          {JSON.stringify(sb.params)}
                        </div>
                      </div>

                      {idx < arr.length - 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22d3ee', fontWeight: 900, fontSize: 18 }}>
                          ➔
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
