import { useRef, useEffect, useState, useCallback } from 'react';

// ─── Constants ──────────────────────────────────────────────────────
const GRID_SIZE = 10;
const BASE_CELL_PX = 36;
const MAX_GRID_PX = GRID_SIZE * BASE_CELL_PX; // 360px max
const BASE_AGENT_RADIUS = 6;
const TICK_MS = 200;
const TOTAL_TICKS = 40;
const FAULT_TICK = 16;
const LABEL_TICK = 35;

const COLORS = {
  normal: '#3DB8E8',
  dead: '#991B1B',
  rerouting: '#E8862A',
  deadlocked: '#ff4d4d',
  gridLine: 'rgba(240,237,233,0.08)',
  sparklineGreen: '#047857',
  sparklineRed: '#991B1B',
};

// Fault agent index in each layout — the agent starting at (5,5)
const FAULT_AGENT = { resilient: 8, fragile: 11 };

// ─── Predetermined Agent Layouts ────────────────────────────────────
function makeResilientAgents() {
  // Evenly spread across grid — one agent at center (5,5)
  const positions = [
    [1,1],[3,1],[5,1],[8,2],
    [0,3],[4,3],[7,4],[9,4],
    [5,5],[6,8],[1,7],[5,7],
    [8,7],[3,9],[7,9],
  ];
  return positions.map((p, i) => ({
    id: i, x: p[0], y: p[1],
    targetX: p[0], targetY: p[1],
    prevX: p[0], prevY: p[1],
    state: 'normal',
    lerpT: 1,
  }));
}

function makeFragileAgents() {
  // Clustered in a central corridor — one agent at center (5,5)
  const positions = [
    [3,2],[4,2],[5,2],[6,2],
    [3,3],[4,3],[5,3],[6,3],
    [4,4],[5,4],[4,5],[5,5],
    [3,6],[4,6],[5,6],
  ];
  return positions.map((p, i) => ({
    id: i, x: p[0], y: p[1],
    targetX: p[0], targetY: p[1],
    prevX: p[0], prevY: p[1],
    state: 'normal',
    lerpT: 1,
  }));
}

