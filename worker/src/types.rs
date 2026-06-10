use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;
use std::path::PathBuf;
use std::str::FromStr;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Language {
    Python,
    Node,
    Go,
    Rust,
    Cpp,
}

impl Language {
    /// Returns file extension for language.
    pub fn extension(&self) -> &'static str {
        match self {
            Language::Python => "py",
            Language::Node => "js",
            Language::Go => "go",
            Language::Rust => "rs",
            Language::Cpp => "cpp",
        }
    }

    /// Returns true if language requires compilation step.
    pub fn needs_compilation(&self) -> bool {
        matches!(self, Language::Go | Language::Rust | Language::Cpp)
    }
}

impl fmt::Display for Language {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Language::Python => write!(f, "python"),
            Language::Node => write!(f, "node"),
            Language::Go => write!(f, "go"),
            Language::Rust => write!(f, "rust"),
            Language::Cpp => write!(f, "cpp"),
        }
    }
}

impl FromStr for Language {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "python" => Ok(Language::Python),
            "node" => Ok(Language::Node),
            "go" => Ok(Language::Go),
            "rust" => Ok(Language::Rust),
            "cpp" => Ok(Language::Cpp),
            _ => Err(format!("unsupported language: {s}")),
        }
    }
}

/// Job pulled from orchestrator queue.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionJob {
    pub id: String,
    pub code: String,
    pub language: Language,
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    pub memory_limit_mb: Option<u64>,
    pub stdin: Option<String>,
    pub env_vars: Option<HashMap<String, String>>,
}

fn default_timeout() -> u64 {
    30_000
}

/// Result from executing a job.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub id: String,
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub duration_ms: u64,
    pub memory_used_mb: Option<f64>,
    pub error: Option<String>,
    pub timed_out: bool,
}

/// Status reported by worker to orchestrator via heartbeat.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerStatus {
    pub worker_id: String,
    pub hostname: String,
    pub version: String,
    pub uptime_seconds: u64,
    pub active_jobs: u32,
    pub completed_jobs: u64,
    pub failed_jobs: u64,
    pub avg_duration_ms: f64,
    pub docker_available: bool,
    pub languages: Vec<String>,
}

/// Configuration for worker process.
#[derive(Debug, Clone)]
pub struct WorkerConfig {
    pub worker_id: String,
    pub orchestrator_url: String,
    pub heartbeat_interval: Duration,
    pub poll_interval: Duration,
    pub max_memory_mb: u64,
    pub max_concurrent_jobs: u32,
    pub use_docker: bool,
    pub temp_dir: Option<PathBuf>,
}

impl Default for WorkerConfig {
    fn default() -> Self {
        WorkerConfig {
            worker_id: uuid::Uuid::new_v4().to_string(),
            orchestrator_url: "http://localhost:8080".to_string(),
            heartbeat_interval: Duration::from_secs(5),
            poll_interval: Duration::from_millis(500),
            max_memory_mb: 512,
            max_concurrent_jobs: 4,
            use_docker: false,
            temp_dir: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_language_extension() {
        assert_eq!(Language::Python.extension(), "py");
        assert_eq!(Language::Node.extension(), "js");
        assert_eq!(Language::Go.extension(), "go");
        assert_eq!(Language::Rust.extension(), "rs");
        assert_eq!(Language::Cpp.extension(), "cpp");
    }

    #[test]
    fn test_language_needs_compilation() {
        assert!(!Language::Python.needs_compilation());
        assert!(!Language::Node.needs_compilation());
        assert!(Language::Go.needs_compilation());
        assert!(Language::Rust.needs_compilation());
        assert!(Language::Cpp.needs_compilation());
    }

    #[test]
    fn test_language_display() {
        assert_eq!(Language::Python.to_string(), "python");
        assert_eq!(Language::Node.to_string(), "node");
        assert_eq!(Language::Go.to_string(), "go");
        assert_eq!(Language::Rust.to_string(), "rust");
        assert_eq!(Language::Cpp.to_string(), "cpp");
    }

    #[test]
    fn test_language_from_str() {
        assert_eq!("python".parse::<Language>().unwrap(), Language::Python);
        assert_eq!("node".parse::<Language>().unwrap(), Language::Node);
        assert_eq!("go".parse::<Language>().unwrap(), Language::Go);
        assert_eq!("rust".parse::<Language>().unwrap(), Language::Rust);
        assert_eq!("cpp".parse::<Language>().unwrap(), Language::Cpp);
        assert!("brainfuck".parse::<Language>().is_err());
    }

    #[test]
    fn test_language_partial_eq() {
        assert_eq!(Language::Python, Language::Python);
        assert_ne!(Language::Python, Language::Rust);
    }

    #[test]
    fn test_execution_job_default_timeout() {
        let job = ExecutionJob {
            id: "test".into(),
            code: "print(1)".into(),
            language: Language::Python,
            timeout_ms: 0,
            memory_limit_mb: None,
            stdin: None,
            env_vars: None,
        };
        assert_eq!(default_timeout(), 30_000);
        assert_ne!(job.timeout_ms, 30_000);
    }

    #[test]
    fn test_execution_job_serde() {
        let json = r#"{
            "id": "j1",
            "code": "print(1)",
            "language": "python"
        }"#;
        let job: ExecutionJob = serde_json::from_str(json).unwrap();
        assert_eq!(job.id, "j1");
        assert_eq!(job.language, Language::Python);
        assert_eq!(job.timeout_ms, 30_000);
        assert!(job.stdin.is_none());
    }

    #[test]
    fn test_execution_result() {
        let r = ExecutionResult {
            id: "r1".into(),
            success: true,
            stdout: "hello".into(),
            stderr: String::new(),
            exit_code: Some(0),
            duration_ms: 100,
            memory_used_mb: None,
            error: None,
            timed_out: false,
        };
        assert!(r.success);
        assert_eq!(r.stdout, "hello");
        assert_eq!(r.exit_code, Some(0));
    }

    #[test]
    fn test_worker_status() {
        let ws = WorkerStatus {
            worker_id: "w1".into(),
            hostname: "host1".into(),
            version: "1.0".into(),
            uptime_seconds: 3600,
            active_jobs: 2,
            completed_jobs: 100,
            failed_jobs: 5,
            avg_duration_ms: 150.0,
            docker_available: false,
            languages: vec!["python".into(), "go".into()],
        };
        assert_eq!(ws.worker_id, "w1");
        assert_eq!(ws.active_jobs, 2);
        assert_eq!(ws.languages.len(), 2);
    }

    #[test]
    fn test_worker_config_default() {
        let cfg = WorkerConfig::default();
        assert_eq!(cfg.orchestrator_url, "http://localhost:8080");
        assert_eq!(cfg.heartbeat_interval, Duration::from_secs(5));
        assert_eq!(cfg.max_memory_mb, 512);
        assert_eq!(cfg.max_concurrent_jobs, 4);
        assert!(!cfg.use_docker);
        assert!(cfg.temp_dir.is_none());
    }
}
