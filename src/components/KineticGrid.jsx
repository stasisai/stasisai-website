import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Constants ──────────────────────────────────────────────────────
const GRID_W = 12;
const GRID_H = 10;
const NUM_AGENTS = 8;
const TICK_INTERVAL = 0.45;
const CELL_SIZE = 1.0;
const WAVE_MAX_RADIUS = 40;
const WAVE_SPEED = 0.08;
const RING_LIFETIME = 0.55;

const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];

function manhattan(ax, ay, bx, by) {
    return Math.abs(ax - bx) + Math.abs(ay - by);
}

function astar(sx, sy, gx, gy, blocked, gridW, gridH) {
    const key = (x, y) => `${x},${y}`;
    if (sx === gx && sy === gy) return [{ x: sx, y: sy }];
    const open = [{ x: sx, y: sy, g: 0, f: manhattan(sx, sy, gx, gy), parent: null }];
    const closed = new Set();
    while (open.length > 0) {
        open.sort((a, b) => a.f - b.f);
        const cur = open.shift();
        const ck = key(cur.x, cur.y);
        if (closed.has(ck)) continue;
        closed.add(ck);
        if (cur.x === gx && cur.y === gy) {
            const path = [];
            let n = cur;
            while (n) { path.unshift({ x: n.x, y: n.y }); n = n.parent; }
            return path;
        }
        for (const [dx, dy] of DIRS) {
            const nx = cur.x + dx;
            const ny = cur.y + dy;
            if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
            const nk = key(nx, ny);
            if (blocked.has(nk) || closed.has(nk)) continue;
            open.push({ x: nx, y: ny, g: cur.g + 1, f: cur.g + 1 + manhattan(nx, ny, gx, gy), parent: cur });
        }
    }
    return null;
}

function randomFreeCell(gridW, gridH, occupied) {
    let att = 0;
    while (att < 300) {
        const x = Math.floor(Math.random() * gridW);
        const y = Math.floor(Math.random() * gridH);
        if (!occupied.has(`${x},${y}`)) return { x, y };
        att++;
    }
    return { x: 0, y: 0 };
}

// ─── Robot Model ────────────────────────────────────────────────────
function makeRobotModel() {
    const group = new THREE.Group();
    const baseMat = new THREE.MeshStandardMaterial({ color: '#D1D5DB', roughness: 0.7, metalness: 0.1 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.7), baseMat);
    base.position.y = 0.08;
    group.add(base);

    const topMat = new THREE.MeshStandardMaterial({ color: '#E5E7EB', roughness: 0.6, metalness: 0.1 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.05, 0.58), topMat);
    top.position.y = 0.19;
    group.add(top);

    const domeMat = new THREE.MeshStandardMaterial({ color: '#9CA3AF', roughness: 0.5, metalness: 0.2 });
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.05, 8), domeMat);
    dome.position.y = 0.245;
    group.add(dome);

    const lightMat = new THREE.MeshStandardMaterial({ color: '#34D399', emissive: '#34D399', emissiveIntensity: 0.6 });
    const light = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12), lightMat);
    light.position.y = 0.28;
    light.name = 'indicator';
    group.add(light);

    const wheelMat = new THREE.MeshStandardMaterial({ color: '#4B5563', roughness: 0.9, metalness: 0.1 });
    const wheelGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.07, 8);
    [[-0.26, 0.055, -0.26], [0.26, 0.055, -0.26], [-0.26, 0.055, 0.26], [0.26, 0.055, 0.26]].forEach(([wx, wy, wz]) => {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.position.set(wx, wy, wz);
        w.rotation.z = Math.PI / 2;
        group.add(w);
    });

    const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.004, 0.035),
        new THREE.MeshStandardMaterial({ color: '#374151', roughness: 0.3 })
    );
    stripe.position.set(0, 0.165, -0.305);
    group.add(stripe);
    return group;
}

