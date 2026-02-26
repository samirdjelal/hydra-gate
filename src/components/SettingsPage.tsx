import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
    Settings, X, AlertTriangle, CheckCircle2,
    Shuffle, BarChart2, Gauge, Scale, Link2
} from "lucide-react";

interface SettingsPageProps {
    isServerActive: boolean;
}

// ─── Rotation modes config ───────────────────────────────────────────────────

type ModeId = "round_robin" | "random" | "least_latency" | "weighted" | "sticky";

interface ModeOption {
    id: ModeId;
    icon: React.ReactNode;
    label: string;
    description: string;
    badge?: string;
}

const MODES: ModeOption[] = [
    {
        id: "round_robin",
        icon: <Shuffle className="w-5 h-5" />,
        label: "Round Robin",
        description: "Cycles through all alive proxies in strict order. Guarantees even distribution.",
    },
    {
        id: "random",
        icon: <BarChart2 className="w-5 h-5" />,
        label: "Random",
        description: "Picks a random alive proxy on every new connection. Simple and unpredictable.",
    },
    {
        id: "least_latency",
        icon: <Gauge className="w-5 h-5" />,
        label: "Least Latency",
        description: "Always routes through the proxy with the lowest measured latency. Best for speed.",
        badge: "⚡ Fastest",
    },
    {
        id: "weighted",
        icon: <Scale className="w-5 h-5" />,
        label: "Weighted",
        description: "Probabilistic selection — lower latency = higher chance of being chosen. Balances speed and distribution.",
    },
    {
        id: "sticky",
        icon: <Link2 className="w-5 h-5" />,
        label: "Time-Based Sticky",
        description: "All connections within a 10-minute window use the same proxy. Rotates automatically when the window expires — great for session stability.",
        badge: "⏱ Auto-rotate",
    },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function SettingsPage({ isServerActive }: SettingsPageProps) {
    // ── Port state ──────────────────────────────────────────────────────────
    const [portInput, setPortInput] = useState("");
    const [savedPort, setSavedPort] = useState<number | null>(null);
    const [portError, setPortError] = useState<string | null>(null);
    const [portSuccess, setPortSuccess] = useState(false);

    // ── Rotation state ──────────────────────────────────────────────────────
    const [activeMode, setActiveMode] = useState<ModeId>("round_robin");
    const [savingMode, setSavingMode] = useState<ModeId | null>(null);

    useEffect(() => {
        invoke<number>("get_listen_port").then(p => {
            setSavedPort(p);
            setPortInput(String(p));
        });
        invoke<string>("get_rotation_mode").then(m => setActiveMode(m as ModeId));
    }, []);

    // ── Port handlers ────────────────────────────────────────────────────────
    const handleSavePort = async () => {
        setPortError(null);
        setPortSuccess(false);
        const port = parseInt(portInput, 10);
        if (isNaN(port) || port < 1024 || port > 65535) {
            setPortError("Port must be between 1024 and 65535.");
            return;
        }
        try {
            await invoke("set_listen_port", { port });
            setSavedPort(port);
            setPortSuccess(true);
            setTimeout(() => setPortSuccess(false), 3000);
        } catch (e: unknown) {
            setPortError(typeof e === "string" ? e : "Failed to save port.");
        }
    };

    // ── Rotation handlers ────────────────────────────────────────────────────
    const handleSelectMode = async (id: ModeId) => {
        if (id === activeMode) return;
        setSavingMode(id);
        try {
            await invoke("set_rotation_mode", { mode: id });
            setActiveMode(id);
        } catch (e) {
            console.error("Failed to set rotation mode:", e);
        } finally {
            setSavingMode(null);
        }
    };

    const isDirty = portInput !== String(savedPort);
    const portNum = parseInt(portInput, 10);
    const isValid = !isNaN(portNum) && portNum >= 1024 && portNum <= 65535;

    return (
        <div className="flex flex-col gap-5 animate-fade-up">

            {/* Section header */}
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-hydra-accent/10 border border-hydra-accent/20 flex items-center justify-center">
                    <Settings className="w-4 h-4 text-hydra-accent" />
                </div>
                <div>
                    <h2 className="text-sm font-semibold text-white">Settings</h2>
                    <p className="text-xs text-gray-600">Profile & routing configuration</p>
                </div>
            </div>

            {/* ── Listen Port ─────────────────────────────────────────────── */}
            <div className="gradient-border bg-hydra-card rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-hydra-border">
                    <h3 className="text-sm font-semibold text-white">Listen Port</h3>
                    <p className="text-xs text-gray-600 mt-0.5">
                        SOCKS5 port at <span className="font-mono text-gray-500">127.0.0.1</span>
                    </p>
                </div>
                <div className="px-5 py-4 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-hydra-dark border border-hydra-border text-gray-600 text-sm font-mono select-none whitespace-nowrap">
                            127.0.0.1 :
                        </div>
                        <input
                            type="number"
                            min={1024}
                            max={65535}
                            value={portInput}
                            onChange={e => { setPortInput(e.target.value); setPortError(null); setPortSuccess(false); }}
                            onKeyDown={e => e.key === "Enter" && isValid && isDirty && handleSavePort()}
                            className="
                                w-28 bg-hydra-dark border border-hydra-border rounded-xl px-3 py-2.5
                                text-sm font-mono text-white focus:outline-none focus:border-hydra-accent/50
                                focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] transition-all duration-200
                                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                            "
                        />
                        <button
                            onClick={handleSavePort}
                            disabled={!isDirty || !isValid}
                            className="
                                px-4 py-2.5 rounded-xl text-sm font-semibold bg-hydra-accent hover:bg-blue-500 text-white
                                disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-hydra-accent
                                transition-all duration-200 shadow-[0_0_16px_rgba(59,130,246,0.25)]
                                hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] active:scale-95
                            "
                        >
                            Save
                        </button>
                        {isDirty && (
                            <button
                                onClick={() => { setPortInput(String(savedPort)); setPortError(null); }}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:text-white hover:bg-hydra-border transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {portError && (
                        <div className="flex items-center gap-2 text-xs text-hydra-danger bg-hydra-danger/10 border border-hydra-danger/20 rounded-lg px-3 py-2">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {portError}
                        </div>
                    )}
                    {portSuccess && (
                        <div className="flex items-center gap-2 text-xs text-hydra-success bg-hydra-success/10 border border-hydra-success/20 rounded-lg px-3 py-2">
                            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                            Saved! {isServerActive ? "Restart the server to apply." : "Start the server to apply."}
                        </div>
                    )}
                    {isServerActive && isDirty && !portError && !portSuccess && (
                        <div className="flex items-center gap-2 text-xs text-hydra-warning bg-hydra-warning/10 border border-hydra-warning/20 rounded-lg px-3 py-2">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                            Server is running — stop & restart to apply the new port.
                        </div>
                    )}
                </div>
            </div>

            {/* ── Rotation Mode ────────────────────────────────────────────── */}
            <div className="gradient-border bg-hydra-card rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-hydra-border">
                    <h3 className="text-sm font-semibold text-white">Proxy Rotation</h3>
                    <p className="text-xs text-gray-600 mt-0.5">
                        How upstream proxies are selected for each new connection. Takes effect immediately.
                    </p>
                </div>
                <div className="p-3 grid grid-cols-1 gap-2">
                    {MODES.map(m => {
                        const isActive = activeMode === m.id;
                        const isSaving = savingMode === m.id;
                        return (
                            <button
                                key={m.id}
                                onClick={() => handleSelectMode(m.id)}
                                disabled={isSaving}
                                className={`
                                    group relative flex items-start gap-4 w-full text-left
                                    px-4 py-3.5 rounded-xl border transition-all duration-200
                                    ${isActive
                                        ? 'bg-hydra-accent/10 border-hydra-accent/30 shadow-[0_0_16px_rgba(59,130,246,0.12)]'
                                        : 'bg-hydra-dark border-hydra-border hover:border-gray-600 hover:bg-hydra-card-hover'
                                    }
                                `}
                            >
                                {/* Icon */}
                                <div className={`
                                    mt-0.5 flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center
                                    transition-all duration-200
                                    ${isActive
                                        ? 'bg-hydra-accent/20 text-hydra-accent'
                                        : 'bg-hydra-card text-gray-600 group-hover:text-gray-400'
                                    }
                                `}>
                                    {m.icon}
                                </div>

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                                            {m.label}
                                        </span>
                                        {m.badge && (
                                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-hydra-accent/10 text-hydra-accent border border-hydra-accent/20">
                                                {m.badge}
                                            </span>
                                        )}
                                        {isSaving && (
                                            <span className="text-[10px] text-gray-500 animate-pulse">Applying…</span>
                                        )}
                                    </div>
                                    <p className={`text-xs mt-0.5 leading-relaxed ${isActive ? 'text-gray-400' : 'text-gray-600 group-hover:text-gray-500'}`}>
                                        {m.description}
                                    </p>
                                </div>

                                {/* Active indicator */}
                                {isActive && (
                                    <div className="flex-shrink-0 mt-1">
                                        <div className="w-2 h-2 rounded-full bg-hydra-accent" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
