import { addPropertyControls, ControlType, RenderTarget } from "../lib/framer-shim"
import { useEffect, useState, type CSSProperties } from "react"

// Reading progress drawn as an ASCII bar: [#####.....] 042%
interface Props {
    cells: number
    fontSize: number
    ink: string
    dim: string
    accent: string
    style?: CSSProperties
}

/**
 * @framerSupportedLayoutWidth auto
 * @framerSupportedLayoutHeight auto
 */
export default function AsciiProgress({ cells, fontSize, ink, dim, accent, style }: Props) {
    const [p, setP] = useState(0)
    useEffect(() => {
        if (RenderTarget.current() === RenderTarget.canvas) return
        const update = () => {
            const max = document.documentElement.scrollHeight - window.innerHeight
            setP(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0)
        }
        update()
        window.addEventListener("scroll", update, { passive: true })
        window.addEventListener("resize", update)
        return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update) }
    }, [])
    const n = Math.max(4, Math.round(cells))
    const filled = Math.round(p * n)
    const pct = String(Math.round(p * 100)).padStart(3, "0")
    return (
        <div
            role="progressbar"
            aria-label="Reading progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(p * 100)}
            style={{ ...style, fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace', fontSize, lineHeight: 1.4, whiteSpace: "pre", color: dim, fontVariantNumeric: "tabular-nums" }}
        >
            <span>[</span>
            <span style={{ color: accent }}>{"#".repeat(filled)}</span>
            <span>{".".repeat(n - filled)}</span>
            <span>] </span>
            <span style={{ color: ink }}>{pct}%</span>
        </div>
    )
}

AsciiProgress.defaultProps = { cells: 12, fontSize: 12, ink: "#EDEDF2", dim: "#4A4B5A", accent: "#F9B73F" }

addPropertyControls(AsciiProgress, {
    cells: { type: ControlType.Number, title: "Cells", min: 4, max: 40, step: 1, defaultValue: 12 },
    fontSize: { type: ControlType.Number, title: "Size", min: 9, max: 24, step: 1, defaultValue: 12 },
    ink: { type: ControlType.Color, title: "Ink", defaultValue: "#EDEDF2" },
    dim: { type: ControlType.Color, title: "Track", defaultValue: "#4A4B5A" },
    accent: { type: ControlType.Color, title: "Fill", defaultValue: "#F9B73F" },
})
