import { addPropertyControls, ControlType, RenderTarget } from "../lib/framer-shim"
import { useEffect, useRef, useState, type CSSProperties } from "react"

// Halftone scenes: round dots sized by brightness and coloured from a dusk or a night ramp.
// "towers": the Cuatro Torres of Madrid at sunset. "sierra": a moonlit Sierra de Guadarrama over a reservoir.

type Scene = "towers" | "sierra"
type Copy = "hero" | "contact" | "none"
type Rect = [number, number, number, number]
interface Frame { mask: Rect[]; zone: [number, number]; top: number; gy: number; sun: [number, number, number]; hz: number; peak: number; peakAt: number; moon: [number, number, number] }

// Where the copy sits (px from the top-left of the panel) and where each scene puts its subject, per breakpoint.
// shortcut: copy boxes are measured from the current hero/contact layout; update them if that copy moves.
const NONE: Frame = { mask: [], zone: [0.35, 0.8], top: 0.2, gy: 0.86, sun: [0.2, 0.72, 0.06], hz: 0.8, peak: 0.5, peakAt: 0.6, moon: [0.85, 0.25, 0.04] }
const FRAMES: Record<Copy, Record<"d" | "t" | "p", Frame>> = {
    hero: {
        d: { mask: [[0, 0, 990, 372], [0, 0, 565, 560]], zone: [0.57, 0.95], top: 0.47, gy: 0.9, sun: [0.3, 0.8, 0.055], hz: 0.8, peak: 0.5, peakAt: 0.78, moon: [0.93, 0.42, 0.03] },
        t: { mask: [[0, 0, 700, 362], [0, 0, 555, 550]], zone: [0.6, 0.96], top: 0.57, gy: 0.91, sun: [0.3, 0.8, 0.07], hz: 0.82, peak: 0.4, peakAt: 0.8, moon: [0.9, 0.46, 0.04] },
        p: { mask: [[0, 0, 9999, 668]], zone: [0.36, 0.96], top: 0.7, gy: 0.92, sun: [0.17, 0.84, 0.1], hz: 0.9, peak: 0.22, peakAt: 0.66, moon: [0.2, 0.74, 0.05] },
    },
    contact: {
        d: { mask: [[0, 0, 665, 380]], zone: [0.62, 0.95], top: 0.17, gy: 0.87, sun: [0.4, 0.8, 0.045], hz: 0.82, peak: 0.62, peakAt: 0.68, moon: [0.9, 0.2, 0.035] },
        t: { mask: [[0, 0, 500, 340]], zone: [0.64, 0.96], top: 0.24, gy: 0.86, sun: [0.36, 0.82, 0.055], hz: 0.84, peak: 0.55, peakAt: 0.76, moon: [0.9, 0.2, 0.04] },
        p: { mask: [[0, 0, 9999, 380]], zone: [0.36, 0.96], top: 0.6, gy: 0.88, sun: [0.17, 0.82, 0.1], hz: 0.9, peak: 0.3, peakAt: 0.66, moon: [0.2, 0.68, 0.05] },
    },
    none: { d: NONE, t: NONE, p: NONE },
}

const hexRgb = (h: string) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16))
const ramp = (stops: string[], n: number) => {
    const c = stops.map(hexRgb)
    return Array.from({ length: n }, (_, i) => {
        const p = (i / (n - 1)) * (c.length - 1), k = Math.min(c.length - 2, Math.floor(p)), f = p - k
        const rgb = c[k].map((v, q) => Math.round(v + (c[k + 1][q] - v) * f))
        return "rgb(" + rgb.join(",") + ")"
    })
}
const DN = 28, NN = 24
const PALETTE = [
    ...ramp(["#0C0E1F", "#151A3A", "#262553", "#432A64", "#702F6E", "#A53B6C", "#D44F62", "#EF7A4E", "#F9A843", "#FBC965", "#FFE8B4", "#FFF7E6"], DN),
    ...ramp(["#0B0E1E", "#111834", "#19254B", "#243665", "#324A80", "#47639C", "#6584BA", "#90AAD6", "#C1D2EF", "#EEF3FF"], NN),
    "#FFC46A", "#FFE0A3", "#D5E3FF", "#FF4B5C", "#FFFFFF",
]
const WARM = DN + NN, WARM2 = WARM + 1, COLD = WARM + 2, RED = WARM + 3, WHITE = WARM + 4
const LEVELS = 6
const COVER = [0, 0.1, 0.22, 0.38, 0.56, 0.77, 1]
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.47)
const TAU = Math.PI * 2
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const hash = (a: number, b: number) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s) }
const CLOUDS = [{ dv: -0.1, u: 0.2, len: 0.5, th: 0.011, sp: 0.0035 }, { dv: -0.2, u: 0.7, len: 0.42, th: 0.008, sp: 0.0025 }, { dv: 0.035, u: 0.5, len: 0.6, th: 0.006, sp: 0.005 }]

