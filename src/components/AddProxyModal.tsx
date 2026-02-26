import { useState } from "react";
import { X, Terminal } from "lucide-react";

interface AddProxyModalProps {
    onClose: () => void;
    onAdd: (proxyString: string) => void;
}

export function AddProxyModal({ onClose, onAdd }: AddProxyModalProps) {
    const [proxyString, setProxyString] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (proxyString.trim()) {
            onAdd(proxyString.trim());
        }
    };

    const lineCount = proxyString.trim() ? proxyString.trim().split('\n').filter(l => l.trim()).length : 0;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="gradient-border animate-scale-in bg-hydra-card w-full max-w-md rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.6)] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-hydra-border">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-hydra-accent/10 border border-hydra-accent/20 flex items-center justify-center">
                            <Terminal className="w-4 h-4 text-hydra-accent" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-white">Add Proxies</h2>
                            <p className="text-xs text-gray-600">One proxy per line</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-white hover:bg-hydra-border transition-all"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Proxy List
                            </label>
                            <span className="text-xs font-mono text-hydra-accent/70">
                                host:port:user:pass
                            </span>
                        </div>
                        <div className="relative">
                            <textarea
                                autoFocus
                                value={proxyString}
                                onChange={(e) => setProxyString(e.target.value)}
                                className="
                                    w-full bg-hydra-dark border border-hydra-border rounded-xl p-3.5
                                    text-sm font-mono text-white placeholder-gray-700
                                    focus:outline-none focus:border-hydra-accent/50
                                    focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]
                                    transition-all duration-200 resize-none
                                "
                                placeholder={"127.0.0.1:8080:user:pass\n192.168.1.1:3128"}
                                rows={5}
                            />
                            {lineCount > 0 && (
                                <div className="absolute bottom-3 right-3">
                                    <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-hydra-accent/10 text-hydra-accent border border-hydra-accent/20">
                                        {lineCount} {lineCount === 1 ? 'proxy' : 'proxies'}
                                    </span>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-gray-700 mt-2">
                            Credentials are optional. Paste multiple lines to bulk-import.
                        </p>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 hover:text-white hover:bg-hydra-border transition-all duration-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!proxyString.trim()}
                            className="
                                px-5 py-2 rounded-xl text-sm font-semibold
                                bg-hydra-accent hover:bg-blue-500 text-white
                                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-hydra-accent
                                transition-all duration-200 shadow-[0_0_16px_rgba(59,130,246,0.25)]
                                hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] active:scale-95
                            "
                        >
                            Import {lineCount > 1 ? `${lineCount} Proxies` : 'Proxy'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
