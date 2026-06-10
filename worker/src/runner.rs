use crate::types::*;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use thiserror::Error;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use std::process::Stdio;
use tokio::process::{Child, Command};

#[derive(Debug, Error)]
pub enum RunnerError {
    #[error("Failed to spawn process: {0}")]
    Spawn(String),
    #[error("Execution timed out after {0}ms")]
    Timeout(u64),
    #[error("Docker error: {0}")]
    Docker(String),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
}

pub struct Runner {
    config: WorkerConfig,
    docker_available: bool,
}

impl Runner {
    pub fn new(config: WorkerConfig, docker_available: bool) -> Self {
        Runner { config, docker_available }
    }

    pub fn docker_available(&self) -> bool {
        self.docker_available
    }

    pub async fn check_docker() -> bool {
        Command::new("docker")
            .arg("info")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await
            .map(|s| s.success())
            .unwrap_or(false)
    }

    pub async fn execute(
        &self,
        job: &ExecutionJob,
        code_path: &Path,
        binary_path: Option<&Path>,
        work_dir: &Path,
    ) -> Result<ExecutionResult, RunnerError> {
        if self.config.use_docker && self.docker_available {
            self.execute_docker(job, code_path, binary_path, work_dir).await
        } else {
            self.execute_direct(job, code_path, binary_path, work_dir).await
        }
    }

    async fn execute_direct(
        &self,
        job: &ExecutionJob,
        code_path: &Path,
        binary_path: Option<&Path>,
        work_dir: &Path,
    ) -> Result<ExecutionResult, RunnerError> {
        let mut cmd = Self::build_command(&job.language, code_path, binary_path);
        cmd.current_dir(work_dir);
        if let Some(ref env_vars) = job.env_vars {
            cmd.envs(env_vars);
        }
        let child = cmd
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::piped())
            .spawn()
            .map_err(|e| RunnerError::Spawn(e.to_string()))?;

        let start = tokio::time::Instant::now();
        let (stdout, stderr, is_timed_out, exit_code, error) =
            Self::capture_output(child, job.stdin.as_deref(), job.timeout_ms).await?;
        let duration_ms = start.elapsed().as_millis() as u64;

        let success = error.is_none() && exit_code.is_none_or(|c| c == 0);

