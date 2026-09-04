package tailcatbridge

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"sync"
	"time"

	"github.com/tailscale/tailcat"
)

const version = "tailcat-v0.5.0"

type proxySession struct {
	cancel context.CancelFunc
	client *tailcat.Client
	ln     net.Listener
	url    string
}

var (
	mu      sync.Mutex
	current *proxySession
)

// StartProxy starts (or reuses) a localhost TCP proxy into the Tailcat server.
// React Native can keep using its normal HTTP/WebSocket/SSE stack against the
// returned 127.0.0.1 URL while Tailcat handles WireGuard, NAT traversal and DERP.
func StartProxy(address string, remotePort int64) (string, error) {
	if len(address) < 3 || address[:2] != "tc" {
		return "", errors.New("invalid Tailcat address")
	}
	if remotePort < 1 || remotePort > 65535 {
		return "", fmt.Errorf("invalid remote port %d", remotePort)
	}

	mu.Lock()
	defer mu.Unlock()
	stopLocked()

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return "", fmt.Errorf("listen localhost: %w", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	client := tailcat.NewClient(tailcat.Addr(address))
	s := &proxySession{
		cancel: cancel,
		client: client,
		ln:     ln,
		url:    "http://" + ln.Addr().String(),
	}
	current = s
	go acceptLoop(ctx, s, uint16(remotePort))
	return s.url, nil
}

func StopProxy() {
	mu.Lock()
	defer mu.Unlock()
	stopLocked()
}

func CurrentProxyURL() string {
	mu.Lock()
	defer mu.Unlock()
	if current == nil {
		return ""
	}
	return current.url
}

func Version() string { return version }

func stopLocked() {
	if current == nil {
		return
	}
	current.cancel()
	_ = current.ln.Close()
	_ = current.client.Close()
	current = nil
}

func acceptLoop(ctx context.Context, s *proxySession, remotePort uint16) {
	for {
		local, err := s.ln.Accept()
		if err != nil {
			return
		}
		go proxyConn(ctx, s.client, remotePort, local)
	}
}

func proxyConn(ctx context.Context, client *tailcat.Client, remotePort uint16, local net.Conn) {
	defer local.Close()
	dialCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
	remote, err := client.DialTCPPort(dialCtx, remotePort)
	cancel()
	if err != nil {
		return
	}
	defer remote.Close()

	done := make(chan struct{}, 2)
	go func() {
		_, _ = io.Copy(remote, local)
		if closer, ok := remote.(interface{ CloseWrite() error }); ok {
			_ = closer.CloseWrite()
		}
		done <- struct{}{}
	}()
	go func() {
		_, _ = io.Copy(local, remote)
		if closer, ok := local.(interface{ CloseWrite() error }); ok {
			_ = closer.CloseWrite()
		}
		done <- struct{}{}
	}()

	select {
	case <-ctx.Done():
	case <-done:
		select {
		case <-ctx.Done():
		case <-done:
		case <-time.After(2 * time.Second):
		}
	}
}
