import { useRef, useState, useEffect } from "react";
import { Proxy } from "../types";
import { Activity, ServerOff, Shield, ShieldOff, Edit } from "lucide-react";

interface ProxyListProps {
    proxies: Proxy[];
    onLongPress: (proxy: Proxy) => void;
    onEdit: (proxy: Proxy) => void;
    onCheckHealth: (proxy: Proxy) => void;
    onDelete: (proxy: Proxy) => void;
}

function LatencyBadge({ ms }: { ms?: number | null }) {
    if (ms === null || ms === undefined) {
        return <span className="font-mono text-xs text-gray-600">—</span>;
    }
    const color = ms < 100
        ? 'text-hydra-success'
        : ms < 250
            ? 'text-hydra-warning'
            : 'text-hydra-danger';
    return (
        <span className={`font-mono text-xs font-medium ${color}`}>
            {ms}<span className="text-gray-600 font-normal">ms</span>
        </span>
    );
}

import { createPortal } from "react-dom";

export function ProxyList({ proxies, onLongPress, onEdit, onCheckHealth, onDelete }: ProxyListProps) {
    const timerRef = useRef<number | null>(null);
    const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; proxy: Proxy } | null>(null);

    // Close right click menu on outside click
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener("click", handleClick);
        return () => window.removeEventListener("click", handleClick);
    }, []);

    const startPress = (p: Proxy) => {
        if (timerRef.current) return;
        timerRef.current = window.setTimeout(() => {
            onLongPress(p);
            timerRef.current = null;
        }, 600); // 600ms long press threshold
    };

    const cancelPress = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    if (proxies.length === 0) {
        return (
            <div className="gradient-border flex flex-col items-center justify-center p-12 bg-hydra-card rounded-2xl text-gray-600">
                <div className="w-14 h-14 rounded-2xl bg-hydra-surface border border-hydra-border flex items-center justify-center mb-4">
                    <ServerOff className="w-7 h-7 text-gray-700" />
                </div>
                <p className="font-medium text-gray-400">No upstream proxies yet</p>
                <p className="text-sm text-gray-500 mt-1">Click <span className="text-hydra-accent">Add Proxy</span> to get started.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {proxies.map((p, i) => (
                <div
                    key={p.id}
                    className="
                        gradient-border group relative flex items-center justify-between
                        px-4 py-3.5 bg-hydra-card rounded-xl
                        border border-transparent
                        hover:bg-hydra-card-hover
                        transition-all duration-200
                        animate-fade-up select-none
                    "
                    style={{ animationDelay: `${i * 40}ms` }}
                    onMouseDown={() => startPress(p)}
                    onMouseUp={cancelPress}
                    onMouseLeave={cancelPress}
                    onTouchStart={() => startPress(p)}
                    onTouchEnd={cancelPress}
                    onTouchMove={cancelPress}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ mouseX: e.clientX, mouseY: e.clientY, proxy: p });
                    }}
                >
                    {/* Status indicator */}
                    <div className="flex items-center gap-4">
                        <div className="relative flex-shrink-0">
                            <div
                                className={`w-2.5 h-2.5 rounded-full ${p.is_alive ? 'bg-hydra-success' : 'bg-hydra-danger'}`}
                            />
                            {p.is_alive && (
                                <div className="absolute inset-0 bg-hydra-success rounded-full animate-status-ping" />
                            )}
                        </div>

                        {/* Host info */}
                        <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-sm font-medium text-white flex items-center gap-2">
                                <span>
                                    {p.host}
                                    <span className="text-gray-500">:</span>
                                    <span className="text-hydra-accent">{p.port}</span>
                                </span>
                                <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-hydra-surface border border-hydra-border text-gray-400">
                                    {p.protocol}
                                </span>
                            </span>
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                {p.user ? (
                                    <span className="flex items-center gap-1 text-hydra-accent/60">
                                        <Shield className="w-3 h-3" /> Auth
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-gray-700">
                                        <ShieldOff className="w-3 h-3" /> No auth
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: latency */}
                    <div className="flex items-center gap-2 text-gray-600">
                        <Activity className="w-3.5 h-3.5" />
                        <LatencyBadge ms={p.latency_ms} />
                    </div>
                </div>
            ))}

            {contextMenu && createPortal(
                <div
                    className="fixed z-50 min-w-[160px] bg-hydra-card border border-hydra-border rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden animate-scale-in"
                    style={{ top: contextMenu.mouseY, left: contextMenu.mouseX }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex flex-col py-1">
                        <button
                            className="flex items-center px-4 py-2.5 text-sm text-gray-300 hover:bg-hydra-card-hover hover:text-white transition-colors text-left"
                            onClick={() => { onCheckHealth(contextMenu.proxy); setContextMenu(null); }}
                        >
                            <Activity className="w-4 h-4 mr-2.5 text-hydra-accent" />
                            Check Health
                        </button>
                        <button
                            className="flex items-center px-4 py-2.5 text-sm text-gray-300 hover:bg-hydra-card-hover hover:text-white transition-colors text-left"
                            onClick={() => { onEdit(contextMenu.proxy); setContextMenu(null); }}
                        >
                            <Edit className="w-4 h-4 mr-2.5 text-gray-400" />
                            Edit Proxy
                        </button>
                        <div className="h-px bg-hydra-border my-1 mx-2" />
                        <button
                            className="flex items-center px-4 py-2.5 text-sm text-hydra-danger hover:bg-red-500/10 transition-colors text-left"
                            onClick={() => { onDelete(contextMenu.proxy); setContextMenu(null); }}
                        >
                            <ServerOff className="w-4 h-4 mr-2.5" />
                            Delete
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
