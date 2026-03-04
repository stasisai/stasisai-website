import { useRef, useEffect, useState } from 'react';

// ─── Constants ──────────────────────────────────────────────────────
const GRID_SIZE = 12;
const TICK_MS = 220;
const TOTAL_TICKS = 34;
const FAULT_TICK = 11;
const CASCADE_LEVELS = 5;
const AGENT_RADIUS = 5;

const CASCADE_COLORS = ['#991B1B', '#E8862A', '#D4A043', '#C4B85E', '#A0C878'];

const COLORS_LIGHT = {
  normal: '#3DB8E8',
  gridLine: 'rgba(10,10,10,0.06)',
};
const COLORS_DARK = {
  normal: '#3DB8E8',
  gridLine: 'rgba(240,237,233,0.08)',
};

// ─── Predetermined agent positions ──────────────────────────────────
function makeAgents() {
  const positions = [
    [2,1],[5,1],[8,1],[10,2],
    [1,3],[4,3],[6,3],[9,3],
    [3,5],[5,5],[7,5],[11,5],
    [1,7],[4,7],[6,7],[9,7],
    [2,9],[5,9],[8,9],[10,10],
  ];
  return positions.map((p, i) => ({
    id: i, x: p[0], y: p[1],
    prevX: p[0], prevY: p[1],
    state: 'normal',
    cascadeLevel: -1,
    lerpT: 1,
  }));
}

