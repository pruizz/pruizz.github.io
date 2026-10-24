import { addPropertyControls, ControlType, RenderTarget } from "../lib/framer-shim"
import { useEffect, useRef, useState, type CSSProperties } from "react"

// Large word rendered as ASCII art. Decodes on scroll; glyphs flicker under the cursor.
const RAMP = " .:o@"
const NOISE = "@o:+*"

interface Props {
    text: string
    fontFamily: string
    fontWeight: number
    cell: number
    ink: string
    dim: string
    accent: string
    style?: CSSProperties
}

/**
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight auto
 */
export default function AsciiSignature({ text, fontFamily, fontWeight, cell, ink, dim, accent, style }: Props) {
    const wrap = useRef<HTMLDivElement>(null)
    const ref = useRef<HTMLCanvasElement>(null)
    const [height, setHeight] = useState(140)

    useEffect(() => {
        const box = wrap.current, cv = ref.current
        const ctx = cv?.getContext("2d")
        if (!box || !cv || !ctx) return
        const target = RenderTarget.current()
        const isStatic = target === RenderTarget.canvas || target === RenderTarget.thumbnail || target === RenderTarget.export
        const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        const mono = cell + 'px "JetBrains Mono", ui-monospace, Menlo, monospace'
        let cols = 0, rows = 0, cw = 0, ch = 0, W = 0
        let glyph = new Uint8Array(0), weight = new Float32Array(0), delay = new Float32Array(0)
        let raf = 0, t0 = 0, revealed = isStatic || reduce
        let pointer: { c: number; r: number } | null = null

        const build = () => {
            W = box.getBoundingClientRect().width || 1000
            ctx.font = mono
            cw = ctx.measureText("M").width || cell * 0.6
            ch = cell * 1.2
            cols = Math.max(8, Math.floor(W / cw))
            const oc = document.createElement("canvas")
            const o = oc.getContext("2d", { willReadFrequently: true })
            if (!o) return
            const face = (s: number) => fontWeight + " " + s + 'px "' + fontFamily + '", Geologica, system-ui, sans-serif'
            o.font = face(100)
            const tw100 = o.measureText(text).width || 1
            const fs = (100 * cols * 0.98) / tw100
            rows = Math.ceil((fs * 0.74 * cw) / ch) + 2
            oc.width = cols; oc.height = rows
            o.setTransform(1, 0, 0, cw / ch, 0, 0)
            o.font = face(fs)
            o.fillStyle = "#fff"
            o.textBaseline = "alphabetic"
            o.fillText(text, (cols - (tw100 * fs) / 100) / 2, ((rows - 1) * ch) / cw)
            const d = o.getImageData(0, 0, cols, rows).data
            glyph = new Uint8Array(cols * rows); weight = new Float32Array(cols * rows); delay = new Float32Array(cols * rows)
            for (let i = 0; i < cols * rows; i++) {
                const a = d[i * 4 + 3] / 255
                weight[i] = a
                glyph[i] = a < 0.08 ? 0 : Math.min(RAMP.length - 1, 1 + Math.floor(a * (RAMP.length - 1)))
                delay[i] = ((i % cols) / cols) * 0.7 + Math.random() * 0.3
            }
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            const H = rows * ch
            cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
            cv.style.height = H + "px"
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            setHeight(H)
        }

        const draw = (now: number) => {
            const p = revealed ? 9 : t0 ? (now - t0) / 1500 : -1
            ctx.clearRect(0, 0, W, rows * ch)
            ctx.font = mono
            ctx.textBaseline = "top"
            const layers: [string, string[]][] = [[dim, []], [ink, []], [accent, []]]
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                const i = r * cols + c, g = glyph[i]
                if (!g) continue
                let near = false
                if (pointer) { const dx = (c - pointer.c) / 9, dy = (r - pointer.r) / 3.5; near = dx * dx + dy * dy < 1 }
                if (near || (p >= delay[i] && p < delay[i] + 0.12)) {
                    layers[2][1].push(i + "|" + NOISE[Math.floor(Math.random() * NOISE.length)])
                } else if (p >= delay[i]) {
                    layers[weight[i] > 0.6 ? 1 : 0][1].push(i + "|" + RAMP[g])
                }
            }
            for (const [color, cells] of layers) {
                ctx.fillStyle = color
                for (const s of cells) {
                    const bar = s.indexOf("|"), i = +s.slice(0, bar)
                    ctx.fillText(s.slice(bar + 1), (i % cols) * cw, Math.floor(i / cols) * ch)
                }
            }
        }

        const loop = (now: number) => {
            raf = 0
            draw(now)
            if (t0 && !revealed && now - t0 > 1500 * 1.15) revealed = true
            if (!revealed || pointer) raf = requestAnimationFrame(loop)
        }
        const kick = () => { if (!raf) raf = requestAnimationFrame(loop) }

        build(); draw(0)
        const ro = new ResizeObserver(() => { build(); draw(performance.now()) })
        ro.observe(box)
        document.fonts?.ready.then(() => { build(); draw(performance.now()) })
        const io = new IntersectionObserver((es) => {
            if (es[0].isIntersecting && !t0 && !revealed) { t0 = performance.now(); kick(); io.disconnect() }
        }, { threshold: 0.25 })
        if (!revealed) io.observe(cv)
        const onMove = (e: PointerEvent) => {
            const r = cv.getBoundingClientRect()
            pointer = { c: (e.clientX - r.left) / cw, r: (e.clientY - r.top) / ch }
            kick()
        }
        const onLeave = () => { pointer = null; kick() }
        if (!isStatic && !reduce) { cv.addEventListener("pointermove", onMove); cv.addEventListener("pointerleave", onLeave) }
        return () => {
            cancelAnimationFrame(raf); ro.disconnect(); io.disconnect()
            cv.removeEventListener("pointermove", onMove); cv.removeEventListener("pointerleave", onLeave)
        }
    }, [text, fontFamily, fontWeight, cell, ink, dim, accent])

    return (
        <div ref={wrap} role="img" aria-label={text} style={{ width: "100%", ...style, height }}>
            <canvas ref={ref} style={{ display: "block", width: "100%", height }} />
        </div>
    )
}

AsciiSignature.defaultProps = { text: "PABLO RUIZ", fontFamily: "Geologica", fontWeight: 700, cell: 9, ink: "#C9CAD4", dim: "#3A3B4A", accent: "#F9B73F" }

addPropertyControls(AsciiSignature, {
    text: { type: ControlType.String, title: "Text", defaultValue: "PABLO RUIZ" },
    fontFamily: { type: ControlType.String, title: "Font", defaultValue: "Geologica" },
    fontWeight: { type: ControlType.Number, title: "Weight", min: 100, max: 900, step: 100, defaultValue: 700 },
    cell: { type: ControlType.Number, title: "Cell", min: 5, max: 20, step: 1, defaultValue: 9 },
    ink: { type: ControlType.Color, title: "Ink", defaultValue: "#C9CAD4" },
    dim: { type: ControlType.Color, title: "Edge", defaultValue: "#3A3B4A" },
    accent: { type: ControlType.Color, title: "Glyphs", defaultValue: "#F9B73F" },
})
