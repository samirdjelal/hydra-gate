import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ProxyList } from "./components/ProxyList";
import { AddProxyModal } from "./components/AddProxyModal";
import { SettingsPage } from "./components/SettingsPage";
import { Proxy } from "./types";
import { Plus, Power, Layers, Settings, Network } from "lucide-react";

type Page = "proxies" | "settings";

function App() {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [isServerActive, setIsServerActive] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [page, setPage] = useState<Page>("proxies");
  const [listenPort, setListenPort] = useState<number>(10808);

  const fetchProxies = async () => {
    try {
      const result: Proxy[] = await invoke("get_proxy_list");
      setProxies(result);
    } catch (error) {
      console.error("Failed to fetch proxies:", error);
    }
  };

  const fetchPort = async () => {
    try {
      const port: number = await invoke("get_listen_port");
      setListenPort(port);
    } catch (e) {
      console.error("Failed to fetch port:", e);
    }
  };

  useEffect(() => {
    fetchProxies();
    fetchPort();
    const interval = setInterval(fetchProxies, 5000);
    return () => clearInterval(interval);
  }, []);

  // Re-sync port whenever the user navigates back from settings
  useEffect(() => {
    if (page === "proxies") fetchPort();
  }, [page]);

  const toggleServer = async () => {
    const newState = !isServerActive;
    try {
      await invoke("toggle_listener", { active: newState });
      setIsServerActive(newState);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddProxy = async (proxyString: string) => {
    const lines = proxyString.split('\n');
    for (const line of lines) {
      const parts = line.trim().split(':');
      if (parts.length >= 2) {
        const host = parts[0];
        const port = parseInt(parts[1], 10);
        const user = parts[2] || null;
        const pass = parts[3] || null;
        try {
          await invoke("add_proxy", { host, port, user, pass });
        } catch (e) {
          console.error("Failed to add proxy:", e);
        }
      }
    }
    await fetchProxies();
    setShowAddModal(false);
  };

  const aliveCount = proxies.filter(p => p.is_alive).length;

  const navItems: { id: Page; icon: React.ReactNode; label: string }[] = [
    { id: "proxies", icon: <Network className="w-4 h-4" />, label: "Proxies" },
    { id: "settings", icon: <Settings className="w-4 h-4" />, label: "Settings" },
  ];

  return (
    <div className="min-h-screen w-full">
      <main className="mx-auto px-4 py-6 max-w-3xl flex flex-col gap-6 animate-fade-up">

        {/* Header */}
        <header className="flex items-center justify-between py-2">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-hydra-accent/10 border border-hydra-accent/20 flex items-center justify-center">
                <Layers className="w-5 h-5 text-hydra-accent" />
              </div>
              {isServerActive && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-hydra-success rounded-full border-2 border-hydra-dark animate-glow" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-400">
                Hydra<span className="text-hydra-accent">Gate</span>
              </h1>
              <p className="text-xs text-gray-500 font-mono">
                127.0.0.1:<span className="text-hydra-accent/80">{listenPort}</span>
              </p>
            </div>
          </div>

          {/* Right: nav tabs + server button */}
          <div className="flex items-center gap-2">
            {/* Tab navigation */}
            <div className="flex items-center gap-1 p-1 bg-hydra-card border border-hydra-border rounded-xl">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  title={item.label}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                    transition-all duration-200
                    ${page === item.id
                      ? 'bg-hydra-accent/15 text-hydra-accent border border-hydra-accent/20'
                      : 'text-gray-500 hover:text-white hover:bg-hydra-border'
                    }
                  `}
                >
                  {item.icon}
                  <span className="hidden sm:block">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Server toggle */}
            <button
              onClick={toggleServer}
              className={`
                group relative flex items-center gap-2.5 px-4 py-2 rounded-xl font-semibold text-sm
                transition-all duration-300 outline-none
                ${isServerActive
                  ? 'bg-hydra-success/10 text-hydra-success border border-hydra-success/25 hover:bg-hydra-success/20 shadow-[0_0_20px_rgba(34,197,94,0.15)]'
                  : 'bg-hydra-card text-gray-400 border border-hydra-border hover:border-gray-600 hover:text-white hover:bg-hydra-card-hover'
                }
              `}
            >
              <Power className={`w-4 h-4 transition-all ${isServerActive ? 'text-hydra-success' : 'text-gray-500 group-hover:text-white'}`} />
              <span className="hidden sm:block">{isServerActive ? 'Running' : 'Start'}</span>
              {isServerActive && (
                <span className="w-1.5 h-1.5 bg-hydra-success rounded-full animate-pulse" />
              )}
            </button>
          </div>
        </header>

        {/* Stats bar — only on proxies page */}
        {page === "proxies" && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Proxies', value: proxies.length },
              { label: 'Online', value: aliveCount, accent: 'text-hydra-success' },
              { label: 'Offline', value: proxies.length - aliveCount, accent: 'text-hydra-danger' },
            ].map(stat => (
              <div
                key={stat.label}
                className="gradient-border bg-hydra-card rounded-xl p-4 flex flex-col gap-1"
              >
                <span className={`text-2xl font-bold ${stat.accent ?? 'text-white'}`}>
                  {stat.value}
                </span>
                <span className="text-xs text-gray-500 font-medium">{stat.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Page content */}
        {page === "proxies" ? (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Upstream Proxies</h2>
                {proxies.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-hydra-accent/10 text-hydra-accent border border-hydra-accent/20">
                    {proxies.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="
                  flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                  bg-hydra-accent hover:bg-blue-500 text-white
                  transition-all duration-200 shadow-[0_0_16px_rgba(59,130,246,0.3)]
                  hover:shadow-[0_0_24px_rgba(59,130,246,0.45)] active:scale-95
                "
              >
                <Plus className="w-4 h-4" />
                Add Proxy
              </button>
            </div>
            <ProxyList proxies={proxies} />
          </section>
        ) : (
          <SettingsPage isServerActive={isServerActive} />
        )}
      </main>

      {showAddModal && (
        <AddProxyModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddProxy}
        />
      )}
    </div>
  );
}

export default App;
