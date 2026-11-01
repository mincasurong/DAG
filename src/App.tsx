import { useState, useEffect, useCallback } from 'react';
import {
  ReactFlowProvider,
} from '@xyflow/react';
import {
  Network,
  Clock,
  Activity,
  Moon,
  Sun,
  RotateCcw,
  RefreshCw,
  ShieldCheck,
  Terminal,
  GitBranch,
} from 'lucide-react';
import {
  BACKEND_API,
  C,
  C_light,
  C_dark,
  monoFont,
  type ChatMessage,
  type RobotAction,
  type MetricsData,
  type MonitoringSummary,
} from './components/theme';
import KpiDashboard from './components/KpiDashboard';
import GanttChart from './components/GanttChart';
import EventTrace from './components/EventTrace';
import { AgentWorkflowGraph } from './components/AgentWorkflowGraph';
import VisualWorkflowBuilder from './components/VisualWorkflowBuilder';
import ClosedLoopMonitor from './components/ClosedLoopMonitor';

export default function App() {
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const t = isDark ? C_dark : C_light;
    for (const [k, v] of Object.entries(t)) {
      document.documentElement.style.setProperty(`--${k}`, v as string);
    }
  }, [isDark]);

  const [mode, setMode] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'builder' | 'pipeline' | 'closed_loop' | 'timeline'>('builder');
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [monitoringSummary, setMonitoringSummary] = useState<MonitoringSummary | null>(null);
  const [closedLoopReport, setClosedLoopReport] = useState<any | null>(null);
  const [schedule, setSchedule] = useState<any | null>(null);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [actions, setActions] = useState<RobotAction[]>([]);
  const [actionResults, setActionResults] = useState<RobotAction[]>([]);
  const [engineLogs, setEngineLogs] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: 'generator',
      senderName: 'Rule-Based Generator',
      emoji: '📋',
      text: 'Grounded 3-Arm Parallel Tower Blueprint ready (FR3_1: Table 1, FR3_2: Table 2, FR3_3: Table 3).',
      ts: new Date(),
    },
    {
      id: 2,
      role: 'vla',
      senderName: 'ATAMP Wavefront Planner',
      emoji: '🦾',
      text: 'Synthesized parallel pick wavefronts + M_center mutex-serialized placements (0 violations).',
      ts: new Date(),
    },
  ]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_API}/api/status`).then((r) => r.json());
      if (res.ok) {
        setMetrics(res.metrics);
        setMonitoringSummary(res.monitoring_summary);
        if (res.closed_loop_history?.length > 0) {
          setClosedLoopReport(res.closed_loop_history[res.closed_loop_history.length - 1]);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    let es: EventSource | null = null;
    try {
      es = new EventSource(`${BACKEND_API}/api/logs`);
      es.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.type === 'log' && d.line) {
            setEngineLogs((prev) => [...prev.slice(-150), d.line]);
          }
          if (d.metrics) setMetrics(d.metrics);
          if (d.monitoring_summary) setMonitoringSummary(d.monitoring_summary);
          if (d.type === 'action' && d.action) {
            setActions((prev) => [...prev.slice(-80), { ...d.action, ts: new Date(d.action.ts) }]);
          }
          if (d.type === 'action_result' && d.result) {
            setActionResults((prev) => [...prev.slice(-80), { ...d.result, ts: new Date(d.result.ts) }]);
          }
          if (d.type === 'closed_loop' && d.report) {
            setClosedLoopReport(d.report);
          }
        } catch {}
      };
    } catch {}
    return () => es?.close();
  }, [fetchStatus]);

  const handlePublishAction = useCallback(async (actionMsg: any) => {
    try {
      const res = await fetch(`${BACKEND_API}/api/workflow/execute-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actionMsg),
      }).then((r) => r.json());
      if (res.metrics) setMetrics(res.metrics);
      return { success: Boolean(res.success), message: res.message || 'Done' };
    } catch (e) {
      return { success: false, message: String(e) };
    }
  }, []);

  const handleRunClosedLoopHeader = async () => {
    try {
      const res = await fetch(`${BACKEND_API}/api/closed-loop/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Build a 3-layer tower with maximum parallelism',
          mode,
          inject_overhang: true,
          inject_pose_slip: true,
        }),
      }).then((r) => r.json());
      if (res.ok && res.data) {
        setClosedLoopReport(res.data);
        setSchedule(res.data.finalDag?.schedule || null);
        setCertificates(res.data.stages?.validate?.certificates || []);
        setChatMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            role: 'verifier',
            senderName: 'Closed-Loop Verifier',
            emoji: '🛡️',
            text: `Closed-Loop PASS: Repaired ${res.data.stages.validate.certificatesIntercepted} Shield violation(s) & spliced 3-node recovery [${res.data.stages.revise.splicedNodeIds.join(' -> ')}].`,
            ts: new Date(),
          },
        ]);
        fetchStatus();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReset = async () => {
    await fetch(`${BACKEND_API}/api/reset`, { method: 'POST' });
    setActions([]);
    setActionResults([]);
    setClosedLoopReport(null);
    fetchStatus();
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, overflow: 'hidden' }}>
      {/* Top Studio Header */}
      <header
        style={{
          height: 54,
          padding: '0 16px',
          background: C.bgChat,
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 14px rgba(139, 92, 246, 0.4)',
            }}
          >
            <GitBranch size={17} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text, letterSpacing: '-0.01em' }}>
              ATAMP Rule-Based DAG Studio
            </div>
            <div style={{ fontSize: 10, color: C.textMuted, fontFamily: monoFont }}>
              Plan (DAG) · Pre-Flight Shield · RCPSP Wavefront · 0-Token Subgraph Recovery
            </div>
          </div>
        </div>

        {/* Mode Selector & Navigation Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={mode}
            onChange={(e) => setMode(Number(e.target.value))}
            aria-label="Workcell Mode"
            style={{
              background: C.inputBg,
              border: `1px solid ${C.inputBorder}`,
              borderRadius: 8,
              color: C.inputText,
              fontSize: 11.5,
              fontWeight: 700,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            <option value={1}>Mode 1: 3-Arm Parallel Tower</option>
            <option value={2}>Mode 2: 50Hz Conveyor Stream</option>
            <option value={3}>Mode 3: Flexible Basket Packing</option>
            <option value={5}>Mode 5: Bimanual LongBar Wave</option>
          </select>

          <div style={{ display: 'flex', background: C.bgInput, padding: 3, borderRadius: 9, border: `1px solid ${C.border}`, gap: 3 }}>
            {(
              [
                ['builder', 'Visual DAG Builder', Network],
                ['pipeline', 'Agent & Rule Graph', GitBranch],
                ['closed_loop', 'Closed-Loop & Shield', ShieldCheck],
                ['timeline', 'Gantt & Event Trace', Clock],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                data-testid={`tab-${key}`}
                style={{
                  padding: '5px 11px',
                  borderRadius: 6,
                  border: 'none',
                  background: activeTab === key ? 'linear-gradient(135deg, #3b82f6, #6d28d9)' : 'transparent',
                  color: activeTab === key ? '#fff' : C.textDim,
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleRunClosedLoopHeader}
            data-testid="header-closed-loop-btn"
            style={{
              padding: '6px 11px',
              borderRadius: 8,
              border: '1px solid rgba(16, 185, 129, 0.45)',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <RefreshCw size={12} /> Auto-Verify Loop
          </button>

          <button
            onClick={handleReset}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.inputBg,
              color: C.textDim,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <RotateCcw size={12} /> Reset
          </button>

          <button
            onClick={() => setIsDark((d) => !d)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.inputBg,
              color: C.text,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Toggle Dark/Light Theme"
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      {/* Main Split Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Telemetry & Log Sidebar */}
        <aside
          style={{
            width: 310,
            background: C.bgSide,
            borderRight: `1px solid ${C.border}`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <div style={{ padding: '10px 14px 4px', fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={13} color="#10b981" /> Multi-Arm Workcell Telemetry
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <KpiDashboard metrics={metrics} fontSize={13} />
          </div>

          {/* Live Engine Log Stream */}
          <div style={{ height: 195, borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}`, fontSize: 10.5, fontWeight: 700, color: C.textDim, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Terminal size={12} color="#38bdf8" /> Rule Engine & Shield Stream
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px', fontFamily: monoFont, fontSize: 10, color: C.textDim, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {engineLogs.length === 0 ? (
                <div style={{ color: C.textMuted }}>Ready — awaiting DAG synthesis or execution...</div>
              ) : (
                engineLogs.slice(-25).map((line, idx) => (
                  <div key={idx} style={{ wordBreak: 'break-word', lineHeight: 1.35 }}>
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* Right Primary Canvas / Monitoring View */}
        <main style={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative' }}>
          {activeTab === 'builder' && (
            <ReactFlowProvider>
              <VisualWorkflowBuilder
                onPublishAction={handlePublishAction}
                onClosedLoopComplete={(rep) => {
                  setClosedLoopReport(rep);
                  setSchedule(rep.finalDag?.schedule || null);
                  setCertificates(rep.stages?.validate?.certificates || []);
                }}
                onScheduleUpdated={(sched, certs) => {
                  setSchedule(sched);
                  setCertificates(certs);
                }}
                mode={mode}
                isDark={isDark}
              />
            </ReactFlowProvider>
          )}

          {activeTab === 'pipeline' && (
            <ReactFlowProvider>
              <AgentWorkflowGraph
                metrics={metrics}
                chatMessages={chatMessages}
                actions={actions}
                results={actionResults}
                userGoal="Build a 9-layer tower on the central target table with Pre-Flight Shield & RCPSP Wavefront Scheduling"
                mode={mode}
                brainMode="argon_optimized"
                isDark={isDark}
              />
            </ReactFlowProvider>
          )}

          {activeTab === 'closed_loop' && (
            <ClosedLoopMonitor
              summary={monitoringSummary}
              closedLoopReport={closedLoopReport}
              schedule={schedule}
              certificates={certificates}
              onTriggerAudit={fetchStatus}
              onTriggerClosedLoop={handleRunClosedLoopHeader}
            />
          )}

          {activeTab === 'timeline' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%', overflow: 'hidden' }}>
              <div style={{ borderRight: `1px solid ${C.border}`, overflowY: 'auto' }}>
                <GanttChart actions={actions} results={actionResults} metrics={metrics} fontSize={13} />
              </div>
              <div style={{ overflowY: 'auto' }}>
                <EventTrace actions={actions} results={actionResults} fontSize={13} />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
