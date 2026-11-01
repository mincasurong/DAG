import { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  Zap,
  Send,
  Sparkles,
  Check,
  Clock,
} from 'lucide-react';
import { BACKEND_API, C, monoFont, type MonitoringSummary } from './theme';

interface ClosedLoopMonitorProps {
  summary: MonitoringSummary | null;
  closedLoopReport: any | null;
  schedule: any | null;
  certificates: any[];
  onTriggerAudit: () => void;
  onTriggerClosedLoop: () => void;
  isMobile?: boolean;
}

export default function ClosedLoopMonitor({
  summary,
  closedLoopReport,
  schedule,
  certificates,
  onTriggerAudit,
  onTriggerClosedLoop,
  isMobile = false,
}: ClosedLoopMonitorProps) {
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState('Schema & Validation');
  const [submitting, setSubmitting] = useState(false);
  const [evolutionResult, setEvolutionResult] = useState<any>(null);

  const handleSubmitFeedback = async () => {
    if (!feedbackComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND_API}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: feedbackComment, category: feedbackCategory }),
      }).then((r) => r.json());
      if (res.ok && res.data) {
        setEvolutionResult(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const stages = closedLoopReport?.stages;

  return (
    <div style={{ padding: isMobile ? 12 : 20, display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 18, overflowY: 'auto', height: '100%' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: isMobile ? 15 : 17, fontWeight: 800, color: C.text }}>
              Multi-Agent Closed-Loop Verification & Shield
            </h2>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 999,
                background: 'rgba(16, 185, 129, 0.18)',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                color: '#10b981',
                fontSize: 9.5,
                fontWeight: 800,
              }}
            >
              {closedLoopReport?.closedLoopVerified ? 'CLOSED-LOOP VERIFIED' : summary?.status || 'ACTIVE'}
            </span>
          </div>
          <div style={{ fontSize: isMobile ? 10 : 11.5, color: C.textMuted, marginTop: 4, fontFamily: monoFont }}>
            Plan (DAG) → Validate (Shield) → Schedule (RCPSP) → Execute → Learn & Revise (3-Node Splice)
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={onTriggerClosedLoop}
            style={{
              padding: isMobile ? '7px 11px' : '8px 14px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #c026d3, #9333ea)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: isMobile ? 11 : 11.5,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <RefreshCw size={13} /> {isMobile ? 'Run Closed-Loop' : 'Run Closed-Loop Verification Cycle'}
          </button>
          <button
            onClick={onTriggerAudit}
            style={{
              padding: isMobile ? '7px 10px' : '8px 12px',
              borderRadius: 8,
              background: 'rgba(59, 130, 246, 0.14)',
              color: '#60a5fa',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: isMobile ? 11 : 11.5,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Zap size={12} /> Audit
          </button>
        </div>
      </div>

      {/* 5-Stage Closed-Loop Pipeline Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fit, minmax(150px, 1fr))' : 'repeat(auto-fit, minmax(185px, 1fr))', gap: 10 }}>
        {[
          {
            step: '1. PLAN',
            title: 'Multi-Agent Blueprint',
            color: '#3b82f6',
            detail: stages
              ? `${stages.plan.initialNodeCount} nodes, ${stages.plan.initialEdgeCount} edges synthesized`
              : 'Parallel retrieval & synthesis wave layout',
          },
          {
            step: '2. VALIDATE',
            title: 'Pre-Flight Safety Shield',
            color: '#f59e0b',
            detail: stages
              ? `${stages.validate.certificatesIntercepted} violation(s) auto-repaired in ${stages.validate.writeBackRetries} retry`
              : `${certificates.length} active rejection certificates`,
          },
          {
            step: '3. EXECUTE',
            title: 'Wavefront + M_shared_state',
            color: '#06b6d4',
            detail: stages
              ? `Initial makespan ${stages.execute.initialMakespanSec}s (drift on node #${stages.execute.faultNodeId || 'none'})`
              : `Makespan ${schedule?.makespan_sec ?? 6.6}s | Util ${schedule?.agent_utilization_pct ?? 66.7}%`,
          },
          {
            step: '4. LEARN',
            title: 'Drift & Timing Diagnosis',
            color: '#d946ef',
            detail: stages
              ? `${stages.learn.faultClassification} (${stages.learn.maxDriftScore} pts drift)`
              : 'Tier-0/1/2 schema drift & mutex profiler',
          },
          {
            step: '5. REVISE',
            title: '0-Token 3-Node Splice',
            color: '#10b981',
            detail: stages
              ? `Spliced [${stages.revise.splicedNodeIds.length} nodes] in ${stages.revise.recoveryLatencyMs}ms (0 tokens, 0 mutex violations)`
              : 'SubgraphPatcher + Write-Back ready',
          },
        ].map((item) => (
          <div
            key={item.step}
            style={{
              background: C.bgInput,
              border: `1px solid ${item.color}45`,
              borderRadius: 12,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: item.color, fontFamily: monoFont }}>{item.step}</span>
              <CheckCircle2 size={13} color={item.color} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{item.title}</div>
            <div style={{ fontSize: 10.5, color: C.textDim, lineHeight: 1.35 }}>{item.detail}</div>
          </div>
        ))}
      </div>

      {/* Pre-Flight Gate Rejection Certificates & RCPSP Schedule Windows */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(290px, 1fr))', gap: 12 }}>
        <div
          style={{
            background: C.bgInput,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 13,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={15} color="#f59e0b" />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
              Pre-Flight Shield Rejection Certificates (Write-Back Repaired)
            </span>
          </div>
          {(stages?.validate?.certificates || certificates || []).length === 0 ? (
            <div style={{ fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6, padding: 6 }}>
              <ShieldCheck size={14} /> Zero active token budget or shared-state conflicts.
            </div>
          ) : (
            (stages?.validate?.certificates || certificates).map((c: any, idx: number) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  fontSize: 10.5,
                  fontFamily: monoFont,
                }}
              >
                <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: 3 }}>
                  [{c.violation_type}] Node #{c.node_id} ({c.agent_id}) — measured {c.measured_value} {c.unit} (limit {c.limit_value} {c.unit})
                </div>
                <div style={{ color: C.textDim }}>↳ Auto-Repair: {c.correction_hint}</div>
              </div>
            ))
          )}
        </div>

        <div
          style={{
            background: C.bgInput,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 13,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={15} color="#22d3ee" />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                Contention-Aware RCPSP Wavefront Windows
              </span>
            </div>
            <span style={{ fontSize: 10, color: '#22d3ee', fontFamily: monoFont }}>
              Makespan: {closedLoopReport?.finalDag?.schedule?.makespan_sec ?? schedule?.makespan_sec ?? 6.6}s
            </span>
          </div>

          <div style={{ maxHeight: 190, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {((closedLoopReport?.finalDag?.schedule?.windows || schedule?.windows) ?? []).map((w: any, i: number) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1.2fr 0.7fr 0.9fr 0.9fr' : '1.35fr 0.7fr 1.05fr 0.75fr 1.05fr',
                  gap: 6,
                  padding: '5px 8px',
                  borderRadius: 6,
                  background: 'rgba(0,0,0,0.22)',
                  fontSize: 10,
                  fontFamily: monoFont,
                  alignItems: 'center',
                }}
              >
                <span style={{ color: C.text, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>#{w.node_id}</span>
                <span style={{ color: '#60a5fa' }}>{String(w.agent_id || w.arm_id || '').replace('agent_', '').toUpperCase()}</span>
                {!isMobile && <span style={{ color: C.textDim }}>{w.action}</span>}
                <span style={{ color: '#fbbf24' }}>{w.start_offset_sec}s→{w.end_offset_sec}s</span>
                <span style={{ color: w.ui_state === 'STAGED_PRE_GATE' ? '#22d3ee' : '#10b981', textAlign: 'right', fontSize: 9.5 }}>
                  {w.ui_state}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Operator Feedback & Continuous Guardrail Evolution */}
      <div
        style={{
          background: C.bgInput,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={15} color="#3b82f6" />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>
              Operator Feedback & Autonomous Guardrail Evolution
            </span>
          </div>
          <span style={{ fontSize: 10, color: C.textMuted, fontFamily: monoFont }}>
            Closed-Loop Policy & Guardrail Synthesizer
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['Schema & Validation', 'Context & Token Budget', 'Pair Sync Coordination', 'RCPSP Mutex Scheduling'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFeedbackCategory(cat)}
              style={{
                padding: '4px 9px',
                borderRadius: 6,
                fontSize: 10.5,
                fontWeight: 600,
                border: feedbackCategory === cat ? '1px solid #3b82f6' : `1px solid ${C.border}`,
                background: feedbackCategory === cat ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0,0,0,0.2)',
                color: feedbackCategory === cat ? '#60a5fa' : C.textMuted,
                cursor: 'pointer',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={feedbackComment}
            onChange={(e) => setFeedbackComment(e.target.value)}
            placeholder="Describe an observed execution anomaly (e.g., 'Task_Dataset schema drift during merge; tighten JSON-Schema barrier')..."
            style={{
              flex: '1 1 220px',
              background: 'rgba(0,0,0,0.3)',
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '8px 11px',
              color: C.text,
              fontSize: 11.5,
              outline: 'none',
            }}
          />
          <button
            onClick={handleSubmitFeedback}
            disabled={submitting || !feedbackComment.trim()}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              background: feedbackComment.trim() ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'rgba(255,255,255,0.06)',
              color: '#fff',
              border: 'none',
              cursor: feedbackComment.trim() ? 'pointer' : 'not-allowed',
              fontWeight: 700,
              fontSize: 11.5,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Send size={12} /> Evolve Rules
          </button>
        </div>

        {(evolutionResult || stages?.learn?.skillEvolution) && (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 8,
              padding: 11,
              fontSize: 11,
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
            }}
          >
            <div style={{ color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={14} /> Active Guardrail Evolution Rule Applied
            </div>
            <div style={{ color: C.text }}>
              <strong>Root Cause:</strong> {(evolutionResult || stages?.learn?.skillEvolution).root_cause}
            </div>
            <div style={{ color: C.textDim, fontFamily: monoFont, fontSize: 10.5, wordBreak: 'break-word' }}>
              <strong>Patches:</strong>{' '}
              {JSON.stringify((evolutionResult || stages?.learn?.skillEvolution).parameter_patches)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
