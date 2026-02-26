use serde::{Deserialize, Serialize};
use std::sync::Arc;
use dashmap::DashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Proxy {
    pub id: String,
    pub host: String,
    pub port: u16,
    pub user: Option<String>,
    pub pass: Option<String>,
    pub latency_ms: Option<u64>,
    pub is_alive: bool,
}

#[derive(Clone)]
pub struct ProxyPool {
    pub proxies: Arc<DashMap<String, Proxy>>,
}

impl ProxyPool {
    pub fn new() -> Self {
        Self {
            proxies: Arc::new(DashMap::new()),
        }
    }

    pub fn add(&self, proxy: Proxy) {
        self.proxies.insert(proxy.id.clone(), proxy);
    }
    
    pub fn get_all(&self) -> Vec<Proxy> {
        self.proxies.iter().map(|kv| kv.value().clone()).collect()
    }
}
