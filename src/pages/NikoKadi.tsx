/* eslint-disable react/no-unknown-property */
'use client';
import { useState, useRef, useEffect, useCallback } from "react";
import { createWorker } from 'tesseract.js';
import html2canvas from 'html2canvas';
import Lanyard from '../components/niko-kadi/Lanyard';

/*
  NikoKadi.tsx  —  /niko-kadi  Full Production Implementation
  ─────────────────────────────────────────────────────
  Physics:  3D Physics via @react-three/rapier in Lanyard component.
  Card Face: HTML Overlay positioned absolute over the 3D Canvas.
  OCR:      Tesseract.js for parsing IEBC screenshots.
  Share:    html2canvas -> navigator.share/download.
*/

// ─── Types ──────────────────────────────────────────────────────────────────
type IEBCField =
    | 'firstName'
    | 'surname'
    | 'county'
    | 'constituency'
    | 'ward'
    | 'pollingCentre'
    | 'pollingStation'
    | 'pollingStream';

interface VoterDataRecord extends Record<IEBCField, string> { }

interface FieldConfig {
    key: IEBCField;
    label: string;
    vis: boolean;
    initial: boolean;
}

const FIELDS: FieldConfig[] = [
    { key: "firstName", label: "First Name", vis: true, initial: false },
    { key: "surname", label: "Surname", vis: false, initial: true },
    { key: "county", label: "County", vis: true, initial: false },
    { key: "constituency", label: "Constituency", vis: true, initial: false },
    { key: "ward", label: "Ward", vis: false, initial: false },
    { key: "pollingCentre", label: "Polling Centre", vis: false, initial: false },
    { key: "pollingStation", label: "Polling Station", vis: false, initial: false },
    { key: "pollingStream", label: "Stream No.", vis: false, initial: false },
];

const EMPTY: VoterDataRecord = Object.fromEntries(FIELDS.map(f => [f.key, ""])) as VoterDataRecord;
const DEF_VIS = Object.fromEntries(FIELDS.map(f => [f.key, f.vis]));
const WORDS = ["KURA", "HAKI", "KADI", "KENYA", "UCHAGUZI", "UHURU", "WANANCHI", "AMANI", "USALAMA"];

const FIELD_PATTERNS: Record<string, RegExp> = {
    firstName: /First Name[:\s]+([A-Z]+)/i,
    surname: /Surname[:\s]+([A-Z]+)/i,
    county: /County Name[:\s]+([A-Z\s]+?)(?=\s+Constituency|$)/i,
    constituency: /Constituency Name[:\s]+([A-Z\s]+?)(?=\s+Ward|$)/i,
    ward: /Ward Name[:\s]+([A-Z\s]+?)(?=\s+Polling|$)/i,
    pollingCentre: /Polling Centre Name[:\s]+([A-Z\s]+?)(?=\s+Polling Station Name|$)/i,
    pollingStation: /Polling Station Name[:\s]+([A-Z\s]+?)(?=\s+Polling Station No|$)/i,
    pollingStream: /Polling Station No \(Stream\)[:\s]+(\d+)/i,
};

// ─── Components ──────────────────────────────────────────────────────────────

