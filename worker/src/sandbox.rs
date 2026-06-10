use crate::runner::Runner;
use crate::types::*;
use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use std::time::Instant;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tracing::info;

/// Manages temp files, compilation, and delegates execution to Runner.
pub struct Sandbox {
    runner: Runner,
    config: WorkerConfig,
}

impl Sandbox {
    /// Creates new Sandbox with given config and docker flag.
    pub fn new(config: WorkerConfig, docker_available: bool) -> Self {
        Sandbox {
            runner: Runner::new(config.clone(), docker_available),
            config,
        }
    }

    /// Executes job: creates temp dir, writes source, compiles if needed, runs, cleans up.
    pub async fn execute(&self, job: &ExecutionJob) -> Result<ExecutionResult> {
        let start = Instant::now();

        let temp_dir = if let Some(ref base) = self.config.temp_dir {
            tempfile::TempDir::new_in(base)
                .context("failed to create temp dir")?
        } else {
            tempfile::TempDir::new().context("failed to create temp dir")?
        };
        let work_dir = temp_dir.path().to_path_buf();
        info!("job {} temp dir: {:?}", job.id, work_dir);

        let code_path = work_dir.join(format!("main.{}", job.language.extension()));
        {
            let mut file = fs::File::create(&code_path)
                .await
                .context("failed to create source file")?;
            file.write_all(job.code.as_bytes())
                .await
                .context("failed to write source code")?;
            file.flush().await?;
        }

        let should_compile = job.language.needs_compilation()
            && !(self.config.use_docker && self.runner.docker_available());

        let binary_path = if should_compile {
            match self.compile(&job.language, &code_path, &work_dir).await {
                Ok(bin) => Some(bin),
                Err(e) => {
                    let elapsed = start.elapsed().as_millis() as u64;
                    let result = ExecutionResult {
                        id: job.id.clone(),
                        success: false,
                        stdout: String::new(),
                        stderr: format!("Compilation failed: {e}"),
                        exit_code: None,
                        duration_ms: elapsed,
                        memory_used_mb: None,
                        error: Some(format!("compilation error: {e}")),
                        timed_out: false,
                    };
                    fs::remove_dir_all(&work_dir).await.ok();
                    return Ok(result);
                }
            }
        } else {
            None
        };

        let result = match self
            .runner
            .execute(job, &code_path, binary_path.as_deref(), &work_dir)
            .await
        {
            Ok(mut res) => {
                res.duration_ms = start.elapsed().as_millis() as u64;
                res
            }
            Err(e) => ExecutionResult {
                id: job.id.clone(),
                success: false,
                stdout: String::new(),
                stderr: String::new(),
                exit_code: None,
                duration_ms: start.elapsed().as_millis() as u64,
                memory_used_mb: None,
                error: Some(format!("execution error: {e}")),
                timed_out: false,
            },
        };

        fs::remove_dir_all(&work_dir)
            .await
            .unwrap_or_else(|e| tracing::warn!("cleanup failed: {e}"));

        Ok(result)
    }