        Ok(ExecutionResult {
            id: job.id.clone(),
            success,
            stdout,
            stderr,
            exit_code,
            duration_ms,
            memory_used_mb: None,
            error: error.clone(),
            timed_out: is_timed_out,
        })
    }

    async fn execute_docker(
        &self,
        job: &ExecutionJob,
        code_path: &Path,
        _binary_path: Option<&Path>,
        work_dir: &Path,
    ) -> Result<ExecutionResult, RunnerError> {
        let image = match job.language {
            Language::Python => "python:3.12-slim",
            Language::Node => "node:22-alpine",
            Language::Go => "golang:1.22-alpine",
            Language::Rust => "rust:1.77-slim",
            Language::Cpp => "gcc:13-bookworm",
        };

        let container_dir = "/code";
        let file_name = code_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("main");

        let mut cmd = Command::new("docker");
        cmd.arg("run").arg("--rm").arg("--network").arg("none")
            .arg("--read-only")
            .arg("--memory").arg(format!("{}m", job.memory_limit_mb.unwrap_or(self.config.max_memory_mb)))
            .arg("--cpus").arg("1").arg("--init")
            .arg("-v").arg(format!("{}:{}", work_dir.display(), container_dir))
            .arg("-w").arg(container_dir)
            .arg("-e").arg("GO111MODULE=off");

        if let Some(ref env_vars) = job.env_vars {
            for (k, v) in env_vars {
                cmd.arg("-e").arg(format!("{k}={v}"));
            }
        }

        cmd.arg(image);

        match job.language {
            Language::Python => { cmd.arg("python3").arg("-u").arg(file_name); }
            Language::Node => { cmd.arg("node").arg(file_name); }
            Language::Go => { cmd.arg("sh").arg("-c").arg(format!("go build -o main {file_name} && ./main")); }
            Language::Rust => { cmd.arg("sh").arg("-c").arg(format!("rustc --edition 2021 {file_name} -o main && ./main")); }
            Language::Cpp => { cmd.arg("sh").arg("-c").arg(format!("g++ -std=c++20 -O2 -o main {file_name} && ./main")); }
        }

        let child = cmd
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::piped())
            .spawn()
            .map_err(|e| RunnerError::Docker(format!("Failed to spawn docker: {e}")))?;

        let start = tokio::time::Instant::now();
        let (stdout, stderr, is_timed_out, exit_code, error) =
            Self::capture_output(child, job.stdin.as_deref(), job.timeout_ms).await?;
        let duration_ms = start.elapsed().as_millis() as u64;

        let success = error.is_none() && exit_code.is_none_or(|c| c == 0);

        Ok(ExecutionResult {
            id: job.id.clone(),
            success,
            stdout,
            stderr,
            exit_code,
            duration_ms,
            memory_used_mb: None,
            error: error.clone(),
            timed_out: is_timed_out,
        })
    }

    async fn capture_output(
        mut child: Child,
        stdin_data: Option<&str>,
        timeout_ms: u64,
    ) -> Result<(String, String, bool, Option<i32>, Option<String>), RunnerError> {
        let mut stdin_writer = child.stdin.take().unwrap();
        let mut stdout_reader = child.stdout.take().unwrap();
        let mut stderr_reader = child.stderr.take().unwrap();

        let stdout_buf = Arc::new(tokio::sync::Mutex::new(Vec::new()));
        let stderr_buf = Arc::new(tokio::sync::Mutex::new(Vec::new()));

        let sb1 = stdout_buf.clone();
        let stdout_task = tokio::spawn(async move {
            let mut buf = Vec::new();
            stdout_reader.read_to_end(&mut buf).await.ok();
            *sb1.lock().await = buf;
        });

        let sb2 = stderr_buf.clone();
        let stderr_task = tokio::spawn(async move {
            let mut buf = Vec::new();
            stderr_reader.read_to_end(&mut buf).await.ok();
            *sb2.lock().await = buf;
        });

        if let Some(data) = stdin_data {
            stdin_writer.write_all(data.as_bytes()).await?;
            stdin_writer.shutdown().await?;
        } else {
            drop(stdin_writer);
        }

        let timeout_duration = Duration::from_millis(timeout_ms);
        let timed_out = Arc::new(AtomicBool::new(false));
        let to = timed_out.clone();

        let result = tokio::select! {
            status = child.wait() => {
                let status = status.map_err(|e| RunnerError::Spawn(e.to_string()))?;
                Ok(status)
            }
            _ = tokio::time::sleep(timeout_duration) => {
                to.store(true, Ordering::SeqCst);
                let _ = child.kill().await;
                let _ = child.wait().await;
                Err(RunnerError::Timeout(timeout_ms))
            }
        };

        stdout_task.await.ok();
        stderr_task.await.ok();

        let is_timed_out = timed_out.load(Ordering::SeqCst);
        let stdout = String::from_utf8_lossy(&stdout_buf.lock().await).to_string();
        let stderr = String::from_utf8_lossy(&stderr_buf.lock().await).to_string();

        match result {
            Ok(status) => Ok((stdout, stderr, is_timed_out, status.code(), None)),
            Err(e) => Ok((stdout, stderr, is_timed_out, None, Some(e.to_string()))),
        }
    }

    fn build_command(language: &Language, code_path: &Path, binary_path: Option<&Path>) -> Command {
        match language {
            Language::Python => { let mut c = Command::new("python3"); c.arg(code_path); c }
            Language::Node => { let mut c = Command::new("node"); c.arg(code_path); c }
            Language::Go => {
                if let Some(bin) = binary_path {
                    Command::new(bin)
                } else {
                    let mut c = Command::new("go"); c.arg("run").arg(code_path); c
                }
            }
            Language::Rust | Language::Cpp => {
                let bin = binary_path.expect("compiled binary required for rust/cpp");
                Command::new(bin)
            }
        }
    }
}
