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
        padding: '10px 14px', borderRadius: 12,
        background: C.bgInput,
        border: `1px solid ${C.borderHi}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ fontSize: 22 }}>🌿</div>
        <div>
          <div style={{ fontSize: fontSize - 2, color: C.textDim, fontWeight: 600 }}>Merged Artifacts</div>
          <div style={{ fontSize: fontSize + 4, fontWeight: 800, color: C.yellow }}>
            {mergedCount} <span style={{ fontSize: fontSize - 2, fontWeight: 500, color: C.textDim }}>/ 9 shards</span>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 1.5, alignItems: 'center' }}>
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} style={{
              width: 18, height: 4, borderRadius: 2,
              background: i < mergedCount ? C.yellow : C.border,
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
      </div>

      {lockedBy && (
        <div style={{
          padding: '6px 12px', borderRadius: 8, fontSize: fontSize - 2,
          background: C.yellowBg, border: `1px solid ${C.yellowBorder}`,
          color: C.yellow, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 10 }}>🔒</span>
          M_shared_state locked by {lockedBy}
        </div>
      )}

      {agents.map((agentName) => {
        const a = agentsMap[agentName];
        if (!a) return null;
        const phaseColor = PHASE_COLORS[a.phase] || C.textMuted;

        return (
          <div key={agentName} style={{
            padding: '10px 14px', borderRadius: 12,
            background: C.bgInput,
            border: `1px solid ${C.border}`,
            backdropFilter: 'blur(12px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: C.green,
                boxShadow: `0 0 8px ${C.greenGlow}`,
              }} />
              <div>
                <div style={{ fontWeight: 700, color: C.text, fontSize: fontSize - 1 }}>{agentName}</div>
                {a.role && <div style={{ fontSize: 10, color: C.textDim }}>{a.role}</div>}
              </div>
              <span style={{
                marginLeft: 'auto',
                padding: '2px 8px', borderRadius: 6, fontSize: 9.5, fontWeight: 800,
                background: a.phase !== 'IDLE' ? C.yellowBg : 'transparent',
                color: a.phase !== 'IDLE' ? C.yellow : phaseColor,
                border: `1px solid ${a.phase !== 'IDLE' ? C.yellowBorder : C.border}`,
              }}>{a.phase}</span>
            </div>

            {a.target && (
              <div style={{ fontSize: fontSize - 3, color: C.textDim, marginBottom: 6, fontFamily: monoFont }}>
                ▸ <strong style={{ color: C.yellow }}>{a.target}</strong> ({a.action})
              </div>
            )}

            <div style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.textDim, marginBottom: 3 }}>
                <span>Compute Utilization</span>
                <span style={{ color: C.yellow, fontWeight: 800, fontFamily: monoFont }}>{a.busy_pct}%</span>
              </div>
              <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${a.busy_pct}%`,
                  background: `linear-gradient(90deg, ${C.green}, ${C.yellow})`,
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, fontSize: fontSize - 3, color: C.textDim }}>
              <span>✓ <strong style={{ color: C.yellow }}>{a.tasks_completed}</strong> completed</span>
              {a.tasks_failed > 0 && <span style={{ color: C.red }}>✕ {a.tasks_failed} failed</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
