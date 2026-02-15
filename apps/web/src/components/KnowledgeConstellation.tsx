import { useRef, useEffect, useMemo } from 'react'
import gsap from 'gsap'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'

gsap.registerPlugin(DrawSVGPlugin)

interface Props {
  nodes: string[]
  subtitle?: string
  className?: string
}

interface LayoutNode {
  id: number
  label: string
  x: number
  y: number
  size: number
}

interface Edge {
  from: number
  to: number
}

const W = 500
const H = 500
const CX = W / 2
const CY = H / 2

// Simple seeded random for stable layouts
function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function buildLayout(labels: string[]): { nodes: LayoutNode[]; edges: Edge[] } {
  // Seed from labels so same input = same layout
  const seed = labels.reduce((acc, l, i) => acc + l.charCodeAt(0) * (i + 1), 1)
  const rand = seededRandom(seed)

  // Golden-angle spiral for organic distribution
  const nodes: LayoutNode[] = labels.map((label, i) => {
    const angle = i * 137.508 * (Math.PI / 180)
    const r = Math.sqrt(i + 1) * 65
    // Add jitter
    const jx = (rand() - 0.5) * 25
    const jy = (rand() - 0.5) * 25
    return {
      id: i,
      label,
      x: CX + r * Math.cos(angle) + jx,
      y: CY + r * Math.sin(angle) + jy,
      size: i === 0 ? 20 : 10 + rand() * 6, // first node (expert name) is larger
    }
  })

  // Connect each node to its 2 nearest neighbours
  const edges: Edge[] = []
  const edgeSet = new Set<string>()
  for (let i = 0; i < nodes.length; i++) {
    const dists = nodes
      .map((n, j) => ({ j, d: Math.hypot(n.x - nodes[i].x, n.y - nodes[i].y) }))
      .filter(({ j }) => j !== i)
      .sort((a, b) => a.d - b.d)

    for (let k = 0; k < Math.min(2, dists.length); k++) {
      const key = [Math.min(i, dists[k].j), Math.max(i, dists[k].j)].join('-')
      if (!edgeSet.has(key)) {
        edgeSet.add(key)
        edges.push({ from: i, to: dists[k].j })
      }
    }
  }

  return { nodes, edges }
}

export default function KnowledgeConstellation({ nodes: labels, subtitle, className = '' }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const labelsKey = labels.join('|')

  const layout = useMemo(() => buildLayout(labels), [labelsKey])

  useEffect(() => {
    if (!svgRef.current || labels.length === 0) return

    const svg = svgRef.current
    const nodeEls = svg.querySelectorAll('[data-node]')
    const edgeEls = svg.querySelectorAll('[data-edge]')
    const labelEls = svg.querySelectorAll('[data-label]')
    const glowEls = svg.querySelectorAll('[data-glow]')

    const tl = gsap.timeline()

    // Phase 1: Nodes appear - scale up from nothing with stagger
    tl.fromTo(nodeEls,
      { scale: 0, opacity: 0, transformOrigin: 'center center' },
      { scale: 1, opacity: 1, transformOrigin: 'center center', stagger: 0.4, duration: 1, ease: 'back.out(2)' },
    )

    // Phase 2: Labels fade in (slightly behind nodes)
    tl.fromTo(labelEls,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, stagger: 0.4, duration: 0.8, ease: 'power2.out' },
      '-=4',
    )

    // Phase 3: Edges draw in
    gsap.set(edgeEls, { visibility: 'visible' })
    tl.from(edgeEls, {
      drawSVG: '0%',
      stagger: 0.2,
      duration: 1.5,
      ease: 'power1.inOut',
    }, '-=2')

    // Phase 4: Subtitle
    if (subtitleRef.current) {
      tl.fromTo(subtitleRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.5 },
        '-=0.3'
      )
    }

    // Continuous: gentle breathing pulse on glow circles
    const breathe = gsap.to(glowEls, {
      opacity: 0.2,
      scale: 1.4,
      transformOrigin: 'center center',
      stagger: { each: 0.3, repeat: -1, yoyo: true },
      duration: 3,
      ease: 'sine.inOut',
      delay: tl.duration(),
    })

    // Continuous: subtle drift on nodes
    const drifts: gsap.core.Tween[] = []
    nodeEls.forEach((el) => {
      const dx = (Math.random() - 0.5) * 16
      const dy = (Math.random() - 0.5) * 16
      drifts.push(gsap.to(el, {
        x: dx,
        y: dy,
        duration: 4 + Math.random() * 3,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      }))
    })

    return () => {
      tl.kill()
      breathe.kill()
      drifts.forEach((d) => d.kill())
    }
  }, [labelsKey])

  if (labels.length === 0) return null

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        style={{ overflow: 'visible' }}
      >
        {/* Edges */}
        {layout.edges.map((edge, i) => {
          const from = layout.nodes[edge.from]
          const to = layout.nodes[edge.to]
          return (
            <line
              key={`e-${i}`}
              data-edge
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="rgb(249, 115, 22)"
              strokeOpacity={0.15}
              strokeWidth={2}
              style={{ visibility: 'hidden' }}
            />
          )
        })}

        {/* Node groups */}
        {layout.nodes.map((node) => (
          <g key={node.id} data-node style={{ opacity: 0 }}>
            {/* Glow */}
            <circle
              data-glow
              cx={node.x}
              cy={node.y}
              r={node.size * 3.5}
              fill="rgb(249, 115, 22)"
              opacity={0.1}
            />
            {/* Core dot */}
            <circle
              cx={node.x}
              cy={node.y}
              r={node.size}
              fill="rgb(251, 146, 60)"
            />
            {/* Label */}
            <text
              data-label
              x={node.x}
              y={node.y + node.size + 22}
              textAnchor="middle"
              fill="rgb(148, 163, 184)"
              fontSize={16}
              fontFamily="system-ui, sans-serif"
              style={{ opacity: 0 }}
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>

      {subtitle && (
        <p ref={subtitleRef} className="text-slate-500 text-sm text-center mt-4 opacity-0">
          {subtitle}
        </p>
      )}
    </div>
  )
}
