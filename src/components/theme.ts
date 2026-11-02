export const BACKEND_API = (typeof window !== 'undefined' && (window.location.port === '5173' || window.location.port === '5174'))
  ? 'http://localhost:3001'
  : '';

export const C_light = {
  // White & Light-Green Fluidic Silk Theme (Unified Forest Text + Yellow Emphasis)
  bg:       '#f5fcf8',
  bgChat:   'rgba(255, 255, 255, 0.86)',
  bgSide:   'rgba(242, 252, 246, 0.84)',
  bgInput:  'rgba(255, 255, 255, 0.92)',
  bgHover:  '#dcfce7',
  border:   'rgba(52, 211, 153, 0.34)',
  borderHi: 'rgba(16, 185, 129, 0.55)',

  // Light-Green Primary Accents & Yellow Emphasis
  green:       '#16a34a',
  greenDim:    '#15803d',
  greenGlow:   'rgba(34, 197, 94, 0.20)',
  yellow:      '#b45309',
  yellowBg:    'rgba(254, 240, 138, 0.85)',
  yellowBorder:'rgba(234, 179, 8, 0.65)',

  // Unified Text Colors (Deep Botanical Slate across all labels/body)
  white:     '#062e1e',
  text:      '#062e1e',
  textDim:   '#164e35',
  textMuted: '#3b7a5e',

  red:       '#dc2626',
  redGlow:   'rgba(220, 38, 38, 0.15)',

  blue:      '#16a34a',
  blueGlow:  'rgba(34, 197, 94, 0.18)',
  accent:    '#10b981',
  accentDim: '#059669',
  accentGlow:'rgba(16, 185, 129, 0.22)',

  orange:    '#ca8a04',
  purple:    '#15803d',
  purpleGlow:'rgba(34, 197, 94, 0.18)',
  cyan:      '#0d9488',
  magenta:   '#ca8a04',
  lime:      '#4d7c0f',

  glassBg:   'rgba(255, 255, 255, 0.84)',
  cardBg:    'linear-gradient(135deg, rgba(255,255,255,0.94), rgba(220,252,231,0.72))',

  // Fluidic Light-Green Animated Mesh Gradients
  fluidMesh:
    'radial-gradient(circle at 18% 22%, rgba(74, 222, 128, 0.36) 0%, transparent 46%), ' +
    'radial-gradient(circle at 82% 28%, rgba(110, 231, 183, 0.38) 0%, transparent 48%), ' +
    'radial-gradient(circle at 52% 82%, rgba(167, 243, 208, 0.44) 0%, transparent 52%), ' +
    'radial-gradient(circle at 76% 74%, rgba(253, 224, 71, 0.24) 0%, transparent 40%), ' +
    'linear-gradient(135deg, #ffffff 0%, #ecfdf5 48%, #dcfce7 100%)',
  fluidWave:
    'conic-gradient(from 160deg at 50% 50%, rgba(74, 222, 128, 0.14), rgba(255, 255, 255, 0.0), rgba(110, 231, 183, 0.18), rgba(253, 224, 71, 0.12), rgba(74, 222, 128, 0.14))',

  // Node & Flow Cards
  nodeBg: 'linear-gradient(145deg, rgba(255, 255, 255, 0.94) 0%, rgba(236, 253, 245, 0.92) 100%)',
  nodeBorder: 'rgba(16, 185, 129, 0.32)',
  nodeBorderHi: 'rgba(16, 185, 129, 0.58)',
  nodeShadow: '0 12px 28px -6px rgba(16, 185, 129, 0.16), 0 2px 6px rgba(6, 46, 30, 0.06)',
  subCardBg: 'rgba(220, 252, 231, 0.55)',
  subCardBorder: 'rgba(16, 185, 129, 0.22)',
  subCardText: '#062e1e',

  // Canvas & React Flow
  canvasBg: 'transparent',
  canvasGrid: 'rgba(16, 185, 129, 0.10)',
  canvasGridLines: 'rgba(52, 211, 153, 0.22)',
  canvasGridDots: 'rgba(16, 185, 129, 0.35)',
  edgeColor: '#10b981',

  // HUD Floating Bar
  hudBg: 'rgba(255, 255, 255, 0.85)',
  hudBorder: 'rgba(52, 211, 153, 0.35)',
  hudText: '#062e1e',
  hudTextDim: '#164e35',
  hudShadow: '0 8px 24px rgba(16, 185, 129, 0.12)',

  // Form Controls & Inputs
  inputBg: 'rgba(255, 255, 255, 0.94)',
  inputBorder: 'rgba(52, 211, 153, 0.45)',
  inputText: '#062e1e',
  selectBg: '#ffffff',

  // Minimap & Controls
  controlsBg: 'rgba(255, 255, 255, 0.92)',
  controlsBorder: 'rgba(16, 185, 129, 0.35)',
  miniMapBg: 'rgba(240, 253, 244, 0.92)',
  miniMapBorder: 'rgba(16, 185, 129, 0.35)',
  miniMapMask: 'rgba(16, 185, 129, 0.08)',
};

