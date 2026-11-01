import { C, PHASE_COLORS, monoFont, type MetricsData } from './theme';

interface KpiDashboardProps {
  metrics: MetricsData | null;
  fontSize: number;
}

export default function KpiDashboard({ metrics, fontSize }: KpiDashboardProps) {
  const agentsMap = metrics?.agents || metrics?.robots || {};
  const agents = Object.keys(agentsMap).length > 0
    ? Object.keys(agentsMap).sort()
    : ['Agent_Alpha', 'Agent_Beta', 'Agent_Gamma'];

  if (!metrics) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.textMuted, fontSize: fontSize - 1 }}>
        Waiting for multi-agent telemetry...
      </div>
    );
  }

  const mergedCount = metrics.merged_count ?? metrics.tower_height ?? 0;
  const lockedBy = metrics.shared_state_locked_by ?? metrics.center_occupied_by ?? null;

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Shared Knowledge Graph Merged Artifacts Indicator */}
      <div style={{
        padding: '10px 14px', borderRadius: 10,
        background: `linear-gradient(135deg, ${C.accent}15, ${C.accent}08)`,
        border: `1px solid ${C.accent}30`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ fontSize: 22 }}>🧠</div>
        <div>
          <div style={{ fontSize: fontSize - 2, color: C.textDim, fontWeight: 600 }}>Merged Artifacts</div>
          <div style={{ fontSize: fontSize + 4, fontWeight: 800, color: C.accent }}>
            {mergedCount} <span style={{ fontSize: fontSize - 2, fontWeight: 400, color: C.textDim }}>/ 9 shards</span>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 1, alignItems: 'center' }}>
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} style={{
              width: 16, height: 4, borderRadius: 1,
              background: i < mergedCount ? C.accent : `${C.textMuted}30`,
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
      </div>

      {/* Shared-state mutex indicator */}
      {lockedBy && (
        <div style={{
          padding: '6px 12px', borderRadius: 8, fontSize: fontSize - 2,
          background: `${C.orange}12`, border: `1px solid ${C.orange}30`,
          color: C.orange, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 10 }}>🔒</span>
          M_shared_state locked by {lockedBy}
        </div>
      )}

      {/* Per-agent cards */}
      {agents.map((agentName) => {
        const a = agentsMap[agentName];
        if (!a) return null;
        const phaseColor = PHASE_COLORS[a.phase] || C.textMuted;

        return (
          <div key={agentName} style={{
            padding: '10px 14px', borderRadius: 10,
            background: C.bgInput,
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: phaseColor,
                boxShadow: a.phase !== 'IDLE' ? `0 0 8px ${phaseColor}80` : 'none',
              }} />
              <div>
                <div style={{ fontWeight: 700, color: C.text, fontSize: fontSize - 1 }}>{agentName}</div>
                {a.role && <div style={{ fontSize: 10, color: C.textMuted }}>{a.role}</div>}
              </div>
              <span style={{
                marginLeft: 'auto',
                padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                background: `${phaseColor}20`, color: phaseColor,
                border: `1px solid ${phaseColor}40`,
              }}>{a.phase}</span>
            </div>

            {a.target && (
              <div style={{ fontSize: fontSize - 3, color: C.textDim, marginBottom: 6, fontFamily: monoFont }}>
                {a.action === 'retrieve' ? '📥' : '⚡'} {a.target} ({a.action})
              </div>
            )}

            <div style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.textMuted, marginBottom: 3 }}>
                <span>Compute Utilization</span>
                <span style={{ color: C.green, fontWeight: 600 }}>{a.busy_pct}%</span>
              </div>
              <div style={{ height: 6, background: `${C.textMuted}20`, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${a.busy_pct}%`,
                  background: `linear-gradient(90deg, ${C.green}, ${C.accent})`,
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, fontSize: fontSize - 3, color: C.textDim }}>
              <span>✅ {a.tasks_completed} completed</span>
              {a.tasks_failed > 0 && <span style={{ color: C.red }}>❌ {a.tasks_failed} failed</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
