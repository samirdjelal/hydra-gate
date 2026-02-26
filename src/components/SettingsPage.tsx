import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
    Settings, X, AlertTriangle, CheckCircle2,
    Shuffle, BarChart2, Gauge, Scale, Link2, Pin, Globe, Lock, Network
} from "lucide-react";

interface SettingsPageProps {
    isServerActive: boolean;
}

// ─── Rotation modes config ───────────────────────────────────────────────────

type ModeId = "round_robin" | "random" | "least_latency" | "weighted" | "time_sticky" | "ip_sticky";

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
        id: "time_sticky",
        icon: <Link2 className="w-5 h-5" />,
        label: "Time-Based Sticky",
        description: "All connections within a 10-minute window use the same proxy. Rotates automatically when the window expires — great for session stability.",
        badge: "⏱ Auto-rotate",
    },
    {
        id: "ip_sticky",
        icon: <Pin className="w-5 h-5" />,
        label: "IP-Based Sticky",
        description: "Hashes the target hostname — the same destination always routes through the same proxy, regardless of time. Ideal for per-site identity consistency.",
        badge: "🎯 Per-site",
    },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function SettingsPage({ isServerActive }: SettingsPageProps) {
    // ── Port state ──────────────────────────────────────────────────────────
    const [portInput, setPortInput] = useState("");
    const [savedPort, setSavedPort] = useState<number | null>(null);
    const [portError, setPortError] = useState<string | null>(null);
    const [portSuccess, setPortSuccess] = useState(false);

    // ── Host state ──────────────────────────────────────────────────────────
    const [listenHost, setListenHost] = useState<"127.0.0.1" | "0.0.0.0">("127.0.0.1");
    const [hostSaving, setHostSaving] = useState(false);
    const [hostSuccess, setHostSuccess] = useState(false);

    // ── Rotation state ──────────────────────────────────────────────────────
    const [activeMode, setActiveMode] = useState<ModeId>("round_robin");
    const [savingMode, setSavingMode] = useState<ModeId | null>(null);

    // ── VPN state ───────────────────────────────────────────────────────────
    const [isVpnActive, setIsVpnActive] = useState(false);

    useEffect(() => {
        invoke<number>("get_listen_port").then(p => {
            setSavedPort(p);
            setPortInput(String(p));
        });
        invoke<string>("get_listen_host").then(h => setListenHost(h as "127.0.0.1" | "0.0.0.0"));
        invoke<string>("get_rotation_mode").then(m => setActiveMode(m as ModeId));

        // Poll VPN Status
        const fetchVpnStatus = async () => {
            try {
                const status = await invoke<boolean>("get_vpn_status");
                setIsVpnActive(status);
            } catch (e) {
                // Ignore gracefully on desktop where command might fail if not implemented nicely
            }
        };
        fetchVpnStatus();
        const vpnInterval = setInterval(fetchVpnStatus, 1500);

        return () => clearInterval(vpnInterval);
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

    // ── Host handlers ────────────────────────────────────────────────────────
    const handleSelectHost = async (host: "127.0.0.1" | "0.0.0.0") => {
        if (host === listenHost) return;
        setHostSaving(true);
        setHostSuccess(false);
        try {
            await invoke("set_listen_host", { host });
            setListenHost(host);
            setHostSuccess(true);
            setTimeout(() => setHostSuccess(false), 3000);
        } catch (e) {
            console.error("Failed to set listen host:", e);
        } finally {
            setHostSaving(false);
        }
    };

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

    // ── VPN Handler ─────────────────────────────────────────────────────────
    const toggleVpn = async () => {
        const newState = !isVpnActive;
        // Optimistic UI update, polling will fix it if it fails
        setIsVpnActive(newState);
        try {
            if (newState) {
                await invoke("start_vpn");
            } else {
                await invoke("stop_vpn");
            }
        } catch (e) {
            console.error(e);
            setIsVpnActive(!newState);
            alert("Failed to toggle VPN (Is this running on Android?)");
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
                    <p className="text-xs text-gray-600">Profile &amp; routing configuration</p>
                </div>
            </div>

            {/* ── Android VPN Mode ─────────────────────────────────────────────────── */}
            <div className="gradient-border bg-hydra-card rounded-2xl overflow-hidden p-5 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Network className="w-4 h-4 text-blue-400" /> System VPN Mode
                    </h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-[250px]">
                        Route all Android device traffic through HydraGate. (Requires system permission)
                    </p>
                </div>

                <button
                    onClick={toggleVpn}
                    className={`
                        group relative flex items-center gap-2.5 px-4 py-2 rounded-xl font-semibold text-sm
                        transition-all duration-300 outline-none
                        ${isVpnActive
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/25 hover:bg-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                            : 'bg-hydra-dark text-gray-400 border border-hydra-border hover:border-gray-500 hover:text-white hover:bg-hydra-card-hover'
                        }
                    `}
                >
                    <span>{isVpnActive ? 'VPN Active' : 'Enable VPN'}</span>
                </button>
            </div>

            {/* ── Listen Endpoint (Interface + Port unified card) ───────────── */}
            <div className="gradient-border bg-hydra-card rounded-2xl overflow-hidden">

                {/* Card header */}
                <div className="px-5 py-4 border-b border-hydra-border">
                    <h3 className="text-sm font-semibold text-white">Listen Endpoint</h3>
                    <p className="text-xs text-gray-600 mt-0.5">
                        Network interface and port the SOCKS5 server binds to
                    </p>
                </div>

                {/* ── Interface selector ── */}
                <div className="px-5 pt-4 pb-4 flex flex-col gap-3">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Interface</p>
                    <div className="grid grid-cols-2 gap-2">
                        {(["127.0.0.1", "0.0.0.0"] as const).map(host => {
                            const isActive = listenHost === host;
                            const isLoopback = host === "127.0.0.1";
                            return (
                                <button
                                    key={host}
                                    onClick={() => handleSelectHost(host)}
                                    disabled={hostSaving}
                                    className={`
                                        group flex items-center gap-3 px-4 py-3 rounded-xl border
                                        transition-all duration-200 text-left
                                        ${isActive
                                            ? "bg-hydra-accent/10 border-hydra-accent/30 shadow-[0_0_16px_rgba(59,130,246,0.12)]"
                                            : "bg-hydra-dark border-hydra-border hover:border-gray-600 hover:bg-hydra-card-hover"
                                        }
                                    `}
                                >
                                    <div className={`
                                        flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
                                        transition-all duration-200
                                        ${isActive
                                            ? "bg-hydra-accent/20 text-hydra-accent"
                                            : "bg-hydra-card text-gray-600 group-hover:text-gray-400"
                                        }
                                    `}>
                                        {isLoopback ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                                    </div>
                                    <div>
                                        <p className={`text-xs font-mono font-semibold ${isActive ? "text-white" : "text-gray-400 group-hover:text-white"}`}>
                                            {host}
                                        </p>
                                        <p className={`text-[10px] mt-0.5 ${isActive ? "text-gray-400" : "text-gray-600"}`}>
                                            {isLoopback ? "Loopback only" : "All interfaces"}
                                        </p>
                                    </div>
                                    {isActive && (
                                        <div className="ml-auto flex-shrink-0">
                                            <div className="w-2 h-2 rounded-full bg-hydra-accent" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {hostSuccess && (
                        <div className="flex items-center gap-2 text-xs text-hydra-success bg-hydra-success/10 border border-hydra-success/20 rounded-lg px-3 py-2">
                            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                            Saved! {isServerActive ? "Restart the server to apply." : "Start the server to apply."}
                        </div>
                    )}
                    {listenHost === "0.0.0.0" && (
                        <div className="flex items-center gap-2 text-xs text-hydra-warning bg-hydra-warning/10 border border-hydra-warning/20 rounded-lg px-3 py-2">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                            Wildcard binding — the proxy will be reachable from other devices on your network.
                        </div>
                    )}
                    {isServerActive && hostSuccess && (
                        <div className="flex items-center gap-2 text-xs text-hydra-warning bg-hydra-warning/10 border border-hydra-warning/20 rounded-lg px-3 py-2">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                            Server is running — stop &amp; restart to apply the new interface.
                        </div>
                    )}
                </div>

                {/* Thin internal divider */}
                <div className="mx-5 border-t border-hydra-border" />

                {/* ── Port ── */}
                <div className="px-5 pt-4 pb-4 flex flex-col gap-3">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Port</p>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-hydra-dark border border-hydra-border text-gray-600 text-sm font-mono select-none whitespace-nowrap">
                            {listenHost} :
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
                            Server is running — stop &amp; restart to apply the new port.
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
                                        ? "bg-hydra-accent/10 border-hydra-accent/30 shadow-[0_0_16px_rgba(59,130,246,0.12)]"
                                        : "bg-hydra-dark border-hydra-border hover:border-gray-600 hover:bg-hydra-card-hover"
                                    }
                                `}
                            >
                                {/* Icon */}
                                <div className={`
                                    mt-0.5 flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center
                                    transition-all duration-200
                                    ${isActive
                                        ? "bg-hydra-accent/20 text-hydra-accent"
                                        : "bg-hydra-card text-gray-600 group-hover:text-gray-400"
                                    }
                                `}>
                                    {m.icon}
                                </div>

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-sm font-semibold ${isActive ? "text-white" : "text-gray-300 group-hover:text-white"}`}>
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
                                    <p className={`text-xs mt-0.5 leading-relaxed ${isActive ? "text-gray-400" : "text-gray-600 group-hover:text-gray-500"}`}>
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
