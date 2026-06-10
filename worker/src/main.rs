//! CodeHive worker — polls orchestrator for jobs, executes in sandbox, reports results.

mod runner;
mod sandbox;
mod types;

use crate::runner::Runner;
use crate::sandbox::Sandbox;
use crate::types::*;

use anyhow::Result;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio::time::interval;
use tracing::{info, warn};

/// Worker entry point: initialises config, heartbeat loop, job poll loop.
#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let config = load_config();
    let worker_id = config.worker_id.clone();
    info!(
        worker_id = %worker_id,
        orchestrator = %config.orchestrator_url,
        "codehive worker starting"
    );

    let docker_available = if config.use_docker {
        let avail = Runner::check_docker().await;
        if !avail {
            warn!("docker unavailable, falling back to direct exec");
        }
        avail
    } else {
        false
    };

    let http_client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()?;

    let sandbox = Arc::new(Sandbox::new(config.clone(), docker_available));

    let active_jobs: Arc<RwLock<u32>> = Arc::new(RwLock::new(0));
    let completed_jobs: Arc<RwLock<u64>> = Arc::new(RwLock::new(0));
    let failed_jobs: Arc<RwLock<u64>> = Arc::new(RwLock::new(0));
    let start_time = std::time::Instant::now();

    // heartbeat loop
    let hb_client = http_client.clone();
    let hb_active = active_jobs.clone();
    let hb_completed = completed_jobs.clone();
    let hb_failed = failed_jobs.clone();
    let hb_cfg = config.clone();
    let hb_id = worker_id.clone();

    tokio::spawn(async move {
        let mut ticker = interval(hb_cfg.heartbeat_interval);
        loop {
            ticker.tick().await;
            let status = WorkerStatus {
                worker_id: hb_id.clone(),
                hostname: hostname(),
                version: env!("CARGO_PKG_VERSION").to_string(),
                uptime_seconds: start_time.elapsed().as_secs(),
                active_jobs: *hb_active.read().await,
                completed_jobs: *hb_completed.read().await,
                failed_jobs: *hb_failed.read().await,
                avg_duration_ms: 0.0,
                docker_available,
                languages: vec![
                    "python".into(),
                    "node".into(),
                    "go".into(),
                    "rust".into(),
                    "cpp".into(),
                ],
            };

            let url = format!(
                "{}/api/workers/{}/heartbeat",
                hb_cfg.orchestrator_url, hb_id
            );
            match hb_client.post(&url).json(&status).send().await {
                Ok(_) => {}
                Err(e) => warn!("heartbeat failed: {e}"),
            }
        }
    });

    // job poll loop
    let poll_client = http_client.clone();
    let poll_cfg = config.clone();
    let poll_sandbox = sandbox.clone();
    let poll_active = active_jobs.clone();
    let poll_completed = completed_jobs.clone();
    let poll_failed = failed_jobs.clone();

    tokio::spawn(async move {
        let mut ticker = interval(poll_cfg.poll_interval);
        loop {
            ticker.tick().await;

            let active = *poll_active.read().await;
            if active >= poll_cfg.max_concurrent_jobs {
                continue;
            }

            let url = format!(
                "{}/api/workers/{}/jobs/next",
                poll_cfg.orchestrator_url, worker_id
            );

            match poll_client.get(&url).send().await {
                Ok(resp) => {
                    if resp.status() == reqwest::StatusCode::NO_CONTENT {
                        continue;
                    }
                    match resp.json::<ExecutionJob>().await {
                        Ok(job) => {
                            *poll_active.write().await += 1;
                            let sandbox = poll_sandbox.clone();
                            let active = poll_active.clone();
                            let completed = poll_completed.clone();
                            let failed = poll_failed.clone();
                            let http = poll_client.clone();
                            let orch_url = poll_cfg.orchestrator_url.clone();
                            let wid = worker_id.clone();

                            tokio::spawn(async move {
                                let result = sandbox.execute(&job).await;
                                match result {
                                    Ok(res) => {
                                        *completed.write().await += 1;
                                        let url = format!(
                                            "{orch_url}/api/workers/{wid}/jobs/{}/result",
                                            job.id
                                        );
                                        let _ = http.post(&url).json(&res).send().await;
                                    }
                                    Err(e) => {
                                        *failed.write().await += 1;
                                        let res = ExecutionResult {
                                            id: job.id.clone(),
                                            success: false,
                                            stdout: String::new(),
                                            stderr: String::new(),
                                            exit_code: None,
                                            duration_ms: 0,
                                            memory_used_mb: None,
                                            error: Some(format!("{e}")),
                                            timed_out: false,
                                        };
                                        let url = format!(
                                            "{orch_url}/api/workers/{wid}/jobs/{}/result",
                                            job.id
                                        );
                                        let _ = http.post(&url).json(&res).send().await;
                                    }
                                }
                                *active.write().await -= 1;
                            });
                        }
                        Err(e) => warn!("job deserialize failed: {e}"),
                    }
                }
                Err(e) => warn!("job poll failed: {e}"),
            }
        }
    });

    tokio::signal::ctrl_c().await?;
    info!("shutting down");
    Ok(())
}

/// Reads WorkerConfig from environment variables with defaults.
fn load_config() -> WorkerConfig {
    fn env(key: &str) -> Option<String> {
        std::env::var(key).ok()
    }

    WorkerConfig {
        worker_id: env("WORKER_ID")
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
        orchestrator_url: env("ORCHESTRATOR_URL")
            .unwrap_or_else(|| "http://localhost:8080".into()),
        heartbeat_interval: Duration::from_secs(
            env("HEARTBEAT_INTERVAL")
                .and_then(|s| s.parse().ok())
                .unwrap_or(5),
        ),
        poll_interval: Duration::from_millis(
            env("POLL_INTERVAL_MS")
                .and_then(|s| s.parse().ok())
                .unwrap_or(500),
        ),
        max_memory_mb: env("MAX_MEMORY_MB")
            .and_then(|s| s.parse().ok())
            .unwrap_or(512),
        max_concurrent_jobs: env("MAX_CONCURRENT_JOBS")
            .and_then(|s| s.parse().ok())
            .unwrap_or(4),
        use_docker: env("USE_DOCKER")
            .map(|s| s == "1" || s.eq_ignore_ascii_case("true"))
            .unwrap_or(false),
        temp_dir: env("TEMP_DIR").map(Into::into),
    }
}

/// Returns hostname from HOSTNAME or COMPUTERNAME env vars.
fn hostname() -> String {
    std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "unknown".into())
}