// ─── Scripted Movement Patterns ─────────────────────────────────────
function getMoveDelta(tick, id) {
  const dirs = [[0,1],[1,0],[0,-1],[-1,0],[0,0]];
  const seed = (tick * 7 + id * 13) % 5;
  return dirs[seed];
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ─── Sparkline Data ─────────────────────────────────────────────────
function generateSparkline(variant) {
  const points = [];
  const DIP_DELAY = 2; // dip starts 2 ticks after fault
  for (let t = 0; t <= TOTAL_TICKS; t++) {
    if (t <= FAULT_TICK + DIP_DELAY) {
      // Flat stable throughput during warmup and brief delay after fault
      points.push(0.85);
    } else if (variant === 'resilient') {
      // Dip then recover
      const elapsed = t - (FAULT_TICK + DIP_DELAY);
      const dip = Math.max(0, 0.4 - elapsed * 0.02);
      const recovery = Math.min(0.8, 0.45 + elapsed * 0.035);
      points.push(elapsed < 5 ? 0.85 - dip : recovery);
    } else {
      // Drop and stay low
      const elapsed = t - (FAULT_TICK + DIP_DELAY);
      const drop = Math.min(0.55, elapsed * 0.08);
      points.push(Math.max(0.2, 0.85 - drop - Math.sin(elapsed * 0.5) * 0.03));
    }
  }
  return points;
}

// ─── Single Grid Component ──────────────────────────────────────────
function SingleGrid({ label, variant, isPlaying }) {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const sparkRef = useRef(null);
  const agentsRef = useRef(variant === 'resilient' ? makeResilientAgents() : makeFragileAgents());
  const tickRef = useRef(0);
  const frameRef = useRef(null);
  const lastTickTime = useRef(0);
  const sparklineData = useRef(generateSparkline(variant));
  const [resultLabel, setResultLabel] = useState(null);
  const sizeRef = useRef({ gridPx: MAX_GRID_PX, cellPx: BASE_CELL_PX, agentR: BASE_AGENT_RADIUS });

  const faultAgentIdx = FAULT_AGENT[variant];

  const resetSimulation = useCallback(() => {
    agentsRef.current = variant === 'resilient' ? makeResilientAgents() : makeFragileAgents();
    tickRef.current = 0;
    lastTickTime.current = 0;
    sparklineData.current = generateSparkline(variant);
    setResultLabel(null);
  }, [variant]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    const sparkCanvas = sparkRef.current;
    if (!wrapper || !canvas || !sparkCanvas) return;

    const ctx = canvas.getContext('2d');
    const sparkCtx = sparkCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      const available = wrapper.clientWidth;
      const gridPx = Math.min(available, MAX_GRID_PX);
      const cellPx = gridPx / GRID_SIZE;
      const agentR = cellPx * (BASE_AGENT_RADIUS / BASE_CELL_PX);
      sizeRef.current = { gridPx, cellPx, agentR };

      canvas.width = gridPx * dpr;
      canvas.height = gridPx * dpr;
      canvas.style.width = gridPx + 'px';
      canvas.style.height = gridPx + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const sparkH = Math.max(24, gridPx * 0.1);
      sparkCanvas.width = gridPx * dpr;
      sparkCanvas.height = sparkH * dpr;
      sparkCanvas.style.width = gridPx + 'px';
      sparkCanvas.style.height = sparkH + 'px';
      sparkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function processTick() {
      const tick = tickRef.current;
      const agents = agentsRef.current;

      if (tick >= TOTAL_TICKS) {
        resetSimulation();
        return;
      }

      // Fault: the center robot crashes
      if (tick === FAULT_TICK) {
        agents[faultAgentIdx].state = 'dead';
      }

      // Cascade propagation from the crashed robot's position
      if (tick > FAULT_TICK && tick < FAULT_TICK + 10) {
        const faultAgent = agents[faultAgentIdx];
        if (variant === 'resilient') {
          agents.forEach(a => {
            if (a.state === 'normal') {
              const dist = Math.abs(a.x - faultAgent.x) + Math.abs(a.y - faultAgent.y);
              if (dist <= 2 && tick < FAULT_TICK + 4) a.state = 'rerouting';
            }
            if (a.state === 'rerouting' && tick > FAULT_TICK + 5) a.state = 'normal';
          });
        } else {
          const elapsed = tick - FAULT_TICK;
          agents.forEach(a => {
            if (a.state === 'normal') {
              const dist = Math.abs(a.x - faultAgent.x) + Math.abs(a.y - faultAgent.y);
              if (dist <= elapsed && dist > 0) a.state = elapsed < 3 ? 'rerouting' : 'deadlocked';
            }
          });
        }
      }

      if (tick === LABEL_TICK) {
        setResultLabel(variant === 'resilient' ? 'RESILIENT' : 'FRAGILE');
      }

      agents.forEach(a => {
        if (a.state !== 'normal') return;
        if (a.id === faultAgentIdx) return; // fault agent stays at center — same position on both grids
        const [dx, dy] = getMoveDelta(tick, a.id);
        const nx = clamp(a.x + dx, 0, GRID_SIZE - 1);
        const ny = clamp(a.y + dy, 0, GRID_SIZE - 1);
        const occupied = agents.some(o => o.id !== a.id && o.x === nx && o.y === ny);
        if (!occupied) { a.prevX = a.x; a.prevY = a.y; a.x = nx; a.y = ny; a.lerpT = 0; }
      });

      tickRef.current++;
    }

    function drawGrid() {
      const { gridPx, cellPx, agentR } = sizeRef.current;
      ctx.clearRect(0, 0, gridPx, gridPx);

      // Grid lines
      ctx.strokeStyle = COLORS.gridLine;
      ctx.lineWidth = 1;
      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath(); ctx.moveTo(i * cellPx, 0); ctx.lineTo(i * cellPx, gridPx); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * cellPx); ctx.lineTo(gridPx, i * cellPx); ctx.stroke();
      }

      // Agents (no tile highlight — fault is shown as a dead robot)
      const agents = agentsRef.current;
      agents.forEach(a => {
        const t = Math.min(a.lerpT, 1);
        const ease = t * (2 - t);
        const vx = a.prevX + (a.x - a.prevX) * ease;
        const vy = a.prevY + (a.y - a.prevY) * ease;
        const px = vx * cellPx + cellPx / 2;
        const py = vy * cellPx + cellPx / 2;

        let color = COLORS.normal;
        if (a.state === 'dead') color = COLORS.dead;
        else if (a.state === 'rerouting') color = COLORS.rerouting;
        else if (a.state === 'deadlocked') color = COLORS.deadlocked;

        ctx.beginPath();
        ctx.arc(px, py, agentR, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        if (a.state === 'dead') {
          ctx.strokeStyle = '#F0EDE9';
          ctx.lineWidth = 2;
          const s = agentR * 0.5;
          ctx.beginPath();
          ctx.moveTo(px - s, py - s); ctx.lineTo(px + s, py + s);
          ctx.moveTo(px + s, py - s); ctx.lineTo(px - s, py + s);
          ctx.stroke();
        }
      });

      agents.forEach(a => { if (a.lerpT < 1) a.lerpT += 0.15; });
    }

    function drawSparkline() {
      const { gridPx } = sizeRef.current;
      const sparkH = sparkCanvas.height / (window.devicePixelRatio || 1);
      const tick = tickRef.current;
      const data = sparklineData.current;

      sparkCtx.clearRect(0, 0, gridPx, sparkH);
      if (tick < 2) return;

      const pointCount = Math.min(tick, data.length);
      const stepX = gridPx / TOTAL_TICKS;

      sparkCtx.beginPath();
      sparkCtx.strokeStyle = variant === 'resilient' ? COLORS.sparklineGreen : COLORS.sparklineRed;
      sparkCtx.lineWidth = 1.5;

      for (let i = 0; i < pointCount; i++) {
        const x = i * stepX;
        const y = sparkH - data[i] * sparkH;
        if (i === 0) sparkCtx.moveTo(x, y);
        else sparkCtx.lineTo(x, y);
      }
      sparkCtx.stroke();

      if (tick >= FAULT_TICK) {
        sparkCtx.strokeStyle = 'rgba(153, 27, 27, 0.4)';
        sparkCtx.lineWidth = 1;
        sparkCtx.setLineDash([3, 3]);
        sparkCtx.beginPath();
        sparkCtx.moveTo(FAULT_TICK * stepX, 0);
        sparkCtx.lineTo(FAULT_TICK * stepX, sparkH);
        sparkCtx.stroke();
        sparkCtx.setLineDash([]);
      }
    }

    let running = true;

    function animate(time) {
      if (!running) return;
      if (isPlaying) {
        if (time - lastTickTime.current >= TICK_MS) {
          lastTickTime.current = time;
          processTick();
        }
      }
      drawGrid();
      drawSparkline();
      frameRef.current = requestAnimationFrame(animate);
    }

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      running = false;
      window.removeEventListener('resize', resize);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isPlaying, variant, faultAgentIdx, resetSimulation]);

  return (
    <div ref={wrapperRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: '1 1 0', minWidth: 0 }}>
      <span style={{
        fontFamily: '"DM Mono", monospace',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        color: '#F0EDE9',
        opacity: 0.5,
      }}>{label}</span>

      <canvas ref={canvasRef} style={{ borderRadius: 4, display: 'block' }} />
      <canvas ref={sparkRef} style={{ display: 'block' }} />

      <span style={{
        fontFamily: '"DM Mono", monospace',
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        fontWeight: 600,
        color: variant === 'resilient' ? '#047857' : '#991B1B',
        opacity: resultLabel ? 0.9 : 0,
        transition: 'opacity 0.4s ease',
        minHeight: 18,
      }}>{resultLabel || '\u00A0'}</span>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────
export default function ThesisScene() {
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          setIsPlaying(entry.isIntersecting);
        });
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '0 16px',
      }}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 32,
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}>
        <SingleGrid label="DISTRIBUTED LOAD" variant="resilient" isPlaying={isPlaying} />
        <SingleGrid label="CONCENTRATED LOAD" variant="fragile" isPlaying={isPlaying} />
      </div>
    </div>
  );
}
