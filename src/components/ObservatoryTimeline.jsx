import { useRef, useEffect, useState } from 'react';

// ─── Constants ──────────────────────────────────────────────────────
const TIMELINE_H = 250;
const WARMUP_RATIO = 0.4;
const ANIM_DURATION = 5000; // 5s loop
const PAUSE_DURATION = 1500;

const PHASE_COLORS = {
  warmupFill: 'rgba(10,10,10,0.04)',
  warmupFillDark: 'rgba(240,237,233,0.04)',
  curve: '#047857',
  baseline: 'rgba(10,10,10,0.15)',
  baselineDark: 'rgba(240,237,233,0.15)',
  faultMarker: '#991B1B',
  label: 'rgba(10,10,10,0.4)',
  labelDark: 'rgba(240,237,233,0.4)',
};

// ─── Throughput Curve Data ──────────────────────────────────────────
function generateCurve(steps) {
  const points = [];
  const warmupEnd = Math.floor(steps * WARMUP_RATIO);
  const DIP_DELAY = 3; // dip starts 3 steps after fault line
  for (let i = 0; i < steps; i++) {
    if (i < warmupEnd + DIP_DELAY) {
      // Subtle natural variation during warmup, flat after fault
      const noise = i < warmupEnd
        ? Math.sin(i * 0.4) * 0.008 + Math.cos(i * 0.7) * 0.005
        : 0;
      points.push(0.82 + noise);
    } else {
      const elapsed = (i - (warmupEnd + DIP_DELAY)) / (steps - (warmupEnd + DIP_DELAY));
      // Dip then partial recovery
      const dip = Math.exp(-elapsed * 3) * 0.35;
      const recovery = 0.65 + elapsed * 0.12;
      points.push(Math.min(0.82, recovery - dip + Math.sin(i * 0.2) * 0.02));
    }
  }
  return points;
}