// ─── Wave Ring Cell (individual mesh, NOT instancedMesh) ────────────
// Each cell in the ring is a simple flat box that scales up then down.
function WaveCell({ x, z, birthTime, clock }) {
    const meshRef = useRef();
    const matRef = useRef();

    useFrame(() => {
        if (!meshRef.current || !matRef.current) return;
        const age = clock.current - birthTime;
        if (age < 0 || age > RING_LIFETIME) {
            meshRef.current.visible = false;
            return;
        }
        meshRef.current.visible = true;
        // Bell curve: fade in, peak, fade out
        const norm = age / RING_LIFETIME;
        const pulse = Math.sin(norm * Math.PI);
        meshRef.current.scale.set(0.92 * pulse, 0.02, 0.92 * pulse);
        matRef.current.opacity = 0.45 * pulse;
    });

    return (
        <mesh ref={meshRef} position={[x, 0.015, z]} visible={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial ref={matRef} color="#991B1B" transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
    );
}

// ─── Simulation ─────────────────────────────────────────────────────
function Simulation({ stasisCell, hoveredCell }) {
    const robotRefs = useRef([]);
    const hoverMeshRef = useRef();
    const simRef = useRef(null);
    const tickTimer = useRef(0);

    // Wave
    const [waveCellList, setWaveCellList] = useState([]); // array of {key, x, z, birthTime}
    const waveFront = useRef(new Set());
    const waveProcessed = useRef(new Set());
    const waveActive = useRef(false);
    const waveTimer = useRef(0);
    const waveRadius = useRef(0);
    const clockRef = useRef(0);
    const hasFaulted = useRef(false);

    const offsetX = -(GRID_W - 1) / 2;
    const offsetZ = -(GRID_H - 1) / 2;

    if (simRef.current === null) {
        const occupiedSet = new Set();
        const agents = [];
        for (let i = 0; i < NUM_AGENTS; i++) {
            const start = randomFreeCell(GRID_W, GRID_H, occupiedSet);
            occupiedSet.add(`${start.x},${start.y}`);
            const goal = randomFreeCell(GRID_W, GRID_H, new Set(occupiedSet));
            agents.push({
                id: i, cx: start.x, cy: start.y,
                prevX: start.x, prevY: start.y,
                gx: goal.x, gy: goal.y, path: [],
                isFaulted: false, lerpT: 1,
                priority: NUM_AGENTS - i,
                hue: 0.55 + (i / NUM_AGENTS) * 0.15,
            });
        }
        simRef.current = { agents };
    }

    const sim = simRef.current;

    // Handle one-shot click
    useEffect(() => {
        if (stasisCell && !hasFaulted.current) {
            hasFaulted.current = true;
            waveFront.current = new Set();
            waveProcessed.current = new Set();
            waveActive.current = true;
            waveRadius.current = 0;
            waveTimer.current = 0;

            const seedKey = `${stasisCell.x},${stasisCell.y}`;
            const seedWorldX = (stasisCell.x + offsetX) * CELL_SIZE;
            const seedWorldZ = (stasisCell.y + offsetZ) * CELL_SIZE;

            waveFront.current.add(seedKey);
            waveProcessed.current.add(seedKey);

            setWaveCellList([{ key: seedKey, x: seedWorldX, z: seedWorldZ, birthTime: clockRef.current }]);

            sim.agents.forEach(a => {
                if (a.cx === stasisCell.x && a.cy === stasisCell.y) {
                    a.isFaulted = true;
                }
            });
        }
    }, [stasisCell, sim, offsetX, offsetZ]);

    const faultColor = useMemo(() => new THREE.Color('#991B1B'), []);

    useFrame((_, delta) => {
        if (!sim) return;
        const { agents } = sim;
        clockRef.current += delta;

        // ─── Wave Propagation ───
        if (waveActive.current) {
            waveTimer.current += delta;
            if (waveTimer.current >= WAVE_SPEED) {
                waveTimer.current = 0;
                waveRadius.current++;
                if (waveRadius.current > WAVE_MAX_RADIUS) {
                    waveActive.current = false;
                } else {
                    const nextFront = new Set();
                    const newCells = [];
                    for (const key of waveFront.current) {
                        const [fx, fy] = key.split(',').map(Number);
                        for (const [dx, dy] of DIRS) {
                            const nx = fx + dx;
                            const ny = fy + dy;
                            const nk = `${nx},${ny}`;
                            if (waveProcessed.current.has(nk)) continue;

                            waveProcessed.current.add(nk);
                            nextFront.add(nk);

                            const worldX = (nx + offsetX) * CELL_SIZE;
                            const worldZ = (ny + offsetZ) * CELL_SIZE;
                            newCells.push({ key: nk, x: worldX, z: worldZ, birthTime: clockRef.current });
                        }
                    }
                    waveFront.current = nextFront;
                    if (newCells.length > 0) {
                        setWaveCellList(prev => [...prev, ...newCells]);
                    }
                }
            }
        }

        // Fault Catch-All: any agent currently on or moving through a processed wave cell gets faulted
        if (hasFaulted.current) {
            agents.forEach(a => {
                if (!a.isFaulted && (waveProcessed.current.has(`${a.cx},${a.cy}`) || waveProcessed.current.has(`${a.prevX},${a.prevY}`))) {
                    a.isFaulted = true;
                }
            });
        }

        // ─── PIBT Tick ───
        tickTimer.current += delta;
        if (tickTimer.current >= TICK_INTERVAL) {
            tickTimer.current = 0;
            const reserved = new Map();
            agents.forEach(a => {
                if (a.isFaulted) reserved.set(`${a.cx},${a.cy}`, a.id);
            });
            const sorted = [...agents].filter(a => !a.isFaulted).sort((a, b) => b.priority - a.priority);
            for (const agent of sorted) {
                if (agent.cx === agent.gx && agent.cy === agent.gy) {
                    const newGoal = randomFreeCell(GRID_W, GRID_H, new Set());
                    agent.gx = newGoal.x; agent.gy = newGoal.y; agent.path = [];
                }
                if (agent.path.length === 0) {
                    const blocked = new Set(reserved.keys());
                    agents.forEach(o => { if (o.id !== agent.id) blocked.add(`${o.cx},${o.cy}`); });
                    blocked.delete(`${agent.cx},${agent.cy}`);
                    const p = astar(agent.cx, agent.cy, agent.gx, agent.gy, blocked, GRID_W, GRID_H);
                    if (p && p.length > 1) agent.path = p.slice(1);
                }
                let moved = false;
                if (agent.path.length > 0) {
                    const next = agent.path[0];
                    const nk = `${next.x},${next.y}`;
                    const occ = agents.some(o => o.id !== agent.id && o.cx === next.x && o.cy === next.y);
                    if (!reserved.has(nk) && !occ) {
                        agent.prevX = agent.cx; agent.prevY = agent.cy;
                        agent.cx = next.x; agent.cy = next.y;
                        agent.lerpT = 0; agent.path.shift();
                        reserved.set(nk, agent.id);
                        moved = true;
                    } else { agent.path = []; }
                }
                if (!moved) reserved.set(`${agent.cx},${agent.cy}`, agent.id);
                agent.priority = (agent.priority + 1) % (NUM_AGENTS * 3);
            }
        }

        // ─── Robot Visual (translation only, no rotation) ───
        agents.forEach((agent, i) => {
            const ref = robotRefs.current[i];
            if (!ref) return;

            // If faulted: freeze at exactly the visual position they reached
            if (agent.isFaulted) {
                if (agent.frozenVisual === undefined) {
                    const t = agent.lerpT;
                    const ease = t * t * (3 - 2 * t);
                    const vx = agent.prevX + (agent.cx - agent.prevX) * ease;
                    const vy = agent.prevY + (agent.cy - agent.prevY) * ease;
                    agent.frozenVisual = { x: vx, y: vy };
                }

                ref.position.set((agent.frozenVisual.x + offsetX) * CELL_SIZE, 0, (agent.frozenVisual.y + offsetZ) * CELL_SIZE);
                const indicator = ref.getObjectByName('indicator');
                if (indicator) {
                    indicator.material.color.lerp(faultColor, 0.2);
                    indicator.material.emissive.lerp(faultColor, 0.2);
                }
                return;
            }

            // Smooth translation only
            if (agent.lerpT < 1) {
                agent.lerpT = Math.min(1, agent.lerpT + (delta / TICK_INTERVAL));
            }
            const t = agent.lerpT;
            const ease = t * t * (3 - 2 * t);
            const vx = agent.prevX + (agent.cx - agent.prevX) * ease;
            const vy = agent.prevY + (agent.cy - agent.prevY) * ease;
            ref.position.set((vx + offsetX) * CELL_SIZE, 0, (vy + offsetZ) * CELL_SIZE);

            const indicator = ref.getObjectByName('indicator');
            if (indicator) {
                const c = new THREE.Color().setHSL(agent.hue, 0.65, 0.55);
                indicator.material.color.lerp(c, 0.1);
                indicator.material.emissive.lerp(c, 0.1);
            }
        });

        // ─── Hover highlight ───
        if (hoverMeshRef.current) {
            if (hoveredCell) {
                hoverMeshRef.current.position.set(
                    (hoveredCell.x + offsetX) * CELL_SIZE, 0.01,
                    (hoveredCell.y + offsetZ) * CELL_SIZE
                );
                hoverMeshRef.current.visible = true;
            } else {
                hoverMeshRef.current.visible = false;
            }
        }
    });

    const robotModel = useMemo(() => makeRobotModel(), []);

    return (
        <>
            {sim.agents.map((_, i) => (
                <primitive key={i} object={robotModel.clone()} ref={(el) => { robotRefs.current[i] = el; }} />
            ))}

            {/* Wave ring cells — individual meshes, NOT instancedMesh */}
            {waveCellList.map((cell) => (
                <WaveCell key={cell.key} x={cell.x} z={cell.z} birthTime={cell.birthTime} clock={clockRef} />
            ))}

            {/* Hover */}
            <mesh ref={hoverMeshRef} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.92, 0.92]} />
                <meshBasicMaterial color="#0A0A0A" transparent opacity={0.07} />
            </mesh>
        </>
    );
}

