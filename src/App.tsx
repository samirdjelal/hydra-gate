import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ProxyList } from "./components/ProxyList";
import { AddProxyModal } from "./components/AddProxyModal";
import { DeleteProxyModal } from "./components/DeleteProxyModal";
import { EditProxyModal } from "./components/EditProxyModal";
import { SettingsPage } from "./components/SettingsPage";
import { Proxy } from "./types";
import { Plus, Power, Layers, Settings, Activity, Trash2, Sparkles } from "lucide-react";

type Page = "proxies" | "settings";

function App() {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [isServerActive, setIsServerActive] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [proxyToDelete, setProxyToDelete] = useState<Proxy | null>(null);
  const [proxyToEdit, setProxyToEdit] = useState<Proxy | null>(null);
  const [page, setPage] = useState<Page>("proxies");
  const [listenPort, setListenPort] = useState<number>(10808);
  const [listenHost, setListenHost] = useState<string>("127.0.0.1");

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

  const fetchHost = async () => {
    try {
      const host: string = await invoke("get_listen_host");
      setListenHost(host);
    } catch (e) {
      console.error("Failed to fetch host:", e);
    }
  };

  useEffect(() => {
    fetchProxies();
    fetchPort();
    fetchHost();
    const interval = setInterval(fetchProxies, 5000);
    return () => clearInterval(interval);
  }, []);

  // Re-sync port + host whenever the user navigates back from settings
  useEffect(() => {
    if (page === "proxies") {
      fetchPort();
      fetchHost();
    }
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

  const handleRefreshHealth = async () => {
    try {
      await invoke("refresh_health");
      await fetchProxies();
    } catch (e) {
      console.error("Failed to refresh health:", e);
    }
  };

  const handleCheckSingleHealth = async (proxy: Proxy) => {
    try {
      await invoke("refresh_proxy_health", { id: proxy.id });
      await fetchProxies();
    } catch (e) {
      console.error("Failed to check single proxy health:", e);
    }
  };

  const handleEditProxy = async (id: string, proxyString: string) => {
    let currentLine = proxyString.trim();
    if (!currentLine) return;

    let protocol: string | null = null;
    if (currentLine.includes('://')) {
      const parts = currentLine.split('://');
      protocol = parts[0];
      currentLine = parts[1];
    }

    const parts = currentLine.split(':');
    if (parts.length >= 2) {
      const host = parts[0];
      const port = parseInt(parts[1], 10);
      const user = parts[2] || null;
      const pass = parts[3] || null;
      try {
        await invoke("update_proxy", { id, protocol, host, port, user, pass });
        await fetchProxies();
      } catch (e) {
        console.error("Failed to update proxy:", e);
      }
    }
    setProxyToEdit(null);
  };

  const handleAddProxy = async (proxyString: string, defaultProtocol: string) => {
    const lines = proxyString.split('\n');
    const newProxyIds: string[] = [];

    for (const line of lines) {
      let currentLine = line.trim();
      if (!currentLine) continue;

      let protocol: string | null = null;
      if (currentLine.includes('://')) {
        const parts = currentLine.split('://');
        protocol = parts[0];
        currentLine = parts[1];
      } else {
        protocol = defaultProtocol;
      }

      const parts = currentLine.split(':');
      if (parts.length >= 2) {
        const host = parts[0];
        const port = parseInt(parts[1], 10);
        const user = parts[2] || null;
        const pass = parts[3] || null;
        try {
          const id = await invoke<string>("add_proxy", { protocol, host, port, user, pass });
          newProxyIds.push(id);
        } catch (e) {
          console.error("Failed to add proxy:", e);
        }
      }
    }
    setShowAddModal(false);

    // Check health only for newly added proxies
    await Promise.all(
      newProxyIds.map(id => invoke("refresh_proxy_health", { id }).catch(console.error))
    );
    await fetchProxies();
  };

  const handleDeleteProxy = async (id: string) => {
    try {
      await invoke("remove_proxy", { id });
      await fetchProxies();
    } catch (e) {
      console.error("Failed to remove proxy:", e);
    }
    setProxyToDelete(null);
  };

  const handleClearProxies = async () => {
    if (proxies.length === 0) return;
    if (window.confirm("Are you sure you want to delete all proxies?")) {
      try {
        await invoke("clear_proxies");
        await fetchProxies();
      } catch (e) {
        console.error("Failed to clear proxies:", e);
      }
    }
  };

  const handleClearDeadProxies = async () => {
    const deadCount = proxies.filter(p => !p.is_alive).length;
    if (deadCount === 0) return;
    if (window.confirm(`Are you sure you want to delete ${deadCount} offline proxies?`)) {
      try {
        await invoke("clear_dead_proxies");
        await fetchProxies();
      } catch (e) {
        console.error("Failed to clear dead proxies:", e);
      }
    }
  };

  const aliveCount = proxies.filter(p => p.is_alive).length;

  const navItems: { id: Page; icon: React.ReactNode; label: string }[] = [
    { id: "proxies", icon: <Layers className="w-4 h-4" />, label: "Proxies" },
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
                {listenHost}:<span className="text-hydra-accent/80">{listenPort}</span>
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
              <div className="flex items-center gap-2">
                {proxies.length > 0 && (
                  <>
                    <button
                      onClick={handleClearDeadProxies}
                      title="Clear Offline Proxies"
                      className="
                        p-2.5 rounded-xl text-gray-400 bg-hydra-card border border-hydra-border
                        hover:text-hydra-accent hover:border-hydra-accent/50 hover:bg-hydra-accent/10
                        transition-all duration-200 active:scale-95
                      "
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleClearProxies}
                      title="Clear All Proxies"
                      className="
                        p-2.5 rounded-xl text-gray-400 bg-hydra-card border border-hydra-border
                        hover:text-hydra-danger hover:border-red-500/50 hover:bg-red-500/10
                        transition-all duration-200 active:scale-95
                      "
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  onClick={handleRefreshHealth}
                  title="Refresh Proxies Health"
                  className="
                    p-2.5 rounded-xl text-gray-400 bg-hydra-card border border-hydra-border
                    hover:text-white hover:border-gray-600 hover:bg-hydra-card-hover
                    transition-all duration-200 active:scale-95
                  "
                >
                  <Activity className="w-4 h-4" />
                </button>
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
            </div>
            <ProxyList
              proxies={proxies}
              onLongPress={(proxy) => setProxyToDelete(proxy)}
              onEdit={(proxy) => setProxyToEdit(proxy)}
              onCheckHealth={handleCheckSingleHealth}
              onDelete={(proxy) => setProxyToDelete(proxy)}
            />
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

      {proxyToDelete && (
        <DeleteProxyModal
          proxy={proxyToDelete}
          onClose={() => setProxyToDelete(null)}
          onConfirm={handleDeleteProxy}
        />
      )}

      {proxyToEdit && (
        <EditProxyModal
          proxy={proxyToEdit}
          onClose={() => setProxyToEdit(null)}
          onEdit={(str: string) => handleEditProxy(proxyToEdit.id, str)}
        />
      )}
    </div>
  );
}

export default App;
