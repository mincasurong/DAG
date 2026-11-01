import { useState, useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
import { C, monoFont, fmt, type RobotAction, parseAction, parseResult } from './theme';

interface EventTraceProps {
  actions: RobotAction[];
  results: RobotAction[];
  fontSize: number;
}

export default function EventTrace({ actions, results, fontSize }: EventTraceProps) {
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const events = useMemo(() => {
    return actions.map((a) => {
      const pa = parseAction(a.raw);
      const agent = pa.agent || 'Agent_Alpha';
      const res = results.find((r) => {
        const pr = parseResult(r.raw);
        return pr.agent_id === agent && r.ts.getTime() >= a.ts.getTime();
      });
      const pr = res ? parseResult(res.raw) : null;
      return {
        id: a.id,
        ts: a.ts,
        agent,
        event: pa.action.toUpperCase(),
        target: pa.target || 'Shared_Artifact',
        duration: res ? +((res.ts.getTime() - a.ts.getTime()) / 1000).toFixed(1) : null,
        status: res ? (pr?.success ? 'success' : 'failed') : 'active',
      };
    });
  }, [actions, results]);

  const filtered = useMemo(() => {
    return agentFilter ? events.filter((e) => e.agent.includes(agentFilter)) : events;
  }, [events, agentFilter]);

  const copyCSV = () => {
    const header = 'Timestamp,Agent,Event,Target,Duration(s),Status';
    const rows = filtered.map((e) => `${fmt(e.ts)},${e.agent},${e.event},${e.target},${e.duration ?? ''},${e.status}`);
    navigator.clipboard?.writeText([header, ...rows].join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: fontSize - 1, fontWeight: 700, color: C.text }}>Agent Event Trace</span>
        <span style={{ fontSize: 10, color: C.textMuted }}>({filtered.length})</span>
        <div style={{ flex: 1 }} />
        <select value={agentFilter || ''} onChange={(e) => setAgentFilter(e.target.value || null)} style={selectStyle}>
          <option value="">All Agents</option>
          <option value="Agent_Alpha">Agent_Alpha</option>
          <option value="Agent_Beta">Agent_Beta</option>
          <option value="Agent_Gamma">Agent_Gamma</option>
        </select>
        <button onClick={copyCSV} style={{ ...selectStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? 'Copied' : 'CSV'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: C.textMuted, fontSize: fontSize - 2 }}>
            No agent execution events recorded yet
          </div>
        ) : (
          filtered.slice().reverse().map((e) => (
            <div
              key={e.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '64px 92px 86px 1fr 44px',
                gap: 6,
                padding: '6px 6px',
                borderBottom: `1px solid ${C.border}`,
                fontSize: 10.5,
                fontFamily: monoFont,
                alignItems: 'center',
              }}
            >
              <span style={{ color: C.textMuted }}>{fmt(e.ts)}</span>
              <span style={{ color: C.text, fontWeight: 600 }}>{e.agent.replace('Agent_', '')}</span>
              <span style={{ color: C.blue, fontWeight: 700 }}>{e.event}</span>
              <span style={{ color: C.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.target}</span>
              <span style={{ textAlign: 'right', color: e.status === 'success' ? C.green : C.blue }}>
                {e.duration !== null ? `${e.duration}s` : '⏳'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: C.bgInput, color: C.textDim, border: `1px solid ${C.border}`,
  borderRadius: 4, padding: '3px 6px', fontSize: 10.5, outline: 'none',
};
