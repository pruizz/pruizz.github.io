import { addPropertyControls, ControlType, RenderTarget } from "../lib/framer-shim"
import { useEffect, useRef, useState, type CSSProperties } from "react"

// A divider drawn in box characters; it draws itself left to right with an amber head when it scrolls into view.
interface Props { color: string; accent: string; fontSize: number; duration: number; style?: CSSProperties }

/**
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight auto
 */
export default function AsciiRule({ color, accent, fontSize, duration, style }: Props) {
    const ref = useRef<HTMLDivElement>(null)
    const [n, setN] = useState(160)
    const [p, setP] = useState(1)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const c = document.createElement("canvas").getContext("2d")
        const font = fontSize + 'px "JetBrains Mono", ui-monospace, Menlo, monospace'
        const measure = () => {
            if (!c) return
            c.font = font
            const cw = c.measureText("─").width || fontSize * 0.6
            setN(Math.max(4, Math.floor(el.getBoundingClientRect().width / cw)))
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        document.fonts?.load(font).then(measure).catch(() => {})
        const target = RenderTarget.current()
        const still = target === RenderTarget.canvas || target === RenderTarget.thumbnail || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        let raf = 0
        let io: IntersectionObserver | null = null
        if (!still) {
            setP(0)
            io = new IntersectionObserver((es) => {
                if (!es[0].isIntersecting) return
                io?.disconnect()
                const t0 = performance.now(), ms = Math.max(200, duration * 1000)
                const tick = (now: number) => {
                    const q = Math.min(1, Math.max(0, (now - t0) / ms)) // rAF time can precede t0
                    setP(1 - Math.pow(1 - q, 3))
                    if (q < 1) raf = requestAnimationFrame(tick)
                }
                raf = requestAnimationFrame(tick)
            }, { threshold: 0.5 })
            io.observe(el)
        }
        return () => { ro.disconnect(); io?.disconnect(); cancelAnimationFrame(raf) }
    }, [fontSize, duration])

    const done = Math.floor(p * n)
    const head = p < 1 ? Math.min(3, n - done) : 0
    return (
        <div
            ref={ref}
            aria-hidden="true"
            style={{ width: "100%", ...style, overflow: "hidden", whiteSpace: "pre", fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace', fontSize, lineHeight: 1, color }}
        >
            {"─".repeat(done)}
            <span style={{ color: accent }}>{"━".repeat(head)}</span>
            {" ".repeat(Math.max(0, n - done - head))}
        </div>
    )
}

AsciiRule.defaultProps = { color: "#2E3044", accent: "#F9B73F", fontSize: 12, duration: 1.1 }

addPropertyControls(AsciiRule, {
    color: { type: ControlType.Color, title: "Line", defaultValue: "#2E3044" },
    accent: { type: ControlType.Color, title: "Head", defaultValue: "#F9B73F" },
    fontSize: { type: ControlType.Number, title: "Size", min: 8, max: 24, step: 1, defaultValue: 12 },
    duration: { type: ControlType.Number, title: "Duration", min: 0.2, max: 4, step: 0.1, unit: "s", defaultValue: 1.1 },
})