    /// Compiles Rust, C++, or Go source to binary.
    async fn compile(
        &self,
        language: &Language,
        source_path: &Path,
        work_dir: &Path,
    ) -> Result<PathBuf> {
        let binary_path = work_dir.join("main");
        let (cmd, args) = match language {
            Language::Rust => ("rustc", vec![
                source_path.to_str().unwrap(), "-o", binary_path.to_str().unwrap(), "--edition", "2021",
            ]),
            Language::Cpp => ("g++", vec![
                "-std=c++20", "-O2", "-o", binary_path.to_str().unwrap(), source_path.to_str().unwrap(),
            ]),
            Language::Go => ("go", vec![
                "build", "-o", binary_path.to_str().unwrap(), source_path.to_str().unwrap(),
            ]),
            _ => unreachable!(),
        };
        let name = cmd;
        let output = Command::new(cmd).args(&args).output().await
            .with_context(|| format!("failed to run {name}"))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("{name} failed:\n{stderr}");
        }
        Ok(binary_path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    fn test_config() -> WorkerConfig {
        WorkerConfig {
            worker_id: "test-worker".into(),
            orchestrator_url: "http://localhost:8080".into(),
            heartbeat_interval: Duration::from_secs(5),
            poll_interval: Duration::from_millis(500),
            max_memory_mb: 512,
            max_concurrent_jobs: 4,
            use_docker: false,
            temp_dir: Some(std::env::temp_dir()),
        }
    }

    #[tokio::test]
    async fn test_sandbox_new() {
        let cfg = test_config();
        let sandbox = Sandbox::new(cfg, false);
        assert!(!sandbox.runner.docker_available());
    }

    #[tokio::test]
    async fn test_sandbox_execute_compilation_fail() {
        let cfg = test_config();
        let sandbox = Sandbox::new(cfg, false);

        let job = ExecutionJob {
            id: "compile-fail".into(),
            code: "this is not valid rust code".into(),
            language: Language::Rust,
            timeout_ms: 5000,
            memory_limit_mb: None,
            stdin: None,
            env_vars: None,
        };

        let result = sandbox.execute(&job).await.unwrap();
        assert!(!result.success);
        assert!(result.error.unwrap_or_default().contains("compilation"));
    }

    #[tokio::test]
    async fn test_sandbox_execute_python_hello() {
        let cfg = test_config();
        let sandbox = Sandbox::new(cfg, false);

        let job = ExecutionJob {
            id: "py-hello".into(),
            code: "print('hello')".into(),
            language: Language::Python,
            timeout_ms: 5000,
            memory_limit_mb: None,
            stdin: None,
            env_vars: None,
        };

        let result = sandbox.execute(&job).await.unwrap();
        assert!(result.success);
        assert_eq!(result.stdout.trim(), "hello");
    }

    #[tokio::test]
    async fn test_sandbox_execute_python_with_stdin() {
        let cfg = test_config();
        let sandbox = Sandbox::new(cfg, false);

        let job = ExecutionJob {
            id: "py-stdin".into(),
            code: "print(input().upper())".into(),
            language: Language::Python,
            timeout_ms: 5000,
            memory_limit_mb: None,
            stdin: Some("hello world\n".into()),
            env_vars: None,
        };

        let result = sandbox.execute(&job).await.unwrap();
        assert!(result.success);
        assert_eq!(result.stdout.trim(), "HELLO WORLD");
    }

    #[tokio::test]
    async fn test_sandbox_execute_timeout() {
        let cfg = test_config();
        let sandbox = Sandbox::new(cfg, false);

        let job = ExecutionJob {
            id: "timeout".into(),
            code: "import time; time.sleep(100)".into(),
            language: Language::Python,
            timeout_ms: 100,
            memory_limit_mb: None,
            stdin: None,
            env_vars: None,
        };

        let result = sandbox.execute(&job).await.unwrap();
        assert!(!result.success);
        assert!(result.timed_out);
    }

    #[tokio::test]
    async fn test_sandbox_execute_python_error() {
        let cfg = test_config();
        let sandbox = Sandbox::new(cfg, false);

        let job = ExecutionJob {
            id: "py-error".into(),
            code: "raise RuntimeError('boom')".into(),
            language: Language::Python,
            timeout_ms: 5000,
            memory_limit_mb: None,
            stdin: None,
            env_vars: None,
        };

        let result = sandbox.execute(&job).await.unwrap();
        assert!(!result.success);
        assert!(result.stderr.contains("RuntimeError"));
    }

    #[tokio::test]
    async fn test_sandbox_cleanup_after_execution() {
        let cfg = test_config();
        let sandbox = Sandbox::new(cfg, false);

        let job = ExecutionJob {
            id: "cleanup".into(),
            code: "print('done')".into(),
            language: Language::Python,
            timeout_ms: 5000,
            memory_limit_mb: None,
            stdin: None,
            env_vars: None,
        };

        let result = sandbox.execute(&job).await.unwrap();
        assert!(result.success);
    }
}