// ─── Infinite Grid ──────────────────────────────────────────────────
function InfiniteGrid() {
    const gridLines = useMemo(() => {
        const SIZE = 60;
        const positions = [];
        const colors = [];
        const center = new THREE.Color('#DFDBD6');
        const edge = new THREE.Color('#F5F2EE');
        for (let x = -SIZE; x <= SIZE; x++) {
            const d = Math.abs(x) / SIZE;
            const c = center.clone().lerp(edge, d * d);
            positions.push(x, 0, -SIZE, x, 0, SIZE);
            colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
        for (let z = -SIZE; z <= SIZE; z++) {
            const d = Math.abs(z) / SIZE;
            const c = center.clone().lerp(edge, d * d);
            positions.push(-SIZE, 0, z, SIZE, 0, z);
            colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
        return { positions: new Float32Array(positions), colors: new Float32Array(colors) };
    }, []);

    return (
        <lineSegments>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[gridLines.positions, 3]} />
                <bufferAttribute attach="attributes-color" args={[gridLines.colors, 3]} />
            </bufferGeometry>
            <lineBasicMaterial vertexColors transparent />
        </lineSegments>
    );
}

// ─── Floor ──────────────────────────────────────────────────────────
function GridFloor({ onClick, onHover }) {
    const offsetX = -(GRID_W - 1) / 2;
    const offsetZ = -(GRID_H - 1) / 2;

    return (
        <>
            <InfiniteGrid />
            <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0.005, 0]}
                onPointerDown={(e) => {
                    e.stopPropagation();
                    const px = Math.round(e.point.x - offsetX);
                    const pz = Math.round(e.point.z - offsetZ);
                    onClick({ x: px, y: pz });
                }}
                onPointerMove={(e) => {
                    const px = Math.round(e.point.x - offsetX);
                    const pz = Math.round(e.point.z - offsetZ);
                    onHover({ x: px, y: pz });
                }}
                onPointerLeave={() => onHover(null)}
            >
                <planeGeometry args={[120, 120]} />
                <meshBasicMaterial transparent opacity={0} />
            </mesh>
        </>
    );
}

