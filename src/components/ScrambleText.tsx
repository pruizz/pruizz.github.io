import { addPropertyControls, ControlType, RenderTarget } from "../lib/framer-shim"
import { useEffect, useRef, useState, type CSSProperties } from "react"

// Mono label that decodes from random glyphs into its text when it scrolls into view.
const GLYPHS = "!<>-_\\/[]{}=+*^?#%&$@01"

interface Props {
    text: string
    fontSize: number
    letterSpacing: number
    uppercase: boolean
    color: string
    accent: string
    duration: number
    style?: CSSProperties
}

/**
 * @framerSupportedLayoutWidth auto
 * @framerSupportedLayoutHeight auto
 */
export default function ScrambleText({ text, fontSize, letterSpacing, uppercase, color, accent, duration, style }: Props) {
    const target = uppercase ? text.toUpperCase() : text
    const [frame, setFrame] = useState<{ done: string; noise: string; rest: string }>({ done: target, noise: "", rest: "" })
    const ref = useRef<HTMLSpanElement>(null)

    useEffect(() => {
        setFrame({ done: target, noise: "", rest: "" })
        const el = ref.current
        if (!el || RenderTarget.current() !== RenderTarget.preview && RenderTarget.current() !== RenderTarget.export && RenderTarget.current() === RenderTarget.canvas) return
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
        let raf = 0, started = false
        const run = () => {
            const t0 = performance.now(), n = target.length, ms = Math.max(200, duration * 1000)
            const tick = (now: number) => {
                const p = Math.min(1, Math.max(0, (now - t0) / ms)) // rAF time can precede t0
                const revealed = Math.floor(p * n)
                const tail = Math.min(n, revealed + 5)
                let noise = ""
                for (let i = revealed; i < tail; i++) noise += target[i] === " " ? " " : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
                const rest = target.slice(tail).replace(/[^ ]/g, " ")
                setFrame({ done: target.slice(0, revealed), noise, rest })
                if (p < 1) raf = requestAnimationFrame(tick)
                else setFrame({ done: target, noise: "", rest: "" })
            }
            raf = requestAnimationFrame(tick)
        }
        const io = new IntersectionObserver((es) => {
            if (!started && es[0].isIntersecting) { started = true; run(); io.disconnect() }
        }, { threshold: 0.6 })
        io.observe(el)
        return () => { io.disconnect(); cancelAnimationFrame(raf) }
    }, [target, duration])

    return (
        <span
            ref={ref}
            style={{
                ...style,
                display: "inline-block",
                fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace',
                fontSize,
                letterSpacing: letterSpacing + "em",
                lineHeight: 1.5,
                whiteSpace: "pre",
                color,
            }}
        >
            <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{target}</span>
            <span aria-hidden="true">
                {frame.done}
                <span style={{ color: accent }}>{frame.noise}</span>
                {frame.rest}
            </span>
        </span>
    )
}

ScrambleText.defaultProps = { text: "01 / Section", fontSize: 13, letterSpacing: 0.08, uppercase: true, color: "#9C9DA8", accent: "#F9B73F", duration: 0.9 }

addPropertyControls(ScrambleText, {
    text: { type: ControlType.String, title: "Text", defaultValue: "01 / Section" },
    fontSize: { type: ControlType.Number, title: "Size", min: 9, max: 64, step: 1, defaultValue: 13 },
    letterSpacing: { type: ControlType.Number, title: "Tracking", min: -0.1, max: 0.4, step: 0.01, defaultValue: 0.08 },
    uppercase: { type: ControlType.Boolean, title: "Uppercase", defaultValue: true },
    color: { type: ControlType.Color, title: "Color", defaultValue: "#9C9DA8" },
    accent: { type: ControlType.Color, title: "Glyphs", defaultValue: "#F9B73F" },
    duration: { type: ControlType.Number, title: "Duration", min: 0.2, max: 4, step: 0.1, unit: "s", defaultValue: 0.9 },
})