const noise1 = (x: number) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, 0.5) * (1 - u) + hash(i + 1, 0.5) * u }

// Sierra: a designed main massif (pyramid summit, saddle, second peak) plus two noise ridges, over a reservoir.
// base/amp are fractions of the frame's peak height; the massif's summit sits at the frame's peakAt.
const RIDGES = [
    { base: 0.1, amp: 0.9, freq: 0.0021, b: 0.42, tn: 0.5, rim: 0.4, snow: true, env: 0, trees: false, prof: true },
    { base: 0.05, amp: 0.4, freq: 0.0034, b: 0.2, tn: 0.3, rim: 0.45, snow: false, env: 0.6, trees: false, prof: false },
    { base: 0.012, amp: 0.13, freq: 0.0062, b: 0.04, tn: 0.12, rim: 0.6, snow: false, env: 0, trees: true, prof: false },
]
const PROFILE = [[-0.5, 0.12], [0.3, 0.22], [0.45, 0.33], [0.55, 0.52], [0.62, 0.8], [0.68, 1], [0.73, 0.71], [0.765, 0.63], [0.82, 0.8], [0.88, 0.6], [0.95, 0.48], [1.5, 0.36]]
const profile = (u: number) => {
    let k = 0
    while (k < PROFILE.length - 2 && u > PROFILE[k + 1][0]) k++
    const [u0, h0] = PROFILE[k], [u1, h1] = PROFILE[k + 1]
    return h0 + (h1 - h0) * clamp((u - u0) / (u1 - u0), 0, 1)
}
const ridgeAt = (x: number) => {
    const a = 1 - Math.abs(2 * noise1(x) - 1), b = 1 - Math.abs(2 * noise1(x * 2.13 + 7) - 1), c = noise1(x * 4.7 + 3)
    return Math.pow(0.6 * a + 0.28 * b + 0.12 * c, 1.2)
}

interface Props { scene: Scene; copy: Copy; cell: number; caption: boolean; column: number; style?: CSSProperties }

