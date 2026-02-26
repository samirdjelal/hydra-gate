use serde::{Deserialize, Serialize};
use std::sync::Arc;
use dashmap::DashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Proxy {
    pub id: String,
    pub protocol: String,
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
    /// Time-Based Sticky: all connections within the same 10-minute window
    /// go through the same proxy. Rotates when the window expires.
    TimeSticky,
    /// IP-Based Sticky: hash the target hostname so the same destination
    /// always goes through the same proxy, regardless of time.
    IpSticky,
}

impl RotationMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            RotationMode::RoundRobin   => "round_robin",
            RotationMode::Random       => "random",
            RotationMode::LeastLatency => "least_latency",
            RotationMode::Weighted     => "weighted",
            RotationMode::TimeSticky   => "time_sticky",
            RotationMode::IpSticky     => "ip_sticky",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "round_robin"   => Some(RotationMode::RoundRobin),
            "random"        => Some(RotationMode::Random),
            "least_latency" => Some(RotationMode::LeastLatency),
            "weighted"      => Some(RotationMode::Weighted),
            "time_sticky"   => Some(RotationMode::TimeSticky),
            "ip_sticky"     => Some(RotationMode::IpSticky),
            // legacy alias kept for backward-compat
            "sticky"        => Some(RotationMode::TimeSticky),
            _ => None,
        }
    }
}
