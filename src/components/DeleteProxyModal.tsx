import { Trash2 } from "lucide-react";
import { Proxy } from "../types";

interface DeleteProxyModalProps {
    proxy: Proxy;
    onClose: () => void;
    onConfirm: (id: string) => void;
}

export function DeleteProxyModal({ proxy, onClose, onConfirm }: DeleteProxyModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-hydra-dark/80 backdrop-blur-sm animate-fade-up"
                onClick={onClose}
            />

            <div className="relative w-full max-w-sm bg-hydra-card border border-hydra-border rounded-2xl shadow-2xl p-6 animate-scale-in">
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-hydra-danger/10 border border-hydra-danger/20 flex items-center justify-center">
                        <Trash2 className="w-6 h-6 text-hydra-danger" />
                    </div>

                    <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-bold text-white">Delete Proxy?</h3>
                        <p className="text-sm text-gray-400">
                            Are you sure you want to remove <span className="text-white font-mono">{proxy.host}:{proxy.port}</span>?
                            This action cannot be undone.
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-hydra-surface hover:bg-gray-800 text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(proxy.id)}
                        className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-hydra-danger hover:bg-red-500 text-white transition-colors shadow-[0_0_16px_rgba(239,68,68,0.25)] hover:shadow-[0_0_24px_rgba(239,68,68,0.4)]"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}
