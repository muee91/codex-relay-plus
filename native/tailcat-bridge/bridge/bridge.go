package bridge

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/tailscale/tailcat"
	"tailscale.com/types/key"
)

type proxyState struct {
	client     *tailcat.Client
	done       chan struct{}
	keyPath    string
	listener   net.Listener
	localURL   string
	remoteAddr string
	remotePort uint16
	stopOnce   sync.Once
}

type pathStatus struct {
	DERPRegion string  `json:"derpRegion,omitempty"`
	Endpoint   string  `json:"endpoint,omitempty"`
	Error      string  `json:"error,omitempty"`
	LatencyMS  float64 `json:"latencyMs,omitempty"`
	Path       string  `json:"path"`
}

var (
	proxyMu      sync.Mutex
	activeProxy  *proxyState
	statusMu     sync.RWMutex
	currentState = pathStatus{Path: "idle"}
)

// StartProxy starts (or reuses) a loopback HTTP/TCP proxy whose outbound side
// is a Tailcat tunnel to remotePort on the server encoded by serverAddr.
// Gomobile exposes this function to Android as a synchronous Java call, so the
// React Native wrapper invokes it on a background executor.
func StartProxy(serverAddr string, remotePort int64, keyPath string) (string, error) {
	if remotePort < 1 || remotePort > 65535 {
		return "", fmt.Errorf("invalid remote port %d", remotePort)
	}
	if keyPath == "" {
		return "", errors.New("client key path is required")
	}
	addr := tailcat.Addr(serverAddr)
	if _, err := tailcat.ParseAddr(addr); err != nil {
		return "", fmt.Errorf("invalid Tailcat address: %w", err)
	}

	proxyMu.Lock()
	defer proxyMu.Unlock()
	if activeProxy != nil && activeProxy.remoteAddr == serverAddr && activeProxy.remotePort == uint16(remotePort) && activeProxy.keyPath == keyPath {
		return activeProxy.localURL, nil
	}
	stopProxyLocked()

	clientKey, err := loadOrCreateClientKey(keyPath)
	if err != nil {
		return "", err
	}
	client := tailcat.NewClient(addr)
	client.Key = clientKey
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		_ = client.Close()
		return "", fmt.Errorf("opening loopback proxy: %w", err)
	}
	p := &proxyState{
		client:     client,
		done:       make(chan struct{}),
		keyPath:    keyPath,
		listener:   listener,
		localURL:   "http://" + listener.Addr().String(),
		remoteAddr: serverAddr,
		remotePort: uint16(remotePort),
	}
	activeProxy = p
	setStatus(pathStatus{Path: "connecting"})
	go p.acceptLoop()
	go p.statusLoop()
	return p.localURL, nil
}

// StopProxy shuts down the active Tailcat client and loopback listener.
func StopProxy() error {
	proxyMu.Lock()
	defer proxyMu.Unlock()
	stopProxyLocked()
	setStatus(pathStatus{Path: "idle"})
	return nil
}

// StatusJSON returns the latest path-discovery state. "direct" means the
// disco ping returned a peer endpoint; "derp" means the working path is a
// relay region; "connecting" and "offline" are self-explanatory.
func StatusJSON() string {
	statusMu.RLock()
	status := currentState
	statusMu.RUnlock()
	data, _ := json.Marshal(status)
	return string(data)
}

// RefreshPath performs one bounded path probe immediately and returns the new
// status. It also nudges Tailcat's direct-path discovery when NAT traversal is
// possible.
func RefreshPath() string {
	proxyMu.Lock()
	p := activeProxy
	proxyMu.Unlock()
	if p == nil {
		setStatus(pathStatus{Path: "idle"})
		return StatusJSON()
	}
	p.probePath()
	return StatusJSON()
}

func stopProxyLocked() {
	if activeProxy == nil {
		return
	}
	p := activeProxy
	activeProxy = nil
	p.stopOnce.Do(func() {
		close(p.done)
		_ = p.listener.Close()
		_ = p.client.Close()
	})
}

func (p *proxyState) acceptLoop() {
	for {
		local, err := p.listener.Accept()
		if err != nil {
			select {
			case <-p.done:
				return
			default:
				setStatus(pathStatus{Path: "offline", Error: err.Error()})
				return
			}
		}
		go p.proxyConnection(local)
	}
}

func (p *proxyState) proxyConnection(local net.Conn) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	remote, err := p.client.DialTCPPort(ctx, p.remotePort)
	cancel()
	if err != nil {
		setStatus(pathStatus{Path: "offline", Error: err.Error()})
		_ = local.Close()
		return
	}
	tailcat.ProxyConns(local, remote)
}

func (p *proxyState) statusLoop() {
	p.probePath()
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			p.probePath()
		case <-p.done:
			return
		}
	}
}

func (p *proxyState) probePath() {
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	result, err := p.client.DiscoPing(ctx)
	if err != nil {
		setStatus(pathStatus{Path: "offline", Error: err.Error()})
		return
	}
	status := pathStatus{LatencyMS: result.LatencySeconds * 1000}
	if result.Endpoint != "" {
		status.Path = "direct"
		status.Endpoint = result.Endpoint
	} else {
		status.Path = "derp"
		if result.DERPRegionCode != "" {
			status.DERPRegion = result.DERPRegionCode
		} else {
			status.DERPRegion = fmt.Sprint(result.DERPRegionID)
		}
	}
	setStatus(status)
}

func setStatus(status pathStatus) {
	statusMu.Lock()
	currentState = status
	statusMu.Unlock()
}

func loadOrCreateClientKey(path string) (key.NodePrivate, error) {
	data, err := os.ReadFile(path)
	if err == nil {
		var k key.NodePrivate
		if err := k.UnmarshalText(bytes.TrimSpace(data)); err != nil {
			return key.NodePrivate{}, fmt.Errorf("decoding Tailcat client key: %w", err)
		}
		return k, nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return key.NodePrivate{}, err
	}
	k := key.NewNode()
	text, err := k.MarshalText()
	if err != nil {
		return key.NodePrivate{}, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return key.NodePrivate{}, err
	}
	if err := os.WriteFile(path, append(text, '\n'), 0o600); err != nil {
		return key.NodePrivate{}, err
	}
	return k, nil
}