export default function ObservatoryTimeline() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isDarkRef = useRef(false);

  useEffect(() => {
    // Theme detection
    isDarkRef.current = document.documentElement.classList.contains('dark');
    const mutObs = new MutationObserver(() => {
      isDarkRef.current = document.documentElement.classList.contains('dark');
    });
    mutObs.observe(document.documentElement, { attributes: true });
    return () => mutObs.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => setIsPlaying(entry.isIntersecting));
      },
      { threshold: 0.4 }
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

    let width = container.clientWidth;
    const height = TIMELINE_H;
    const curveData = generateCurve(100);

    function resize() {
      width = container.clientWidth;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    let animStart = null;
    let frameId = null;
    let running = true;

    const pad = { top: 40, bottom: 30, left: 0, right: 0 };
    const plotW = () => width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    function draw(time) {
      if (!running) return;

      if (!isPlaying) {
        frameId = requestAnimationFrame(draw);
        return;
      }

      if (!animStart) animStart = time;
      let elapsed = time - animStart;
      const totalCycle = ANIM_DURATION + PAUSE_DURATION;
      elapsed = elapsed % totalCycle;
      const progress = Math.min(elapsed / ANIM_DURATION, 1);

      const dark = isDarkRef.current;
      const pw = plotW();

      ctx.clearRect(0, 0, width, height);

      // ─── Phase bars ───
      const warmupW = pw * WARMUP_RATIO;
      const warmupProgress = Math.min(progress / 0.3, 1); // fill in first 30% of animation

      // Warmup bar
      ctx.fillStyle = dark ? PHASE_COLORS.warmupFillDark : PHASE_COLORS.warmupFill;
      ctx.fillRect(pad.left, pad.top, warmupW * warmupProgress, plotH);

      // Fault injection bar (appears after warmup fills)
      if (progress > 0.3) {
        const faultProgress = Math.min((progress - 0.3) / 0.2, 1);
        ctx.fillStyle = dark ? 'rgba(153,27,27,0.06)' : 'rgba(153,27,27,0.04)';
        ctx.fillRect(pad.left + warmupW, pad.top, (pw - warmupW) * faultProgress, plotH);
      }

      // Phase labels
      const labelColor = dark ? PHASE_COLORS.labelDark : PHASE_COLORS.label;
      ctx.font = '9px "DM Mono", monospace';
      ctx.textAlign = 'center';

      if (warmupProgress > 0.5) {
        ctx.fillStyle = labelColor;
        ctx.globalAlpha = Math.min(1, (warmupProgress - 0.5) * 4);
        ctx.fillText('WARMUP', pad.left + warmupW / 2, pad.top + 16);
        ctx.globalAlpha = 1;
      }

      // "FAULTS ACTIVE" marker
      if (progress > 0.35) {
        const markerX = pad.left + warmupW;
        const opacity = Math.min(1, (progress - 0.35) * 6);

        // Vertical red line
        ctx.strokeStyle = PHASE_COLORS.faultMarker;
        ctx.globalAlpha = opacity;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(markerX, pad.top - 5);
        ctx.lineTo(markerX, pad.top + plotH + 5);
        ctx.stroke();

        // Label
        ctx.fillStyle = PHASE_COLORS.faultMarker;
        ctx.textAlign = 'left';
        ctx.fillText('FAULTS ACTIVE', markerX + 8, pad.top - 8);
        ctx.globalAlpha = 1;

        // Fault injection label
        ctx.fillStyle = labelColor;
        ctx.textAlign = 'center';
        const faultLabelOpacity = Math.min(1, (progress - 0.4) * 4);
        ctx.globalAlpha = faultLabelOpacity;
        ctx.fillText('FAULT INJECTION', pad.left + warmupW + (pw - warmupW) / 2, pad.top + 16);
        ctx.globalAlpha = 1;
      }

      // ─── Throughput curve ───
      if (progress > 0.15) {
        const curveProgress = Math.min((progress - 0.15) / 0.65, 1);
        const pointCount = Math.floor(curveData.length * curveProgress);

        if (pointCount > 1) {
          ctx.beginPath();
          ctx.strokeStyle = PHASE_COLORS.curve;
          ctx.lineWidth = 2;
          ctx.lineJoin = 'round';

          for (let i = 0; i < pointCount; i++) {
            const x = pad.left + (i / (curveData.length - 1)) * pw;
            const y = pad.top + plotH - curveData[i] * plotH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      // ─── Dashed baseline ───
      if (progress > 0.6) {
        const baselineY = pad.top + plotH - 0.82 * plotH;
        const baselineProgress = Math.min((progress - 0.6) / 0.2, 1);
        const baselineW = pw * baselineProgress;

        ctx.strokeStyle = dark ? PHASE_COLORS.baselineDark : PHASE_COLORS.baseline;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(pad.left, baselineY);
        ctx.lineTo(pad.left + baselineW, baselineY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Baseline label
        if (baselineProgress > 0.5) {
          ctx.fillStyle = labelColor;
          ctx.globalAlpha = Math.min(1, (baselineProgress - 0.5) * 4);
          ctx.textAlign = 'right';
          ctx.fillText('BASELINE', pad.left + pw - 4, baselineY - 6);
          ctx.globalAlpha = 1;
        }
      }

      // ─── Throughput label ───
      if (progress > 0.3) {
        ctx.fillStyle = labelColor;
        ctx.textAlign = 'left';
        ctx.globalAlpha = 0.6;
        ctx.save();
        ctx.translate(pad.left - 2, pad.top + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('THROUGHPUT', 0, -4);
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      frameId = requestAnimationFrame(draw);
    }

    frameId = requestAnimationFrame(draw);

    return () => {
      running = false;
      window.removeEventListener('resize', resize);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [isPlaying]);

  return (
    <div ref={containerRef} style={{ width: '100%', maxWidth: 1100, margin: '0 auto' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
    </div>
  );
}
