FROM golang:1.23-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY cmd/ ./cmd/
COPY internal/ ./internal/
RUN CGO_ENABLED=0 go build -o /codehive-orchestrator ./cmd/main.go

FROM alpine:3.20
RUN apk add --no-cache ca-certificates && adduser -D -H appuser
COPY --from=build /codehive-orchestrator /usr/local/bin/codehive-orchestrator
USER appuser
EXPOSE 8080
CMD ["codehive-orchestrator", "server"]
