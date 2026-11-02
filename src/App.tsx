import { useState, useEffect, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
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
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const t = isDark ? C_dark : C_light;
    for (const [k, v] of Object.entries(t)) {
      document.documentElement.style.setProperty(`--${k}`, v as string);
    }
  }, [isDark]);

  const [mode, setMode] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'builder' | 'pipeline' | 'closed_loop' | 'timeline' | 'telemetry'>('builder');
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [monitoringSummary, setMonitoringSummary] = useState<MonitoringSummary | null>(null);
  const [closedLoopReport, setClosedLoopReport] = useState<any | null>(null);
  const [schedule, setSchedule] = useState<any | null>(null);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [actions, setActions] = useState<RobotAction[]>([]);
  const [actionResults, setActionResults] = useState<RobotAction[]>([]);
  const [engineLogs, setEngineLogs] = useState<string[]>([]);
  const [chatMessages] = useState<ChatMessage[]>([]);

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
          prompt: 'Synthesize a 3-stage multi-agent research report with maximum parallelism',
          mode,
          inject_overflow: true,
          inject_schema_drift: true,
        }),
      }).then((r) => r.json());
      if (res.ok && res.data) {
        setClosedLoopReport(res.data);
        setSchedule(res.data.finalDag?.schedule || null);
        setCertificates(res.data.stages?.validate?.certificates || []);
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
    <div className="fluidic-stage" style={{ width: '100vw', height: '100dvh', display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, overflow: 'hidden', position: 'relative' }}>
      {/* Flowing & Fluidic Light-Green Mesh + SVG Wave Ribbons */}
      <div className="fluidic-backdrop" />
      <div className="fluidic-wave-overlay" />
      <svg
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '38%', pointerEvents: 'none', zIndex: 0, opacity: isDark ? 0.22 : 0.35 }}
      >
        <defs>
          <linearGradient id="fluidGreenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4ade80" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#fde047" stopOpacity="0.40" />
          </linearGradient>
        </defs>
        <path
          fill="url(#fluidGreenGrad)"
          d="M0,160L60,170.7C120,181,240,203,360,192C480,181,600,139,720,138.7C840,139,960,181,1080,197.3C1200,213,1320,203,1380,197.3L1440,192L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
        />
      </svg>
      {/* Responsive Top Studio Header */}
      <header
        style={{
          minHeight: isMobile ? 48 : 54, position: 'relative', zIndex: 2, backdropFilter: 'blur(16px)',
          padding: isMobile ? '6px 10px' : '0 16px',
          background: C.bgChat,
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div
            style={{
              width: isMobile ? 28 : 32,
              height: isMobile ? 28 : 32,
              borderRadius: 9,
              background: 'linear-gradient(135deg, #22c55e, #10b981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 14px rgba(34, 197, 94, 0.4)',
              flexShrink: 0,
            }}
          >
            <GitBranch size={isMobile ? 14 : 17} color="#fff" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? 12.5 : 14, fontWeight: 800, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Multi-Agent</span>
              <span style={{ color: C.yellow, background: C.yellowBg, border: `1px solid ${C.yellowBorder}`, padding: '1px 6px', borderRadius: 6 }}>DAG Studio</span>
            </div>
            {!isMobile && (
              <div style={{ fontSize: 10, color: C.textMuted, fontFamily: monoFont }}>
                Plan (DAG) · Pre-Flight Shield · RCPSP Wavefront · 0-Token Subgraph Recovery
              </div>
            )}
          </div>
        </div>

        {/* Mode Selector & Desktop Navigation Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={mode}
            onChange={(e) => setMode(Number(e.target.value))}
            aria-label="Orchestration Mode"
            style={{
              background: C.inputBg,
              border: `1px solid ${C.inputBorder}`,
              borderRadius: 8,
              color: C.inputText,
              fontSize: isMobile ? 10.5 : 11.5,
              fontWeight: 700,
              padding: isMobile ? '4px 6px' : '6px 10px',
              maxWidth: isMobile ? 132 : undefined,
              cursor: 'pointer',
            }}
          >
            <option value={1}>Mode 1: 3-Agent Parallel Synthesis</option>
            <option value={2}>Mode 2: Event Stream Triage</option>
            <option value={3}>Mode 3: Full-Stack Feature Pipeline</option>
            <option value={4}>Mode 4: Adversarial Cross-Critique</option>
          </select>

          {!isMobile && (
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
                    background: activeTab === key ? 'linear-gradient(135deg, #16a34a, #059669)' : 'transparent',
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
          )}
        </div>

        {/* Right Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {!isMobile && (
            <button
              onClick={handleRunClosedLoopHeader}
              data-testid="header-closed-loop-btn"
              style={{
                padding: '6px 11px',
                borderRadius: 8,
                border: '1px solid rgba(16, 185, 129, 0.45)',
                background: 'rgba(16, 185, 129, 0.15)',
                color: C.green,
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
          )}

          <button
            onClick={handleReset}
            style={{
              padding: isMobile ? '5px 8px' : '6px 10px',
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.inputBg,
              color: C.textDim,
              fontSize: isMobile ? 10.5 : 11,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Reset Workspace"
          >
            <RotateCcw size={12} /> {!isMobile && 'Reset'}
          </button>

          <button
            onClick={() => setIsDark((d) => !d)}
            style={{
              width: isMobile ? 28 : 32,
              height: isMobile ? 28 : 32,
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
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        {/* Left Telemetry & Log Sidebar (Desktop only; on Mobile it is a dedicated full-screen tab) */}
        {!isMobile && (
          <aside
            style={{
              width: 305,
              background: C.bgSide,
              borderRight: `1px solid ${C.border}`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <div style={{ padding: '10px 14px 4px', fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={13} color="#10b981" /> Multi-Agent Telemetry
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <KpiDashboard metrics={metrics} fontSize={13} />
            </div>

            <div style={{ height: 195, borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.25)' }}>
              <div style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}`, fontSize: 10.5, fontWeight: 700, color: C.textDim, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Terminal size={12} color="#38bdf8" /> Rule Engine & Shield Stream
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px', fontFamily: monoFont, fontSize: 10, color: C.textDim, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {engineLogs.length === 0 ? (
                  <div style={{ color: C.textMuted }}>Ready — awaiting multi-agent DAG synthesis...</div>
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
        )}

        {/* Primary Canvas / Monitoring View */}
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
                isMobile={isMobile}
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
                userGoal="Synthesize a 9-shard multi-agent knowledge graph with Pre-Flight Shield & RCPSP Wavefront Scheduling"
                mode={mode}
                isDark={isDark}
                isMobile={isMobile}
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
              isMobile={isMobile}
            />
          )}

          {activeTab === 'timeline' && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', height: '100%', overflowY: 'auto' }}>
              <div style={{ borderRight: isMobile ? 'none' : `1px solid ${C.border}`, borderBottom: isMobile ? `1px solid ${C.border}` : 'none', overflowY: 'auto' }}>
                <GanttChart actions={actions} results={actionResults} metrics={metrics} fontSize={13} />
              </div>
              <div style={{ overflowY: 'auto' }}>
                <EventTrace actions={actions} results={actionResults} fontSize={13} />
              </div>
            </div>
          )}

          {activeTab === 'telemetry' && (
            <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <KpiDashboard metrics={metrics} fontSize={13} />
              <div style={{ margin: '0 14px 14px', border: `1px solid ${C.border}`, borderRadius: 10, background: 'rgba(0,0,0,0.25)', padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Terminal size={12} color="#38bdf8" /> Rule Engine & Shield Stream
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto', fontFamily: monoFont, fontSize: 10, color: C.textDim, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {engineLogs.length === 0 ? (
                    <div style={{ color: C.textMuted }}>Ready — awaiting multi-agent DAG synthesis...</div>
                  ) : (
                    engineLogs.slice(-25).map((line, idx) => (
                      <div key={idx} style={{ wordBreak: 'break-word', lineHeight: 1.35 }}>
                        {line}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Sticky Mobile Bottom Navigation Bar (< 768px) */}
      {isMobile && (
        <nav
          data-testid="mobile-bottom-nav"
          style={{
            height: 56,
            background: C.bgChat,
            borderTop: `1px solid ${C.border}`,
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            flexShrink: 0,
          }}
        >
          {(
            [
              ['builder', 'DAG', Network],
              ['pipeline', 'Agents', GitBranch],
              ['closed_loop', 'Shield', ShieldCheck],
              ['timeline', 'Gantt', Clock],
              ['telemetry', 'Metrics', Activity],
            ] as const
          ).map(([key, label, Icon]) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                data-testid={`mobile-tab-${key}`}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: active ? C.yellow : C.textMuted,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  fontSize: 10,
                  fontWeight: active ? 800 : 600,
                  cursor: 'pointer',
                }}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