export const C_dark = {
  // Dark Botanical & Luminous Light-Green Fluidic Theme (Unified Mint-White Text + Yellow Emphasis)
  bg:       '#05130d',
  bgChat:   'rgba(7, 24, 17, 0.80)',
  bgSide:   'rgba(6, 20, 14, 0.78)',
  bgInput:  'rgba(12, 36, 25, 0.78)',
  bgHover:  'rgba(20, 60, 42, 0.85)',
  border:   'rgba(74, 222, 128, 0.24)',
  borderHi: 'rgba(110, 231, 183, 0.48)',

  // Light-Green Primary Accents & Luminous Yellow Emphasis
  green:       '#4ade80',
  greenDim:    '#22c55e',
  greenGlow:   'rgba(74, 222, 128, 0.28)',
  yellow:      '#fde047',
  yellowBg:    'rgba(250, 204, 21, 0.16)',
  yellowBorder:'rgba(253, 224, 71, 0.48)',

  // Unified Text Colors (Soft Mint-Ivory across all labels/body)
  white:     '#f0fdf4',
  text:      '#f0fdf4',
  textDim:   '#bbf7d0',
  textMuted: '#6ee7b7',

  red:       '#f87171',
  redGlow:   'rgba(248, 113, 113, 0.25)',

  blue:      '#4ade80',
  blueGlow:  'rgba(74, 222, 128, 0.28)',
  accent:    '#34d399',
  accentDim: '#10b981',
  accentGlow:'rgba(52, 211, 153, 0.32)',

  orange:    '#fde047',
  purple:    '#6ee7b7',
  purpleGlow:'rgba(110, 231, 183, 0.25)',
  cyan:      '#5eead4',
  magenta:   '#fde047',
  lime:      '#bef264',

  glassBg:   'rgba(6, 20, 14, 0.75)',
  cardBg:    'linear-gradient(145deg, rgba(12, 36, 25, 0.90), rgba(5, 19, 13, 0.92))',

  // Fluidic Light-Green Animated Mesh Gradients
  fluidMesh:
    'radial-gradient(circle at 16% 20%, rgba(74, 222, 128, 0.26) 0%, transparent 45%), ' +
    'radial-gradient(circle at 84% 25%, rgba(52, 211, 153, 0.24) 0%, transparent 48%), ' +
    'radial-gradient(circle at 50% 80%, rgba(16, 185, 129, 0.22) 0%, transparent 52%), ' +
    'radial-gradient(circle at 75% 70%, rgba(253, 224, 71, 0.12) 0%, transparent 38%), ' +
    'linear-gradient(135deg, #04100b 0%, #071f15 50%, #0a291c 100%)',
  fluidWave:
    'conic-gradient(from 160deg at 50% 50%, rgba(74, 222, 128, 0.12), rgba(5, 19, 13, 0.0), rgba(110, 231, 183, 0.14), rgba(253, 224, 71, 0.08), rgba(74, 222, 128, 0.12))',

  // Node & Flow Cards
  nodeBg: 'linear-gradient(145deg, rgba(11, 35, 24, 0.92) 0%, rgba(6, 22, 15, 0.95) 100%)',
  nodeBorder: 'rgba(74, 222, 128, 0.26)',
  nodeBorderHi: 'rgba(110, 231, 183, 0.50)',
  nodeShadow: '0 14px 32px -4px rgba(0, 0, 0, 0.65), 0 0 18px rgba(74, 222, 128, 0.12)',
  subCardBg: 'rgba(14, 44, 30, 0.68)',
  subCardBorder: 'rgba(110, 231, 183, 0.18)',
  subCardText: '#f0fdf4',

  // Canvas & React Flow
  canvasBg: 'transparent',
  canvasGrid: 'rgba(74, 222, 128, 0.08)',
  canvasGridLines: 'rgba(52, 211, 153, 0.15)',
  canvasGridDots: 'rgba(110, 231, 183, 0.28)',
  edgeColor: '#4ade80',

  // HUD Floating Bar
  hudBg: 'rgba(7, 24, 17, 0.82)',
  hudBorder: 'rgba(74, 222, 128, 0.25)',
  hudText: '#f0fdf4',
  hudTextDim: '#bbf7d0',
  hudShadow: '0 8px 32px rgba(0, 0, 0, 0.55)',

  // Form Controls & Inputs
  inputBg: 'rgba(4, 15, 10, 0.62)',
  inputBorder: 'rgba(74, 222, 128, 0.35)',
  inputText: '#f0fdf4',
  selectBg: '#081c13',

  // Minimap & Controls
  controlsBg: 'rgba(8, 28, 19, 0.88)',
  controlsBorder: 'rgba(74, 222, 128, 0.28)',
  miniMapBg: 'rgba(6, 20, 14, 0.88)',
  miniMapBorder: 'rgba(74, 222, 128, 0.28)',
  miniMapMask: 'rgba(4, 15, 10, 0.60)',
};

