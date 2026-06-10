package runner

import (
	"context"
	"fmt"

	"github.com/codehive/orchestrator/internal/types"
)

type SandboxStrategy interface {
	Execute(ctx context.Context, req types.ExecutionRequest) (string, string, int, error)
}

type DirectSandbox struct{}

func (s *DirectSandbox) Execute(ctx context.Context, req types.ExecutionRequest) (string, string, int, error) {
	return executeCommand(string(req.Language), buildArgs(req), req.Stdin, req.Timeout)
}

func buildArgs(req types.ExecutionRequest) []string {
	return []string{"-c", req.Code}
}

type DockerSandbox struct{}

func (s *DockerSandbox) Execute(ctx context.Context, req types.ExecutionRequest) (string, string, int, error) {
	args := []string{"run", "--rm", "--network", "none", "--read-only",
		fmt.Sprintf("--memory=%dm", req.MemoryLimit),
		"--cpus=1", "--init",
		"codehive/" + string(req.Language),
	}
	args = append(args, buildArgs(req)...)
	return executeCommand("docker", args, req.Stdin, req.Timeout)
}