/**
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */
export default function AsciiHorizon({ scene = "towers", copy = "hero", cell = 6, caption = true, column = 0, style }: Props) {
    const ref = useRef<HTMLCanvasElement>(null)
    const [paused, setPaused] = useState(false)
    const [reduced, setReduced] = useState(false)
    useEffect(() => {
        const m = window.matchMedia("(prefers-reduced-motion: reduce)")
        const update = () => setReduced(m.matches)
        update(); m.addEventListener("change", update)
        return () => m.removeEventListener("change", update)
    }, [])

    useEffect(() => {
        const cv = ref.current
        const ctx = cv?.getContext("2d")
        if (!cv || !ctx) return
        const target = RenderTarget.current()
        const still = paused || reduced || target === RenderTarget.canvas || target === RenderTarget.thumbnail || target === RenderTarget.export
        const cs = clamp(Number.isFinite(cell) ? cell : 6, 4, 12)
        const sierra = scene === "sierra"
        let W = 0, H = 0, dpr = 1, cols = 0, rows = 0, ox = 0, oy = 0, ga = 1, gy = 0
        let F: Frame = FRAMES.hero.d
        let bB = new Float32Array(0), tB = new Float32Array(0), mask = new Float32Array(0), sB = new Int16Array(0)
        let nearH = new Int16Array(0), farH = new Int16Array(0)
        let towers: { x0: number; w: number; top: number; k: number }[] = []
        let atlas: HTMLCanvasElement | null = null
        let raf = 0, visible = true, last = 0, t0 = 0, scrollP = 0, disposed = false
        const M = 16, pointer = { x: 0, y: 0, on: false }, ps = { x: 0, y: 0 }

        const layout = () => {
            const r = cv.getBoundingClientRect()
            W = r.width || 1120; H = r.height || 840
            dpr = Math.min(window.devicePixelRatio || 1, 2)
            cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr))
            cols = Math.floor(W / cs); rows = Math.floor(H / cs)
            ox = (W - cols * cs) / 2; oy = (H - rows * cs) / 2
            const n = cols * rows
            bB = new Float32Array(n); tB = new Float32Array(n); mask = new Float32Array(n); sB = new Int16Array(n)
            F = (FRAMES[copy] || FRAMES.none)[W >= 1000 ? "d" : W >= 600 ? "t" : "p"]
            // full-bleed panels keep their copy in a centred column: move the copy boxes with it
            const shift = column > 0 ? Math.max(0, (W - column) / 2 - 40) : 0
            for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
                const px = ox + (i + 0.5) * cs, py = oy + (j + 0.5) * cs
                let dist = 1e9
                for (const [x0, y0, x1, y1] of F.mask) dist = Math.min(dist, Math.hypot(Math.max(x0 - px, 0, px - x1 - shift), Math.max(y0 - py, 0, py - y1)))
                mask[j * cols + i] = F.mask.length ? 0.06 + 0.94 * sstep(6, 72, dist) : 1
            }
            gy = Math.round(rows * F.gy)
            const z0 = F.zone[0] * cols, z1 = F.zone[1] * cols
            const w = Math.max(4, Math.floor((z1 - z0) / (4 + 3 * 0.6))), gap = Math.round(w * 0.6), topRow = Math.round(rows * F.top)
            towers = [0.95, 0.9, 1, 0.86].map((f, k) => ({ x0: Math.round(z0) + k * (w + gap), w, top: gy - Math.round((gy - topRow) * f), k }))
            const nn = cols + 2 * M
            nearH = new Int16Array(nn); farH = new Int16Array(nn)
            const blocks: [Int16Array, number, number, number][] = [[farH, 0.02, 0.06, 3], [nearH, 0.012, 0.07, 9]]
            for (const [arr, lo, hi, seed] of blocks) {
                let x = 0
                while (x < nn) {
                    const bw = 2 + Math.floor(hash(x, seed) * 6), bh = Math.round(rows * (lo + (hi - lo) * hash(x, seed + 1) ** 2))
                    for (let q = 0; q < bw && x + q < nn; q++) arr[x + q] = bh
                    x += bw
                }
            }
            ga = Math.ceil(cs * dpr)
            atlas = document.createElement("canvas")
            atlas.width = ga * (LEVELS + 1); atlas.height = ga * PALETTE.length
            const a = atlas.getContext("2d")
            if (a) PALETTE.forEach((col, row) => {
                a.fillStyle = col
                for (let l = 1; l <= LEVELS; l++) { a.beginPath(); a.arc(l * ga + ga / 2, row * ga + ga / 2, ga * 0.47 * Math.sqrt(COVER[l]), 0, TAU); a.fill() }
            })
        }

        const put = (i: number, j: number, b: number, s: number) => {
            if (i < 0 || j < 0 || i >= cols || j >= rows) return
            const k = j * cols + i
            if (b >= bB[k] || s !== sB[k]) { bB[k] = Math.max(b, bB[k] * (s === sB[k] ? 1 : 0)); sB[k] = s }
        }
        const cut = (i: number, j: number) => { if (i >= 0 && j >= 0 && i < cols && j < rows) bB[j * cols + i] = 0 }
        const cellOf = (x: number, y: number) => [Math.floor((x - ox) / cs), Math.floor((y - oy) / cs)]

        const drawTowers = (t: number) => {
            const R = F.sun[2] * W, sunX = F.sun[0] * W, sunY = (F.sun[1] + 0.05 * scrollP) * H + Math.sin(t * 0.15) * cs * 0.4
            const pT = Math.round(ps.x * 3), pN = Math.round(ps.x * 2), pF = Math.round(ps.x)
            const wake = 0.5 + 0.5 * Math.sin(t * 0.06 - 1.2)
            for (let j = 0; j < rows; j++) {
                const py = oy + (j + 0.5) * cs
                for (let i = 0; i < cols; i++) {
                    const k = j * cols + i, px = ox + (i + 0.5) * cs
                    let b = 0, tn = 0, s = -1
                    const dx = px - sunX, d = Math.hypot(dx, (py - sunY) * 1.15)
                    const g = Math.exp(-((d / (R * 4.2)) ** 2))
                    if (j >= gy) {
                        // Castellana: dark road, sun reflection, two lanes of traffic
                        const refl = Math.exp(-((dx / (R * 2.4)) ** 2)) * (1 - (j - gy) / (rows - gy + 1))
                        b = 0.05 + 0.14 * refl; tn = 0.1 + 0.5 * refl
                        const lane = j - gy
                        const LANE = [0, 0, 1, 0, -1, 0, 0, 2, 0, -2][lane] || 0
                        if (lane === 0) b = 0.11
                        if (LANE) {
                            const dir = Math.sign(LANE), fast = Math.abs(LANE) === 1, speed = fast ? (dir > 0 ? 11 : 8) : (dir > 0 ? 6 : 14), Lc = fast ? 21 : 27
                            const lp = i - dir * t * speed, pos = ((lp % Lc) + Lc) % Lc
                            if (hash(Math.round(lp / Lc), lane * 7.3) > 0.32) {
                                const back = dir > 0 ? Lc - pos : pos
                                if (pos < 1) { b = 0.95; s = dir > 0 ? WHITE : RED }
                                else if (back > 0 && back < 5) { b = 0.55 - back * 0.1; s = dir > 0 ? WARM : RED }
                            }
                        }
                    } else {
                        const hv = j / gy
                        const glowT = Math.exp(-(((px - ((F.zone[0] + F.zone[1]) / 2) * W) / (W * 0.32)) ** 2)) * sstep(0.15, 1, hv)
                        tn = 0.03 + 0.62 * hv ** 1.5 + 0.34 * g + 0.2 * glowT; b = 0.03 + 0.3 * hv ** 1.8 + 0.3 * g + 0.2 * glowT
                        if (d < R) {
                            const sv = (py - sunY) / R
                            tn = 0.98 - 0.3 * (sv * 0.5 + 0.5); b = 1 - 0.12 * (d / R) ** 2
                            if (sv > 0.05 && ((((sv * 6 - t * 0.25) % 1) + 1) % 1) < 0.1 + 0.5 * sv) { b = 0.1 + 0.25 * g; tn = 0.55 }
                        }
                        for (let c = 0; c < CLOUDS.length; c++) {
                            const C = CLOUDS[c], cy = (F.sun[1] + C.dv) * H, cx = (((C.u + t * C.sp) % 1.5) - 0.25) * W
                            const u = (px - cx) / (C.len * W) + 0.5
                            if (u <= 0 || u >= 1) continue
                            const th = C.th * H * Math.sin(Math.PI * u) ** 0.7 * (0.65 + 0.35 * Math.sin(px * 0.031 + c * 2))
                            const dv = py - cy - Math.sin(px * 0.009 + c) * C.th * H * 0.8
                            if (Math.abs(dv) < th) { const under = clamp((dv / th) * 0.5 + 0.5, 0, 1); b = 0.2 + 0.42 * under * (0.4 + 0.6 * g); tn = 0.42 + 0.36 * under * (0.5 + 0.5 * g) }
                        }
                        if (hv < 0.55 && g < 0.25 && hash(i * 1.31, j * 2.17) > 0.992) { b = 0.3 + 0.45 * (0.5 + 0.5 * Math.sin(t * (1 + hash(j, i) * 2) + hash(i, j) * 30)); s = COLD }
                        const fh = farH[i + M + pF], nh = nearH[i + M + pN]
                        if (j >= gy - fh) { tn = 0.26 + 0.18 * g; b = 0.15 + 0.12 * g; s = -1; if ((i & 1) && (j & 1) && hash(i + pF, j * 3.3) > 0.9) { s = WARM; b = 0.28 } }
                        if (j >= gy - nh) { tn = 0.08; b = 0.12; s = -1; if ((i & 1) === 0 && (j & 1) && hash(i + pN, j) > 0.83) { s = WARM; b = 0.3 + 0.2 * hash(j, i) } }
                        const ti = i - pT
                        for (const T of towers) {
                            if (ti < T.x0 || ti >= T.x0 + T.w || j < T.top) continue
                            const lx = (ti - T.x0 + 0.5) / T.w, ly = (j - T.top) / (gy - T.top), col = ti - T.x0, row = j - T.top
                            let kind = 0 // 0 facade, 1 glass, 2 warm crown, 3 lit crown
                            if (T.k === 0) { if (ly < 0.13 && ly > 0.035 && lx > 0.2 && lx < 0.8) continue } // Cepsa: the open arch
                            else if (T.k === 1) { const hw = 0.5 * (0.84 + 0.16 * Math.sin(Math.PI * Math.min(1, ly * 1.15))); if (Math.abs(lx - 0.5) > (ly < 0.075 ? 0.5 : hw)) continue; if (ly < 0.075) kind = 2 } // PwC: rounded body, crown
                            else if (T.k === 2) { if (ly < 0.12 * (1 - lx)) continue; kind = ly < 0.16 ? 3 : 1 } // Cristal: slanted glass top
                            else { if (Math.abs(lx - 0.5) > 0.5 * (0.6 + 0.4 * sstep(0, 0.7, ly))) continue; if (ly < 0.035) kind = 3 } // Espacio: tapers toward the top
                            const cxT = ox + (T.x0 + T.w / 2 + pT) * cs
                            const face = sunX < cxT ? 1 - lx : lx
                            const rim = sstep(0.72, 1, face) * (0.35 + 0.65 * Math.exp(-(((cxT - sunX) / (W * 0.45)) ** 2)))
                            tn = 0.1 + 0.04 * (1 - ly) + 0.55 * rim; b = 0.06 + (row % 3 === 0 ? 0.03 : 0) + 0.38 * rim; s = -1
                            if (kind === 1) {
                                tn = 0.2 + 0.4 * (1 - ly) + 0.3 * rim; b = 0.08 + 0.12 * (1 - ly) + 0.3 * rim
                                if (col % 3 === 0) b *= 0.55
                                const gl = (((ly - t * 0.05) % 1.4) + 1.4) % 1.4
                                if (gl < 0.18) { const e = Math.sin((gl / 0.18) * Math.PI); b += 0.14 * e; tn += 0.2 * e }
                            } else if (kind === 2) { if (col % 2 === 0) { s = WARM2; b = 0.72 } else b = 0.2 }
                            else if (kind === 3) { s = T.k === 2 ? WARM2 : COLD; b = 0.5 + 0.15 * Math.sin(t * 0.8 + col) }
                            if (kind < 2 && (col & 1) && (row & 1) && col < T.w - 1 && ly > 0.05 && ly < 0.97) {
                                const on = hash(ti * 1.7, j * 0.9) < 0.4 + 0.3 * wake && hash(ti, j + Math.floor(t * 0.25 + hash(j, ti) * 9)) > 0.06
                                if (on) { s = kind === 1 ? COLD : hash(j, ti * 3) > 0.8 ? WARM2 : WARM; b = 0.42 + 0.3 * hash(ti, j * 1.3) }
                            }
                        }
                    }
                    bB[k] = b; tB[k] = tn; sB[k] = s
                }
            }
            // aviation lights
            for (const T of towers) {
                const ci = (T.k === 2 ? T.x0 + T.w - 2 : T.x0 + Math.floor(T.w / 2)) + pT, cj = T.top - 1
                if (((t * 0.8 + T.k * 0.31) % 1) < 0.45) { put(ci, cj, 1, RED); put(ci - 1, cj, 0.3, RED); put(ci + 1, cj, 0.3, RED); put(ci, cj - 1, 0.3, RED) }
            }
            // a plane crossing above the sun, toward the towers
            const pp = (t % 30) / 20
            if (pp < 1) {
                const [pi, pj] = cellOf(-0.05 * W + pp * (F.zone[0] * W + 0.05 * W), sunY - R * 1.7 - pp * 0.04 * H)
                const fade = 1 - sstep(0.85, 1, pp)
                put(pi, pj, 0.85 * fade, WHITE)
                if (Math.floor(t * 1.4) % 2 === 0) put(pi - 1, pj, 0.75 * fade, RED)
                for (let q = 2; q < 16; q++) put(pi - q, pj, 0.2 * (1 - q / 16) * fade, COLD)
            }
            // birds crossing the sun, as cut-outs against the glow
            const bp = ((t + 9) % 26) / 14
            if (bp < 1) {
                const bx = (F.zone[0] + 0.02) * W - bp * (F.zone[0] + 0.15) * W, by = sunY - R * 0.15 + Math.sin(t * 0.7) * R * 0.2
                const flock = [[0, 0], [-3, -2], [-6, -4], [3, -2], [6, -3], [-2, 3], [4, 2]]
                flock.forEach(([fx, fy], n) => {
                    const [ci, cj] = cellOf(bx + fx * cs * 1.6, by + fy * cs * 1.2)
                    const up = Math.sin(t * 9 + n * 1.7) > 0 ? -1 : 0
                    cut(ci, cj); cut(ci - 1, cj + up); cut(ci + 1, cj + up)
                })
            }
        }

        const drawSierra = (t: number) => {
            const moonX = F.moon[0] * W, moonY = (F.moon[1] - 0.04 * scrollP) * H, mR = Math.max(F.moon[2] * W, 3 * cs)
            const lake = Math.round(rows * F.hz), lakeY = oy + lake * cs
            // sky: night gradient, moon with soft halo, Milky Way, stars, a thin cloud crossing the moon
            const mwA = [0.42 * W, 0], mwB = [1.05 * W, 0.7 * H], mwL = Math.hypot(mwB[0] - mwA[0], mwB[1] - mwA[1])
            for (let j = 0; j < lake; j++) {
                const py = oy + (j + 0.5) * cs, hv = clamp(py / lakeY, 0, 1)
                for (let i = 0; i < cols; i++) {
                    const k = j * cols + i, px = ox + (i + 0.5) * cs
                    let tn = 0.04 + 0.5 * hv ** 2.2, b = 0.03 + 0.44 * hv ** 2.8, s = -1
                    const d = Math.hypot(px - moonX, py - moonY), g = Math.exp(-((d / (mR * 4.5)) ** 2)), haze = Math.exp(-((d / (mR * 11)) ** 2)) * hv
                    tn += 0.32 * g + 0.12 * haze; b += 0.24 * g + 0.07 * haze
                    const band = Math.exp(-((((px - mwA[0]) * (mwB[1] - mwA[1]) - (py - mwA[1]) * (mwB[0] - mwA[0])) / mwL / (0.07 * W)) ** 2))
                    const dust = band * noise1(px * 0.02 + py * 0.013)
                    b += 0.1 * dust; tn += 0.14 * dust
                    if (d < mR) {
                        const maria = noise1((px - moonX) * 0.07 + 40) * noise1((py - moonY) * 0.09 + 7)
                        tn = 0.94 - 0.14 * maria; b = 0.97 - 0.2 * maria - 0.12 * (d / mR) ** 4
                    } else if (hash(i * 1.37, j * 2.11) > 0.993 - 0.02 * band) {
                        b = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * (0.8 + hash(j, i) * 2.4) + hash(i, j) * 40)); s = hash(j, i * 2) > 0.85 ? WARM2 : COLD
                    }
                    const cy = moonY + mR * 0.35, cx = (((t * 0.012) % 1.4) - 0.2) * W
                    const cu = (px - cx) / (0.5 * W) + 0.5, cdv = py - cy - Math.sin(px * 0.012) * mR * 0.2
                    if (cu > 0 && cu < 1 && Math.abs(cdv) < mR * 0.16 * Math.sin(Math.PI * cu)) { b = Math.max(b * 0.55, 0.12 + 0.25 * g); tn = 0.35 + 0.3 * g; s = -1 }
                    bB[k] = b; tB[k] = tn; sB[k] = s
                }
            }
            // ridges, far to near, down to the waterline
            for (let L = 0; L < RIDGES.length; L++) {
                const R = RIDGES[L], off = ps.x * (L + 1) * 8 + L * 997
                const pk = F.peak * H, base = lakeY - R.base * pk, amp = R.amp * pk
                const rAt = (x: number) => R.prof ? profile(x / W - F.peakAt + 0.68) + 0.06 * (ridgeAt((x + off) * R.freq * 4) - 0.35) : ridgeAt((x + off) * R.freq) * (1 - R.env + R.env * (0.35 + 0.65 * Math.exp(-(((x / W - F.peakAt - 0.05) / 0.22) ** 2))))
                for (let i = 0; i < cols; i++) {
                    const px = ox + (i + 0.5) * cs, wx = (px + off) * R.freq
                    const r = rAt(px), slope = (amp * (rAt(px + 3 * cs) - rAt(px - 3 * cs))) / (6 * cs)
                    let crest = base - amp * r
                    if (R.trees) { const tx = (px + off) / cs, ti = Math.floor(tx); if (hash(ti, 17) > 0.4) crest -= (1.5 + 3 * hash(ti, 5)) * cs * Math.max(0, 1 - Math.abs((tx % 1) - 0.5) * 1.8) }
                    const lit = clamp(0.5 - 1.2 * slope, 0.04, 1) // faces that drop toward the moon (right) are lit
                    const j0 = Math.max(0, Math.floor((crest - oy) / cs))
                    for (let j = j0; j < lake; j++) {
                        const k = j * cols + i, py = oy + (j + 0.5) * cs, dp = py - crest
                        const streak = 0.7 + 0.3 * noise1(wx * 9 + L * 11), fall = Math.exp(-dp / (pk * 0.45))
                        let b = R.b * (0.55 + 1.05 * lit * fall * streak), tn = R.tn - 0.06 + 0.3 * lit * fall
                        if (j === j0) { b += (0.18 + 0.32 * lit) * R.rim; tn += 0.3 * R.rim }
                        if (R.snow && r > 0.3 && dp < amp * (r - 0.25) * 0.55 * (0.35 + 0.65 * noise1(wx * 60 + 4))) { tn = 0.66 + 0.28 * lit; b = 0.24 + 0.6 * lit }
                        const mist = sstep(-0.05, 0, (py - lakeY) / H) * (0.45 + 0.55 * noise1(px * 0.006 - t * 0.04 * (L + 1) + L * 5))
                        b += 0.16 * mist; tn += (0.42 - tn) * 0.5 * mist
                        bB[k] = b; tB[k] = tn; sB[k] = -1
                    }
                }
            }
            // village lights along the shore
            for (let i = 0; i < cols; i++) if (hash(i, 41) > 0.93) { const k = (lake - 1) * cols + i; bB[k] = 0.45 + 0.35 * Math.sin(t * (1 + hash(i, 3) * 2) + i); sB[k] = hash(i, 9) > 0.3 ? WARM : WARM2 }
            // reservoir: rippled reflection of everything above, plus the moon's glitter path
            for (let j = lake; j < rows; j++) {
                const dj = j - lake, depth = dj / Math.max(1, rows - lake), src = lake - 1 - Math.floor(dj * 1.15)
                for (let i = 0; i < cols; i++) {
                    const k = j * cols + i, px = ox + (i + 0.5) * cs
                    const wob = Math.round(Math.sin(j * 0.9 + t * 1.7 + Math.sin(i * 0.05 + t * 0.3) * 2) * (0.5 + depth * 2.5))
                    const sk = clamp(src, 0, lake - 1) * cols + clamp(i + wob, 0, cols - 1)
                    let b = 0.05 + bB[sk] * (0.8 - 0.3 * depth) * (dj & 1 ? 0.5 : 1), tn = 0.1 + tB[sk] * 0.82, s = sB[sk] === WARM || sB[sk] === WARM2 ? sB[sk] : -1
                    const lane = Math.abs(px - moonX) / (mR * (0.9 + depth * 1.6)), gi = Math.floor((i + (j & 1) * 2) / 3)
                    if (lane < 1 && hash(gi, j + Math.floor(t * 5 + hash(j, gi) * 5)) > 0.7 + 0.25 * lane) { b = 0.3 + 0.45 * (1 - lane); s = lane < 0.15 && (j & 1) ? WHITE : COLD }
                    else if (s >= 0) b *= 0.7
                    bB[k] = b; tB[k] = tn; sB[k] = s
                }
            }
            // a shooting star every few seconds
            const n = Math.floor(t / 9), sp = (t % 9) / 0.9
            if (sp < 1) {
                const x0 = (0.55 + 0.4 * hash(n, 1)) * W, y0 = (0.05 + 0.25 * hash(n, 2)) * H
                for (let q = 0; q < 12; q++) {
                    const [ci, cj] = cellOf(x0 - sp * 0.22 * W + q * cs * 0.9, y0 + sp * 0.1 * H - q * cs * 0.4)
                    put(ci, cj, (1 - q / 12) * (1 - sp * 0.6), q < 2 ? WHITE : COLD)
                }
            }
        }

        const blit = (now: number) => {
            if (!atlas) return
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.clearRect(0, 0, cv.width, cv.height)
            const rev = still ? 2 : (now - t0) / 1300
            // keep the caption and the pause button on clean ground, like a cut in the halftone
            const label = caption ? (sierra ? "sierra de guadarrama · 40.73°n 4.00°w" : "cuatro torres · madrid · 40.48°n 3.69°w") : ""
            ctx.font = '10px "JetBrains Mono", ui-monospace, Menlo, monospace'
            const lw = label ? ctx.measureText(label).width : 0
            const holes: Rect[] = [[8, H - 54, 104, H - 4]]
            if (label) holes.push([W - 26 - lw, H - 32, W - 10, H - 6])
            for (let j = 0; j < rows; j++) {
                const rj = still ? 1 : sstep(0, 0.4, rev - (1 - j / rows) * 0.6)
                const ry = oy + (j + 0.5) * cs, edge = column > 0 ? sstep(-4, 28, ry) * sstep(H + 4, H - 44, ry) : 1 // full-bleed: melt into the page
                if (rj <= 0) continue
                for (let i = 0; i < cols; i++) {
                    const k = j * cols + i, cx = ox + (i + 0.5) * cs, cy = oy + (j + 0.5) * cs
                    const hole = holes.some(([x0, y0, x1, y1]) => cx > x0 && cx < x1 && cy > y0 && cy < y1) ? 0.25 : 1
                    const lv = Math.min(LEVELS, Math.round(bB[k] * mask[k] * rj * hole * edge * LEVELS + BAYER[(j & 3) * 4 + (i & 3)]))
                    if (lv <= 0) continue
                    const c = sB[k] >= 0 ? sB[k] : sierra ? DN + clamp(Math.round(tB[k] * (NN - 1)), 0, NN - 1) : clamp(Math.round(tB[k] * (DN - 1)), 0, DN - 1)
                    ctx.drawImage(atlas, lv * ga, c * ga, ga, ga, Math.round((ox + (i + 0.5) * cs) * dpr - ga / 2), Math.round((oy + (j + 0.5) * cs) * dpr - ga / 2), ga, ga)
                }
            }
            if (caption) {
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
                ctx.font = '10px "JetBrains Mono", ui-monospace, Menlo, monospace'
                ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillStyle = "#8A8DA3"
                ctx.fillText(label, W - 18, H - 14)
            }
        }

        const render = (now: number) => {
            const t = still ? (sierra ? 10 : 14) : now / 1000
            if (sierra) drawSierra(t); else drawTowers(t)
            blit(now)
        }
        const frame = (now: number) => {
            raf = 0
            if (!visible || document.hidden || disposed) return
            if (last && now - last < 33) { raf = requestAnimationFrame(frame); return }
            last = now
            const tx = pointer.on ? clamp(pointer.x / (W || 1) - 0.5, -0.5, 0.5) : 0, ty = pointer.on ? clamp(pointer.y / (H || 1) - 0.5, -0.5, 0.5) : 0
            ps.x += (tx - ps.x) * 0.05; ps.y += (ty - ps.y) * 0.05
            render(now)
            raf = requestAnimationFrame(frame)
        }
        const start = () => { if (!raf && !still && visible && !document.hidden && !disposed) raf = requestAnimationFrame(frame) }
        const onMove = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.on = pointer.y > -200 && pointer.y < r.height + 200 }
        const onScroll = () => { const r = cv.getBoundingClientRect(); scrollP = clamp(-r.top / (r.height || 1), 0, 1) }

        layout()
        t0 = performance.now()
        render(t0)
        const ro = new ResizeObserver(() => { layout(); render(performance.now()) })
        ro.observe(cv)
        const io = new IntersectionObserver((es) => {
            visible = es[0].isIntersecting
            if (visible) start(); else { cancelAnimationFrame(raf); raf = 0 }
        }, { threshold: 0.05 })
        io.observe(cv)
        const onVisibility = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0 } else start() }
        document.addEventListener("visibilitychange", onVisibility)
        if (!still) { window.addEventListener("pointermove", onMove, { passive: true }); window.addEventListener("scroll", onScroll, { passive: true }) }
        return () => {
            disposed = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect()
            document.removeEventListener("visibilitychange", onVisibility)
            window.removeEventListener("pointermove", onMove); window.removeEventListener("scroll", onScroll)
        }
    }, [scene, copy, cell, caption, column, paused, reduced])

    return (
        <div style={{ width: 1120, height: 840, position: "relative", background: "#0B0C16", ...style }}>
            <canvas aria-hidden="true" ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none" }} />
            {!reduced && <button type="button" aria-label={paused ? "Play background animation" : "Pause background animation"} aria-pressed={paused} onClick={() => setPaused((p) => !p)} style={{ position: "absolute", insetBlockEnd: 8, insetInlineStart: 12, minWidth: 44, minHeight: 44, padding: "8px 12px", background: "transparent", color: "#8A8DA3", border: 0, borderRadius: 4, cursor: "pointer", font: '11px "JetBrains Mono", monospace', pointerEvents: "auto" }}>{paused ? "[ play ]" : "[ pause ]"}</button>}
        </div>
    )
}

AsciiHorizon.defaultProps = { scene: "towers", copy: "hero", cell: 6, caption: true, column: 0 }

addPropertyControls(AsciiHorizon, {
    scene: { type: ControlType.Enum, title: "Scene", options: ["towers", "sierra"], optionTitles: ["Cuatro Torres", "Sierra"], defaultValue: "towers" },
    copy: { type: ControlType.Enum, title: "Copy area", options: ["hero", "contact", "none"], optionTitles: ["Hero", "Contact", "None"], defaultValue: "hero" },
    cell: { type: ControlType.Number, title: "Dot size", min: 4, max: 12, step: 1, defaultValue: 6 },
    caption: { type: ControlType.Boolean, title: "Caption", defaultValue: true },
    column: { type: ControlType.Number, title: "Copy column", min: 0, max: 1600, step: 10, defaultValue: 0, unit: "px" },
})