function getMoveDelta(tick, id) {
  const dirs = [[0,1],[1,0],[0,-1],[-1,0],[0,0]];
  const seed = (tick * 11 + id * 7) % 5;
  return dirs[seed];
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

const SPREAD_BY_LEVEL = [1, 4, 9, 16, 23];

export default function CascadeScene() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [cascadeDepth, setCascadeDepth] = useState(0);
  const [cascadeSpread, setCascadeSpread] = useState(0);
  const isDarkRef = useRef(false);

  // Theme detection
  useEffect(() => {
    isDarkRef.current = document.documentElement.classList.contains('dark');
    const mutObs = new MutationObserver(() => {
      isDarkRef.current = document.documentElement.classList.contains('dark');
    });
    mutObs.observe(document.documentElement, { attributes: true });
    return () => mutObs.disconnect();
  }, []);

  // Intersection observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => setIsPlaying(entry.isIntersecting));
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const agentsRef = { current: makeAgents() };
    const tickRef = { current: 0 };
    const lastTickTime = { current: 0 };
    let frameId = null;
    let running = true;
    const FAULT_AGENT_ID = 9; // agent at [5,5]
    let faultProcessed = false;
    let peakDepth = 0;
    let peakSpread = 0;

    function resize() {
      const size = Math.min(container.clientWidth, GRID_SIZE * 36);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function getCellPx() {
      return canvas.width / (dpr * GRID_SIZE);
    }

    // Deterministic tick-based phases (no re-cascade bug):
    // 0-10:  normal movement
    // 11:    fault fires
    // 12-16: cascade spreads (1 level per tick)
    // 17-19: hold at max cascade
    // 20-22: recovery (cascade→rerouting→normal)
    // 23-33: resumed normal movement
    // 34:    reset
    const RECOVERY_START = FAULT_TICK + CASCADE_LEVELS + 3; // tick 19

    function processTick() {
      const tick = tickRef.current;
      const agents = agentsRef.current;

      if (tick >= TOTAL_TICKS) {
        agentsRef.current = makeAgents();
        tickRef.current = 0;
        faultProcessed = false;
        peakDepth = 0;
        peakSpread = 0;
        setCascadeDepth(0);
        setCascadeSpread(0);
        return;
      }

      // Phase 1: Fault fires
      if (tick === FAULT_TICK) {
        agents[FAULT_AGENT_ID].state = 'dead';
        agents[FAULT_AGENT_ID].cascadeLevel = 0;
        faultProcessed = true;
        setCascadeDepth(0);
        setCascadeSpread(1);
      }

      // Phase 2: Cascade spreads — exactly 1 level per tick, stops after CASCADE_LEVELS
      const ticksSinceFault = tick - FAULT_TICK;
      if (faultProcessed && ticksSinceFault > 0 && ticksSinceFault <= CASCADE_LEVELS) {
        const faultAgent = agents[FAULT_AGENT_ID];
        const level = ticksSinceFault;
        agents.forEach(a => {
          if (a.state === 'normal') {
            const dist = Math.abs(a.x - faultAgent.x) + Math.abs(a.y - faultAgent.y);
            if (dist <= level * 2 + 1) {
              a.state = 'cascade';
              a.cascadeLevel = Math.min(level, CASCADE_LEVELS - 1);
            }
          }
        });

        const newDepth = Math.min(level, 4);
        const spreadIdx = Math.min(level, SPREAD_BY_LEVEL.length - 1);
        const newSpread = SPREAD_BY_LEVEL[spreadIdx];
        if (newDepth > peakDepth) { peakDepth = newDepth; setCascadeDepth(peakDepth); }
        if (newSpread > peakSpread) { peakSpread = newSpread; setCascadeSpread(peakSpread); }
      }

      // Phase 3: Recovery — cascade→rerouting, then rerouting→normal
      if (faultProcessed && tick >= RECOVERY_START) {
        const recoveryTick = tick - RECOVERY_START;
        if (recoveryTick === 0) {
          agents.forEach(a => { if (a.state === 'cascade') a.state = 'rerouting'; });
        }
        if (recoveryTick >= 3) {
          agents.forEach(a => {
            if (a.state === 'rerouting') { a.state = 'normal'; a.cascadeLevel = -1; }
          });
        }
      }

      // Move normal agents
      agents.forEach(a => {
        if (a.state !== 'normal') return;
        const [dx, dy] = getMoveDelta(tick, a.id);
        const nx = clamp(a.x + dx, 0, GRID_SIZE - 1);
        const ny = clamp(a.y + dy, 0, GRID_SIZE - 1);
        const occupied = agents.some(o => o.id !== a.id && o.x === nx && o.y === ny);
        if (!occupied) {
          a.prevX = a.x;
          a.prevY = a.y;
          a.x = nx;
          a.y = ny;
          a.lerpT = 0;
        }
      });

      tickRef.current++;
    }

    function draw() {
      const cellPx = getCellPx();
      const gridPx = cellPx * GRID_SIZE;
      const dark = isDarkRef.current;
      const colors = dark ? COLORS_DARK : COLORS_LIGHT;

      ctx.clearRect(0, 0, gridPx, gridPx);

      // Grid lines
      ctx.strokeStyle = colors.gridLine;
      ctx.lineWidth = 1;
      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellPx, 0);
        ctx.lineTo(i * cellPx, gridPx);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cellPx);
        ctx.lineTo(gridPx, i * cellPx);
        ctx.stroke();
      }

      // Agents
      const agents = agentsRef.current;
      agents.forEach(a => {
        const t = Math.min(a.lerpT, 1);
        const ease = t * (2 - t);
        const vx = a.prevX + (a.x - a.prevX) * ease;
        const vy = a.prevY + (a.y - a.prevY) * ease;
        const px = vx * cellPx + cellPx / 2;
        const py = vy * cellPx + cellPx / 2;

        let color = colors.normal;
        if (a.state === 'dead') {
          color = CASCADE_COLORS[0];
        } else if (a.state === 'cascade') {
          color = CASCADE_COLORS[Math.min(a.cascadeLevel, CASCADE_COLORS.length - 1)];
        } else if (a.state === 'rerouting') {
          color = '#E8862A';
        }

        // Cascade glow
        if (a.state === 'cascade' || a.state === 'dead') {
          ctx.beginPath();
          ctx.arc(px, py, AGENT_RADIUS + 4, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.15;
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.beginPath();
        ctx.arc(px, py, AGENT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Dead X marker
        if (a.state === 'dead') {
          const textColor = dark ? '#F0EDE9' : '#F5F2EE';
          ctx.strokeStyle = textColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px - 3, py - 3);
          ctx.lineTo(px + 3, py + 3);
          ctx.moveTo(px + 3, py - 3);
          ctx.lineTo(px - 3, py + 3);
          ctx.stroke();
        }

        if (a.lerpT < 1) a.lerpT += 0.15;
      });
    }

    function animate(time) {
      if (!running) return;

      if (isPlaying) {
        if (time - lastTickTime.current >= TICK_MS) {
          lastTickTime.current = time;
          processTick();
        }
      }

      draw();
      frameId = requestAnimationFrame(animate);
    }

    frameId = requestAnimationFrame(animate);

    return () => {
      running = false;
      window.removeEventListener('resize', resize);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [isPlaying]);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block', maxWidth: '100%', borderRadius: 4,
        }}
      />
      <div style={{
        display: 'flex',
        gap: 48,
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          padding: '12px 20px',
          border: '1px solid var(--border)',
          borderRadius: 8,
          minWidth: 140,
        }}>
          <span style={{
            fontFamily: '"DM Mono", monospace', fontSize: 9, textTransform: 'uppercase',
            letterSpacing: '0.15em', color: 'var(--text)', opacity: 0.4,
          }}>CASCADE DEPTH</span>
          <span style={{
            fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400,
            color: 'var(--red)', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
          }}>{cascadeDepth}</span>
          <span style={{
            fontFamily: '"DM Mono", monospace', fontSize: 9, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--text)', opacity: 0.3,
          }}>levels</span>
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          padding: '12px 20px',
          border: '1px solid var(--border)',
          borderRadius: 8,
          minWidth: 140,
        }}>
          <span style={{
            fontFamily: '"DM Mono", monospace', fontSize: 9, textTransform: 'uppercase',
            letterSpacing: '0.15em', color: 'var(--text)', opacity: 0.4,
          }}>CASCADE SPREAD</span>
          <span style={{
            fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400,
            color: '#E8862A', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
          }}>{cascadeSpread}</span>
          <span style={{
            fontFamily: '"DM Mono", monospace', fontSize: 9, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--text)', opacity: 0.3,
          }}>agents</span>
        </div>
      </div>
    </div>
  );
}
