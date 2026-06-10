package runner

import (
	"context"
	"os"

	"github.com/codehive/orchestrator/internal/types"
)

type Executor interface {
	Execute(ctx context.Context, req types.ExecutionRequest) (string, string, int, error)
}

type pythonExecutor struct{}
type jsExecutor struct{}
type goExecutor struct{}
type rustExecutor struct{}
type rubyExecutor struct{}
type javaExecutor struct{}

func (e *pythonExecutor) Execute(ctx context.Context, req types.ExecutionRequest) (string, string, int, error) {
	return executeCommand("python3", []string{"-c", req.Code}, req.Stdin, req.Timeout)
}

func (e *jsExecutor) Execute(ctx context.Context, req types.ExecutionRequest) (string, string, int, error) {
	return executeCommand("node", []string{"-e", req.Code}, req.Stdin, req.Timeout)
}

func (e *goExecutor) Execute(ctx context.Context, req types.ExecutionRequest) (string, string, int, error) {
	return executeCommand("go", []string{"run", "-"}, req.Code, req.Timeout)
}

func (e *rustExecutor) Execute(ctx context.Context, req types.ExecutionRequest) (string, string, int, error) {
	return executeCommand("rustc", []string{"-"}, req.Code, req.Timeout)
}

func (e *rubyExecutor) Execute(ctx context.Context, req types.ExecutionRequest) (string, string, int, error) {
	return executeCommand("ruby", []string{"-e", req.Code}, req.Stdin, req.Timeout)
}

func (e *javaExecutor) Execute(ctx context.Context, req types.ExecutionRequest) (string, string, int, error) {
	tmpFile, err := os.CreateTemp("", "Main-*.java")
	if err != nil {
		return "", "", 1, err
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	if _, err := tmpFile.WriteString(req.Code); err != nil {
		tmpFile.Close()
		return "", "", 1, err
	}
	tmpFile.Close()

	return executeCommand("java", []string{tmpPath}, req.Stdin, req.Timeout)
}

func GetExecutor(lang types.Language) Executor {
	switch lang {
	case types.LanguagePython:
		return &pythonExecutor{}
	case types.LanguageJavaScript:
		return &jsExecutor{}
	case types.LanguageGo:
		return &goExecutor{}
	case types.LanguageRust:
		return &rustExecutor{}
	case types.LanguageRuby:
		return &rubyExecutor{}
	case types.LanguageJava:
		return &javaExecutor{}
	default:
		return &pythonExecutor{}
	}
}
