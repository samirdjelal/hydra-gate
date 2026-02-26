import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Settings, X, AlertTriangle, CheckCircle2 } from "lucide-react";

interface SettingsPageProps {
    isServerActive: boolean;
}

export function SettingsPage({ isServerActive }: SettingsPageProps) {
    const [portInput, setPortInput] = useState("");
    const [savedPort, setSavedPort] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        invoke<number>("get_listen_port").then(p => {
            setSavedPort(p);
            setPortInput(String(p));
        });
    }, []);

    const handleSave = async () => {
        setError(null);
        setSuccess(false);
        const port = parseInt(portInput, 10);
        if (isNaN(port) || port < 1024 || port > 65535) {
            setError("Port must be between 1024 and 65535.");
            return;
        }
        try {
            await invoke("set_listen_port", { port });
            setSavedPort(port);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (e: unknown) {
            setError(typeof e === "string" ? e : "Failed to save port.");
        }
    };

    const isDirty = portInput !== String(savedPort);
    const portNum = parseInt(portInput, 10);
    const isValid = !isNaN(portNum) && portNum >= 1024 && portNum <= 65535;

    return (
        <div className="flex flex-col gap-6 animate-fade-up">
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-hydra-accent/10 border border-hydra-accent/20 flex items-center justify-center">
                    <Settings className="w-4 h-4 text-hydra-accent" />
                </div>
                <div>
                    <h2 className="text-sm font-semibold text-white">Settings</h2>
                    <p className="text-xs text-gray-600">Configuration options</p>
                </div>
            </div>

            {/* Listen Port Card */}
            <div className="gradient-border bg-hydra-card rounded-2xl overflow-hidden">
                {/* Card header */}
                <div className="px-5 py-4 border-b border-hydra-border">
                    <h3 className="text-sm font-semibold text-white">Local Listen Port</h3>
                    <p className="text-xs text-gray-600 mt-0.5">
                        The SOCKS5 port HydraGate listens on at <span className="font-mono text-gray-500">127.0.0.1</span>
                    </p>
                </div>

                {/* Card body */}
                <div className="px-5 py-5 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        {/* Prefix */}
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-hydra-dark border border-hydra-border text-gray-600 text-sm font-mono select-none whitespace-nowrap">
                            127.0.0.1 :
                        </div>

                        {/* Port input */}
                        <input
                            type="number"
                            min={1024}
                            max={65535}
                            value={portInput}
                            onChange={e => {
                                setPortInput(e.target.value);
                                setError(null);
                                setSuccess(false);
                            }}
                            onKeyDown={e => e.key === "Enter" && isValid && isDirty && handleSave()}
                            className="
                                w-32 bg-hydra-dark border border-hydra-border rounded-xl px-3 py-2.5
                                text-sm font-mono text-white
                                focus:outline-none focus:border-hydra-accent/50
                                focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]
                                transition-all duration-200
                                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                            "
                        />

                        {/* Save button */}
                        <button
                            onClick={handleSave}
                            disabled={!isDirty || !isValid}
                            className="
                                px-4 py-2.5 rounded-xl text-sm font-semibold
                                bg-hydra-accent hover:bg-blue-500 text-white
                                disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-hydra-accent
                                transition-all duration-200 shadow-[0_0_16px_rgba(59,130,246,0.25)]
                                hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] active:scale-95
                            "
                        >
                            Save
                        </button>

                        {/* Clear/reset */}
                        {isDirty && (
                            <button
                                onClick={() => { setPortInput(String(savedPort)); setError(null); }}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:text-white hover:bg-hydra-border transition-all"
                                title="Reset"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Inline feedback */}
                    {error && (
                        <div className="flex items-center gap-2 text-xs text-hydra-danger bg-hydra-danger/10 border border-hydra-danger/20 rounded-lg px-3 py-2">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="flex items-center gap-2 text-xs text-hydra-success bg-hydra-success/10 border border-hydra-success/20 rounded-lg px-3 py-2">
                            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                            Port saved. {isServerActive ? "Restart the server to apply." : "Start the server to apply."}
                        </div>
                    )}
                    {isServerActive && isDirty && !error && !success && (
                        <div className="flex items-center gap-2 text-xs text-hydra-warning bg-hydra-warning/10 border border-hydra-warning/20 rounded-lg px-3 py-2">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                            Server is running. Stop and restart it for the new port to take effect.
                        </div>
                    )}

                    <p className="text-xs text-gray-700">
                        Valid range: 1024 – 65535. Avoid well-known service ports.
                    </p>
                </div>
            </div>
        </div>
    );
}