export const C = Object.keys(C_light).reduce((acc, key) => {
  acc[key as keyof typeof C_light] = `var(--${key})`;
  return acc;
}, {} as typeof C_light);

export interface ChatMessage {
  id: number | string;
  role: 'user' | 'system' | 'architect' | 'vla' | 'generator' | 'verifier';
  text: string;
  ts: Date;
  senderName?: string;
  emoji?: string;
}
export interface LogEntry { id: number; level: number; name: string; msg: string; ts: Date; }
export interface RobotAction { id: number; raw: string; ts: Date; }

export interface AgentMetrics {
  state: string;
  phase: string;
  action: string;
  target: string;
  busy_pct: number;
  idle_pct: number;
  tasks_completed: number;
  tasks_failed: number;
  role?: string;
}

export interface MetricsData {
  timestamp: number;
  agents?: Record<string, AgentMetrics>;
  robots?: Record<string, AgentMetrics>;
  merged_count?: number;
  tower_height?: number;
  shared_state_locked_by?: string | null;
  center_occupied_by?: string | null;
}

export interface MonitoringAnomaly {
  severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  component: string;
  description: string;
}

export interface MonitoringStats {
  total_logs: number;
  errors: number;
  warnings: number;
  guardrail_denies: number;
  pick_success_rate_pct?: number;
  task_success_rate_pct?: number;
}

export interface MonitoringSummary {
  health_score: number;
  status: 'HEALTHY' | 'DEGRADED' | 'ANOMALOUS' | 'CRITICAL';
  executive_summary: string;
  anomalies: MonitoringAnomaly[];
  recommendations: string[];
  timestamp: number;
  model: string;
  stats: MonitoringStats;
}

export const stripAnsi = (s: string) => s ? s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\[[0-9;]+m/g, '').replace(/\[0m/g, '') : '';
export const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const monoFont = "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";

export const PHASE_COLORS: Record<string, string> = {
  RETRIEVING:   C.green,
  SYNTHESIZING: C.yellow,
  HANDOFF:      C.accent,
  QUEUED:       C.yellow,
  IDLE:         C.textMuted,
  INIT:         C.textDim,
  ERROR:        C.red,
};

export const parseAction = (raw: string) => {
  try {
    const o = JSON.parse(raw);
    const agent = o.agent || o.robot || '';
    return {
      action: o.action || '?',
      agent,
      robot: agent,
      target: o.target || '',
      detail: `${agent} ${o.target || ''}`.trim(),
    };
  } catch {
    return { action: '?', agent: '', robot: '', target: '', detail: raw };
  }
};

export const parseResult = (raw: string) => {
  try {
    const o = JSON.parse(raw);
    const agentId = o.agent_id || o.robot_id || '';
    return { success: !!o.success, message: o.message || '', agent_id: agentId, robot_id: agentId };
  } catch {
    return { success: false, message: raw, agent_id: '', robot_id: '' };
  }
};
