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

/// The proxy selection strategy applied to every new incoming connection.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "snake_case")]
pub enum RotationMode {
    /// Cycle through alive proxies in order (counter mod N).
    #[default]
    RoundRobin,
    /// Pick a uniformly-random alive proxy.
    Random,
    /// Always use the proxy with the lowest measured latency.
    LeastLatency,
    /// Weighted-random: probability inversely proportional to latency.
    Weighted,
    /// Hash the **target hostname** — same destination always uses same proxy.
    Sticky,
}

impl RotationMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            RotationMode::RoundRobin   => "round_robin",
            RotationMode::Random       => "random",
            RotationMode::LeastLatency => "least_latency",
            RotationMode::Weighted     => "weighted",
            RotationMode::Sticky       => "sticky",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "round_robin"   => Some(RotationMode::RoundRobin),
            "random"        => Some(RotationMode::Random),
            "least_latency" => Some(RotationMode::LeastLatency),
            "weighted"      => Some(RotationMode::Weighted),
            "sticky"        => Some(RotationMode::Sticky),
            _ => None,
        }
    }
}