function Eye({ on, onClick }: { on: boolean; onClick: () => void }) {
    return (
        <button
            onClick={e => { e.stopPropagation(); onClick(); }}
            style={{
                background: "none", border: "none", padding: "3px",
                cursor: "pointer", opacity: on ? 0.88 : 0.28,
                transition: "opacity .14s", display: "flex", alignItems: "center", flexShrink: 0,
            }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
                stroke={on ? "#5ddd96" : "#999"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {on
                    ? <><path d="M1 8C3 4.5 13 4.5 15 8C13 11.5 3 11.5 1 8Z" /><circle cx="8" cy="8" r="2.3" /></>
                    : <><line x1="3" y1="3" x2="13" y2="13" /><path d="M6.5 4.2C3.2 5.5 1.5 6.8 1 8C2.3 10.8 5 13 9 13" /><path d="M10 11.2C12.5 9.8 14.2 9 15 8C13.5 5.1 10.5 3 7 3" /></>
                }
            </svg>
        </button>
    );
}

function CardFace({ voter, vis, onToggle, faceRef }: { voter: VoterDataRecord; vis: Record<string, boolean>; onToggle: (k: string) => void; faceRef: any }) {
    const has = FIELDS.some(f => voter[f.key]);
    const name = [
        vis.firstName && voter.firstName ? voter.firstName : "",
        vis.surname && voter.surname ? voter.surname[0].toUpperCase() + "." : "",
    ].filter(Boolean).join(" ") || null;

    const con = vis.constituency && voter.constituency ? voter.constituency : null;
    const cty = vis.county && voter.county ? voter.county : null;
    const nfs = name ? (name.length > 12 ? 24 : name.length > 8 ? 29 : 34) : 34;

    return (
        <div ref={faceRef} style={{
            width: 224, height: 318, borderRadius: 14, overflow: "hidden", position: "relative",
            background: "linear-gradient(152deg,#0d1b10 0%,#07100a 55%,#040c06 100%)",
            boxShadow: "0 50px 120px rgba(0,0,0,.9),0 0 0 .7px rgba(255,255,255,.07),0 0 0 1.5px rgba(0,0,0,.85),inset 0 1px 0 rgba(255,255,255,.05)",
            userSelect: "none", WebkitUserSelect: "none",
            fontFamily: "'Gill Sans','Trebuchet MS',system-ui,sans-serif",
        }}>
            {/* BG word texture */}
            <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
                {WORDS.map((w, i) => (
                    <div key={i} style={{
                        position: "absolute",
                        left: `${-18 + (i % 3) * 36}%`,
                        top: `${-10 + Math.floor(i / 3) * 34 + (i % 2) * 14}%`,
                        fontSize: 50 + (i % 3) * 16, fontWeight: 800,
                        color: "rgba(255,255,255,.036)",
                        transform: `rotate(${-12 + i * 8}deg)`,
                        lineHeight: 1, whiteSpace: "nowrap",
                        fontFamily: "'Georgia','Times New Roman',serif",
                    }}>{w}</div>
                ))}
            </div>
            {/* Kenya flag top */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, display: "flex", zIndex: 1 }}>
                {["#0a0a0a", "#b00c0c", "#006c30", "#b00c0c", "#0a0a0a"].map((c, i) => (
                    <div key={i} style={{ flex: 1, background: c }} />
                ))}
            </div>
            {/* Header */}
            <div style={{
                position: "absolute", top: 11, left: 13, right: 13, zIndex: 1,
                display: "flex", justifyBetween: "space-between", alignItems: "center",
            } as any}>
                <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: ".26em", color: "rgba(255,255,255,.36)" }}>IEBC · KENYA</span>
                <span style={{ fontSize: 7.5, color: "rgba(255,255,255,.2)", letterSpacing: ".05em" }}>{new Date().getFullYear()}</span>
            </div>
            {/* Content */}
            <div style={{
                position: "absolute", top: 28, bottom: 0, left: 0, right: 0,
                padding: "12px 14px 13px",
                display: "flex", flexDirection: "column", justifyContent: "flex-end", zIndex: 2,
            }}>
                {/* Name */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4, marginBottom: 9 }}>
                    <div style={{
                        fontSize: nfs, fontWeight: 700, lineHeight: 1.06, flex: 1,
                        color: name ? "#fff" : "rgba(255,255,255,.14)",
                        fontFamily: "'Georgia','Times New Roman',serif", letterSpacing: ".01em",
                    }}>
                        {name || (has ? "· · ·" : "YOUR NAME")}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 0, paddingTop: 6 }}>
                        {voter.firstName && <Eye on={vis.firstName} onClick={() => onToggle("firstName")} />}
                        {voter.surname && <Eye on={vis.surname} onClick={() => onToggle("surname")} />}
                    </div>
                </div>
                {/* Constituency */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, marginBottom: 4 }}>
                    <span style={{
                        fontSize: 12, fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", flex: 1,
                        color: con ? "rgba(255,255,255,.82)" : "rgba(255,255,255,.17)"
                    }}>
                        {con || (voter.constituency ? "· · ·" : "CONSTITUENCY")}
                    </span>
                    {voter.constituency && <Eye on={vis.constituency} onClick={() => onToggle("constituency")} />}
                </div>
                {/* County */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, marginBottom: 14 }}>
                    <span style={{
                        fontSize: 10.5, fontWeight: 500, letterSpacing: ".06em", textTransform: "uppercase", flex: 1,
                        color: cty ? "rgba(255,255,255,.46)" : "rgba(255,255,255,.12)"
                    }}>
                        {cty || (voter.county ? "· · ·" : "COUNTY · KENYA")}
                    </span>
                    {voter.county && <Eye on={vis.county} onClick={() => onToggle("county")} />}
                </div>
                {/* Badge */}
                <div style={{ marginBottom: 11 }}>
                    <div style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "4.5px 11px 4.5px 8px", borderRadius: 5,
                        background: has ? "rgba(28,140,65,.2)" : "rgba(255,255,255,.05)",
                        border: `1px solid ${has ? "rgba(50,200,100,.32)" : "rgba(255,255,255,.07)"}`,
                        transition: "all .4s",
                    }}>
                        {has && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#32c864", flexShrink: 0 }} />}
                        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: ".22em", color: has ? "#5ddd96" : "rgba(255,255,255,.24)" }}>
                            {has ? "REGISTERED VOTER" : "AWAITING DETAILS"}
                        </span>
                    </div>
                </div>
                {/* Footer */}
                <div style={{
                    paddingTop: 8, borderTop: "1px solid rgba(255,255,255,.065)",
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                    <span style={{ fontSize: 7, letterSpacing: ".14em", fontWeight: 600, color: "rgba(255,255,255,.2)" }}>
                        #TUKOKADI · NASAKA
                    </span>
                    <span style={{ fontSize: 13, lineHeight: 1 }}>🇰🇪</span>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function NikoKadi() {
    const [voter, setVoter] = useState<VoterDataRecord>(EMPTY);
    const [vis, setVis] = useState<Record<string, boolean>>(DEF_VIS);
    const [mode, setMode] = useState<"upload" | "manual">("upload");
    const [mobile, setMobile] = useState(false);
    const [shared, setShared] = useState(false);
    const [isOCRRunning, setIsOCRRunning] = useState(false);
    const [drop, setDrop] = useState(false);

    const faceRef = useRef<HTMLDivElement>(null);
    const workerRef = useRef<any>(null);

    useEffect(() => {
        const fn = () => setMobile(window.innerWidth < 760);
        fn();
        window.addEventListener("resize", fn);
        return () => window.removeEventListener("resize", fn);
    }, []);

    // Initialize Tesseract Worker
    useEffect(() => {
        const initWorker = async () => {
            const worker = await createWorker('eng');
            workerRef.current = worker;
        };
        initWorker();
        return () => {
            if (workerRef.current) workerRef.current.terminate();
        };
    }, []);

    const tog = (k: string) => setVis(p => ({ ...p, [k]: !p[k] }));
    const hasData = FIELDS.some(f => voter[f.key]);

    const handleOCR = async (file: File) => {
        if (!workerRef.current) return;
        setIsOCRRunning(true);
        try {
            const { data: { text } } = await workerRef.current.recognize(file);
            const newData = { ...EMPTY };
            Object.entries(FIELD_PATTERNS).forEach(([key, reg]) => {
                const match = text.match(reg);
                if (match) newData[key as IEBCField] = match[1].trim().toUpperCase();
            });
            setVoter(newData);
            setMode("manual");
        } catch (err) {
            console.error("OCR Error:", err);
        } finally {
            setIsOCRRunning(false);
        }
    };

    const handleShare = async () => {
        setShared(true);
        setTimeout(() => setShared(false), 2200);

        if (faceRef.current) {
            const canvas = await html2canvas(faceRef.current, { scale: 2, useCORS: true });
            const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/png"));
            if (!blob) return;

            const file = new File([blob], "niko-kadi.png", { type: "image/png" });

            if (navigator.share && (navigator as any).canShare?.({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: "Niko Kadi — Verified Voter",
                        text: "#TukoKadi #NikoKadi #IEBC",
                    });
                } catch (_) { }
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "niko-kadi.png";
                a.click();
                URL.revokeObjectURL(url);
            }
        }
    };

    return (
        <div style={{
            display: "flex", flexDirection: mobile ? "column" : "row",
            height: mobile ? "auto" : "100vh", minHeight: "100vh",
            background: "#060a07",
            fontFamily: "'Gill Sans','Trebuchet MS',system-ui,sans-serif",
            overflow: mobile ? "auto" : "hidden",
        }}>
            <style>{`
        @keyframes nkpulse{0%,100%{opacity:.25}50%{opacity:.6}}
        @keyframes nkfade{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
        input:focus{border-color:rgba(80,210,130,.48)!important;box-shadow:0 0 0 2.5px rgba(80,210,130,.1);}
        input::placeholder{color:rgba(255,255,255,.2)!important;}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}
      `}</style>

            {/* Left panel */}
            <div style={{
                width: mobile ? "100%" : 365, flexShrink: 0,
                padding: mobile ? "28px 22px 24px" : "36px 28px 28px",
                borderRight: mobile ? "none" : "1px solid rgba(255,255,255,.07)",
                borderBottom: mobile ? "1px solid rgba(255,255,255,.07)" : "none",
                display: "flex", flexDirection: "column",
                overflowY: mobile ? "visible" : "auto",
                order: mobile ? 2 : 1,
                background: "#080c09"
            }}>
                {/* Brand */}
                <div style={{ marginBottom: 26 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
                        <div style={{
                            width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                            background: "conic-gradient(#060606 0 33.3%,#b80000 33.3% 66.6%,#006c30 66.6% 100%)",
                            border: "1.5px solid rgba(255,255,255,.14)",
                        }} />
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: ".13em", color: "#fff", fontFamily: "'Georgia','Times New Roman',serif", lineHeight: 1.1 }}>
                                NIKO KADI
                            </div>
                            <div style={{ fontSize: 9, color: "rgba(255,255,255,.28)", letterSpacing: ".08em", marginTop: 1 }}>
                                NASAKA · CEKA INITIATIVE
                            </div>
                        </div>
                    </div>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,.42)", lineHeight: 1.72, margin: 0 }}>
                        Get your verified voter lanyard. Share with{" "}
                        <span style={{ color: "#5ddd96", fontWeight: 600 }}>#TukoKadi</span>.
                    </p>
                </div>

                {/* Input */}
                <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 0, marginBottom: 20, background: "rgba(255,255,255,0.04)", borderRadius: 9, padding: 3 }}>
                        {[["upload", "Upload Screenshot"], ["manual", "Fill Manually"]].map(([k, l]) => (
                            <button key={k} onClick={() => setMode(k as any)} style={{
                                flex: 1, padding: "7px 10px",
                                background: mode === k ? "rgba(255,255,255,.1)" : "transparent",
                                border: "none", borderRadius: 7,
                                color: mode === k ? "#fff" : "rgba(255,255,255,.38)",
                                fontSize: 11.5, fontWeight: mode === k ? 600 : 400,
                                cursor: "pointer", transition: "all .15s",
                                letterSpacing: ".04em", fontFamily: "inherit",
                            }}>{l}</button>
                        ))}
                    </div>

                    {mode === "upload" && (
                        <div
                            onDragOver={e => { e.preventDefault(); setDrop(true); }}
                            onDragLeave={() => setDrop(false)}
                            onDrop={e => { e.preventDefault(); setDrop(false); if (e.dataTransfer.files[0]) handleOCR(e.dataTransfer.files[0]); }}
                            onClick={() => document.getElementById("nk-up")?.click()}
                            style={{
                                border: `1.5px dashed ${drop ? "rgba(93,221,150,.65)" : "rgba(255,255,255,.12)"}`,
                                borderRadius: 11, padding: "30px 20px", marginBottom: 12,
                                display: "flex", flexDirection: "column", alignItems: "center", gap: 11,
                                cursor: "pointer", transition: "all .18s",
                                background: drop ? "rgba(93,221,150,.04)" : "rgba(255,255,255,.018)",
                            }}>
                            <svg width="38" height="38" viewBox="0 0 38 38" fill="none"
                                stroke="rgba(255,255,255,.28)" strokeWidth="1.4" strokeLinecap="round">
                                <rect x="4" y="4" width="30" height="30" rx="6" />
                                <path d="M13 19L19 13L25 19" /><line x1="19" y1="13" x2="19" y2="27" />
                            </svg>
                            <div style={{ textAlign: "center", lineHeight: 1.65 }}>
                                <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.5)" }}>
                                    {isOCRRunning ? "Reading particulars..." : "Drop your IEBC screenshot here"}
                                </div>
                                <div style={{ fontSize: 11, color: "rgba(255,255,255,.25)", marginTop: 2 }}>PNG · JPG · WebP</div>
                            </div>
                            <input id="nk-up" type="file" accept="image/*" style={{ display: "none" }}
                                onChange={e => { if (e.target.files?.[0]) handleOCR(e.target.files[0]); }} />
                        </div>
                    )}

                    {mode === "manual" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 9, animation: "nkfade .2s ease" }}>
                            {FIELDS.map(({ key, label }) => (
                                <div key={key}>
                                    <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: ".1em", color: "rgba(255,255,255,.32)", marginBottom: 4 }}>
                                        {label.toUpperCase()}
                                    </div>
                                    <input
                                        type="text" value={voter[key]} placeholder={label}
                                        autoComplete="off" spellCheck={false}
                                        onChange={e => setVoter(p => ({ ...p, [key]: e.target.value.toUpperCase() }))}
                                        style={{
                                            width: "100%", padding: "8px 11px", borderRadius: 7,
                                            background: "rgba(255,255,255,.055)", border: "1px solid rgba(255,255,255,.1)",
                                            color: "#fff", fontSize: 12.5, outline: "none", boxSizing: "border-box",
                                            fontFamily: "'Gill Sans','Trebuchet MS',system-ui,sans-serif", transition: "border-color .15s",
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Share */}
                <button onClick={handleShare} disabled={!hasData} style={{
                    marginTop: 22, width: "100%", padding: "13px",
                    borderRadius: 9, border: "none",
                    background: hasData
                        ? "linear-gradient(135deg,#0c2014 0%,#1c6638 100%)"
                        : "rgba(255,255,255,.045)",
                    color: hasData ? "#fff" : "rgba(255,255,255,.18)",
                    fontSize: 13, fontWeight: 600, letterSpacing: ".07em",
                    cursor: hasData ? "pointer" : "not-allowed",
                    fontFamily: "inherit", transition: "all .22s",
                    boxShadow: hasData ? "0 4px 22px rgba(28,120,68,.4)" : "none",
                }}>
                    {shared ? "✓  Shared!" : "#TUKOKADI — Share My Card"}
                </button>

                {/* Disclaimer */}
                <div style={{
                    marginTop: 20, paddingTop: 18,
                    borderTop: "1px solid rgba(255,255,255,.06)",
                    fontSize: 10.5, color: "rgba(255,255,255,.22)", lineHeight: 1.72,
                }}>
                    <span style={{ fontWeight: 600, color: "rgba(255,255,255,.38)" }}>Your data is safe.</span>{" "}
                    We do not store, transmit, or share your voter details. All processing happens in your browser — nothing leaves your device.
                    <a href="https://verify.iebc.or.ke" target="_blank" rel="noopener noreferrer"
                        style={{ color: "rgba(93,221,150,.6)", textDecoration: "none", display: "block", marginTop: 5, fontSize: 10 }}>
                        verify.iebc.or.ke →
                    </a>
                </div>
            </div>

            {/* Right Canvas / 3D Scene */}
            <div style={{ flex: 1, position: "relative", background: "#050908" }}>
                <Lanyard />
                {/* Overlay CardFace over the 3D Canvas */}
                <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -10%)", // Positioned to match the card in 3D
                    pointerEvents: "none", // Allow clicks to pass through to the 3D scene (except toggles)
                    zIndex: 10
                }}>
                    <div style={{ pointerEvents: "auto" }}>
                        <CardFace voter={voter} vis={vis} onToggle={tog} faceRef={faceRef} />
                    </div>
                </div>

                {/* Drag hint */}
                <div style={{
                    position: "absolute", bottom: 22, left: "50%", transform: "translateX(-50%)",
                    fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: ".2em",
                    pointerEvents: "none", whiteSpace: "nowrap",
                    animation: "nkpulse 3s ease-in-out infinite",
                }}>
                    ← DRAG THE CARD →
                </div>
            </div>
        </div>
    );
}