function Scene() {
    const [stasisCell, setStasisCell] = useState(null);
    const [hoveredCell, setHoveredCell] = useState(null);
    const handleClick = useCallback((cell) => setStasisCell(prev => prev ? prev : { ...cell }), []);
    const handleHover = useCallback((cell) => setHoveredCell(cell), []);

    return (
        <>
            <ambientLight intensity={0.55} />
            <directionalLight position={[8, 15, 6]} intensity={2.2} />
            <directionalLight position={[-5, 8, -3]} intensity={0.5} />
            <group rotation={[-0.4, 0, 0]} position={[0, -1, 0]}>
                <GridFloor onClick={handleClick} onHover={handleHover} />
                <Simulation stasisCell={stasisCell} hoveredCell={hoveredCell} />
            </group>
            <fog attach="fog" args={['#F5F2EE', 10, 40]} />
        </>
    );
}

export default function KineticGrid() {
    return (
        <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
            <Canvas camera={{ position: [0, 9, 11], fov: 38 }} style={{ background: 'transparent' }}>
                <Scene />
            </Canvas>
            <div style={{
                position: 'absolute', bottom: '2.5rem', right: '2.5rem',
                pointerEvents: 'none', opacity: 0.3, textAlign: 'right',
            }}>
                <p style={{
                    fontFamily: '"DM Mono", monospace', fontSize: '10px',
                    textTransform: 'uppercase', letterSpacing: '0.15em',
                    color: '#0A0A0A', lineHeight: '2',
                }}>
                    Sys.Status: [ NOMINAL ]<br />
                    Algorithm: [ PIBT ]<br />
                    Agents: [ {NUM_AGENTS} ]<br />
                    &gt; Click grid to inject fault
                </p>
            </div>
        </div>
    );
}
