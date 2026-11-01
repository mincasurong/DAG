import { useState, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';
import { C, monoFont, type RobotAction, type MetricsData } from './theme';

interface GanttChartProps {
  actions: RobotAction[];
  results: RobotAction[];
  metrics: MetricsData | null;
  fontSize: number;
}

const ZOOM_LEVELS = [5000, 15000, 30000, 60000];

export default function GanttChart({ actions, results, metrics, fontSize }: GanttChartProps) {
  const [now, setNow] = useState(Date.now());
  const [zoomIdx, setZoomIdx] = useState(1);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);

  const agentsMap = metrics?.agents || metrics?.robots || {};
  const agents = Object.keys(agentsMap).length > 0 ? Object.keys(agentsMap).sort() : ['Agent_Alpha', 'Agent_Beta', 'Agent_Gamma'];
  const windowMs = ZOOM_LEVELS[zoomIdx];

  const tasks: {
    agent: string; action: string; start: number; end: number;
    finished: boolean; success: boolean;
  }[] = [];

  actions.forEach((a) => {
    try {
      const p = JSON.parse(a.raw);
      const rawAgent = String(p.agent || p.robot || 'Agent_Alpha');
      const involved = rawAgent.includes('+') ? ['Agent_Alpha', 'Agent_Beta'] : [rawAgent];
      const actionName = p.action || '?';

      const res = results.find((r) => {
        try {
          const rp = JSON.parse(r.raw);
          const rId = rp.agent_id || rp.robot_id || '';
          return rId === rawAgent && r.ts.getTime() >= a.ts.getTime();
        } catch { return false; }
      });

      for (const ag of involved) {
        tasks.push({
          agent: ag,
          action: actionName,
          start: a.ts.getTime(),
          end: res ? res.ts.getTime() : now,
          finished: !!res,
          success: res ? JSON.parse(res.raw).success : true,
        });
      }
    } catch {}
  });

  const maxTime = now;
  const minTime = maxTime - windowMs;
  const tickInterval = windowMs <= 10000 ? 2000 : windowMs <= 30000 ? 5000 : 10000;
  const firstTick = Math.ceil(minTime / tickInterval) * tickInterval;
  const ticks: number[] = [];
  for (let t = firstTick; t <= maxTime; t += tickInterval) ticks.push(t);

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: fontSize - 1, fontWeight: 700, color: C.text }}>Multi-Agent Wavefront Timeline</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setZoomIdx((i) => Math.max(0, i - 1))} disabled={zoomIdx === 0} style={zoomBtn}><Plus size={10} /></button>
        <span style={{ fontSize: 10, color: C.textMuted, minWidth: 28, textAlign: 'center' }}>{windowMs / 1000}s</span>
        <button onClick={() => setZoomIdx((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))} disabled={zoomIdx === ZOOM_LEVELS.length - 1} style={zoomBtn}><Minus size={10} /></button>
      </div>

      {agents.map((ag) => (
        <div key={ag}>
          <div style={{ fontSize: fontSize - 2, fontWeight: 600, color: C.textDim, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.blue }} />
            {ag}
          </div>
          <div style={{ height: 26, background: C.bgInput, borderRadius: 6, position: 'relative', overflow: 'hidden' }}>
            {tasks.filter((t) => t.agent === ag && t.end > minTime && t.start < maxTime).map((t, i) => {
              const left = Math.max(0, ((t.start - minTime) / windowMs) * 100);
              const width = Math.min(100 - left, ((t.end - Math.max(minTime, t.start)) / windowMs) * 100);
              const color = !t.finished ? C.blue : t.success ? C.green : C.red;
              const durationSec = ((t.end - t.start) / 1000).toFixed(1);
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${left}%`,
                    width: `${Math.max(width, 1.2)}%`,
                    top: 3,
                    bottom: 3,
                    borderRadius: 4,
                    background: color,
                    opacity: 0.88,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 5px',
                    overflow: 'hidden',
                  }}
                >
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#000', whiteSpace: 'nowrap' }}>
                    {t.action.toUpperCase()}{width > 10 ? ` ${durationSec}s` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ position: 'relative', height: 16, marginTop: 2 }}>
        {ticks.map((t) => {
          const left = ((t - minTime) / windowMs) * 100;
          if (left < 0 || left > 100) return null;
          const label = new Date(t).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
          return (
            <div key={t} style={{ position: 'absolute', left: `${left}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 1, height: 4, background: C.border }} />
              <span style={{ fontSize: 8, color: C.textMuted, fontFamily: monoFont, marginTop: 1 }}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const zoomBtn: React.CSSProperties = {
  width: 22, height: 22, borderRadius: 4, border: `1px solid ${C.border}`,
  background: 'transparent', color: C.textDim, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
