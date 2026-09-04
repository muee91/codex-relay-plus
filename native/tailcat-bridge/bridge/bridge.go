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

const (
	loopbackListenAddress       = "127.0.0.1:39127"
	lanDialTimeout              = 900 * time.Millisecond
	lanFailureThreshold         = 2
	lanRecoverySuccessThreshold = 2
	remoteToLANCooldown         = 10 * time.Second
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

	routeMu             sync.Mutex
	mode                string
	lanTargets          []string
	selectedRoute       string
	lanFailures         int
	lanRecoverySuccess  int
	lastRemoteSelection time.Time
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

// ConfigureProxy starts or updates the stable loopback transport. In auto mode
// the proxy prefers direct LAN TCP, fails over to Tailcat after two confirming
// LAN failures, and returns to LAN only after a cooldown plus two successful
// recovery probes. local and remote modes pin the corresponding transport.
func ConfigureProxy(serverAddr string, remotePort int64, lanTargetsJSON, mode, keyPath string) (string, error) {
	if remotePort < 1 || remotePort > 65535 {
		return "", fmt.Errorf("invalid remote port %d", remotePort)
	}
	if keyPath == "" {
		return "", errors.New("client key path is required")
	}
	if mode != "auto" && mode != "local" && mode != "remote" {
		return "", fmt.Errorf("invalid transport mode %q", mode)
	}
	addr := tailcat.Addr(serverAddr)
	if _, err := tailcat.ParseAddr(addr); err != nil {
		return "", fmt.Errorf("invalid Tailcat address: %w", err)
	}
	var lanTargets []string
	if lanTargetsJSON != "" {
		if err := json.Unmarshal([]byte(lanTargetsJSON), &lanTargets); err != nil {
			return "", fmt.Errorf("invalid LAN target list: %w", err)
		}
	}
	lanTargets = normalizeLANTargets(lanTargets)

	proxyMu.Lock()
	defer proxyMu.Unlock()
	if activeProxy != nil && activeProxy.remoteAddr == serverAddr && activeProxy.remotePort == uint16(remotePort) && activeProxy.keyPath == keyPath {
		activeProxy.updateRouteConfig(mode, lanTargets)
		return activeProxy.localURL, nil
	}
	stopProxyLocked()

	clientKey, err := loadOrCreateClientKey(keyPath)
	if err != nil {
		return "", err
	}
	client := tailcat.NewClient(addr)
	client.Key = clientKey
	listener, err := net.Listen("tcp", loopbackListenAddress)
	if err != nil {
		_ = client.Close()
		return "", fmt.Errorf("opening loopback proxy: %w", err)
	}
	selected := "lan"
	if mode == "remote" || len(lanTargets) == 0 {
		selected = "remote"
	}
	p := &proxyState{
		client:        client,
		done:          make(chan struct{}),
		keyPath:       keyPath,
		listener:      listener,
		localURL:      "http://" + loopbackListenAddress,
		remoteAddr:    serverAddr,
		remotePort:    uint16(remotePort),
		mode:          mode,
		lanTargets:    lanTargets,
		selectedRoute: selected,
	}
	if selected == "remote" {
		p.lastRemoteSelection = time.Now()
	}
	activeProxy = p
	if selected == "lan" {
		setStatus(pathStatus{Path: "lan"})
	} else {
		setStatus(pathStatus{Path: "connecting"})
	}
	go p.acceptLoop()
	go p.statusLoop()
	return p.localURL, nil
}

// StartProxy is retained as the narrow remote-only API used by older callers.
func StartProxy(serverAddr string, remotePort int64, keyPath string) (string, error) {
	return ConfigureProxy(serverAddr, remotePort, "[]", "remote", keyPath)
}

func StopProxy() error {
	proxyMu.Lock()
	defer proxyMu.Unlock()
	stopProxyLocked()
	setStatus(pathStatus{Path: "idle"})
	return nil
}

func StatusJSON() string {
	statusMu.RLock()
	status := currentState
	statusMu.RUnlock()
	data, _ := json.Marshal(status)
	return string(data)
}

func RefreshPath() string {
	proxyMu.Lock()
	p := activeProxy
	proxyMu.Unlock()
	if p == nil {
		setStatus(pathStatus{Path: "idle"})
		return StatusJSON()
	}
	if p.currentRoute() == "lan" {
		setStatus(pathStatus{Path: "lan"})
	} else {
		p.probeTailcatPath()
	}
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

func (p *proxyState) updateRouteConfig(mode string, lanTargets []string) {
	p.routeMu.Lock()
	defer p.routeMu.Unlock()
	p.mode = mode
	p.lanTargets = lanTargets
	p.lanFailures = 0
	p.lanRecoverySuccess = 0
	if mode == "remote" || len(lanTargets) == 0 {
		if p.selectedRoute != "remote" {
			p.lastRemoteSelection = time.Now()
		}
		p.selectedRoute = "remote"
		return
	}
	if mode == "local" {
		p.selectedRoute = "lan"
	}
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
	mode, route, targets := p.routeSnapshot()
	if mode != "remote" && route == "lan" && len(targets) > 0 {
		if remote := dialFirstLAN(targets); remote != nil {
			p.recordLANSuccess()
			setStatus(pathStatus{Path: "lan"})
			tailcat.ProxyConns(local, remote)
			return
		}
		if p.recordLANFailure() < lanFailureThreshold {
			if remote := dialFirstLAN(targets); remote != nil {
				p.recordLANSuccess()
				setStatus(pathStatus{Path: "lan"})
				tailcat.ProxyConns(local, remote)
				return
			}
			p.recordLANFailure()
		}
		if mode == "local" {
			setStatus(pathStatus{Path: "offline", Error: "local Relay is unreachable"})
			_ = local.Close()
			return
		}
		p.selectRemote()
	}

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
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		p.refreshRouteStatus()
		select {
		case <-ticker.C:
		case <-p.done:
			return
		}
	}
}

func (p *proxyState) refreshRouteStatus() {
	mode, route, targets := p.routeSnapshot()
	if route == "lan" && mode != "remote" {
		setStatus(pathStatus{Path: "lan"})
		return
	}
	p.probeTailcatPath()
	if mode != "auto" || len(targets) == 0 || time.Since(p.remoteSelectedAt()) < remoteToLANCooldown {
		return
	}
	if remote := dialFirstLAN(targets); remote != nil {
		_ = remote.Close()
		if p.recordLANRecoverySuccess() >= lanRecoverySuccessThreshold {
			p.selectLAN()
			setStatus(pathStatus{Path: "lan"})
		}
	} else {
		p.resetLANRecovery()
	}
}

func (p *proxyState) probeTailcatPath() {
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

func (p *proxyState) routeSnapshot() (mode, route string, targets []string) {
	p.routeMu.Lock()
	defer p.routeMu.Unlock()
	return p.mode, p.selectedRoute, append([]string(nil), p.lanTargets...)
}

func (p *proxyState) currentRoute() string {
	p.routeMu.Lock()
	defer p.routeMu.Unlock()
	return p.selectedRoute
}

func (p *proxyState) recordLANFailure() int {
	p.routeMu.Lock()
	defer p.routeMu.Unlock()
	p.lanFailures++
	return p.lanFailures
}

func (p *proxyState) recordLANSuccess() {
	p.routeMu.Lock()
	defer p.routeMu.Unlock()
	p.lanFailures = 0
}

func (p *proxyState) recordLANRecoverySuccess() int {
	p.routeMu.Lock()
	defer p.routeMu.Unlock()
	p.lanRecoverySuccess++
	return p.lanRecoverySuccess
}

func (p *proxyState) resetLANRecovery() {
	p.routeMu.Lock()
	defer p.routeMu.Unlock()
	p.lanRecoverySuccess = 0
}

func (p *proxyState) selectRemote() {
	p.routeMu.Lock()
	defer p.routeMu.Unlock()
	p.selectedRoute = "remote"
	p.lanFailures = 0
	p.lanRecoverySuccess = 0
	p.lastRemoteSelection = time.Now()
}

func (p *proxyState) selectLAN() {
	p.routeMu.Lock()
	defer p.routeMu.Unlock()
	p.selectedRoute = "lan"
	p.lanFailures = 0
	p.lanRecoverySuccess = 0
}

func (p *proxyState) remoteSelectedAt() time.Time {
	p.routeMu.Lock()
	defer p.routeMu.Unlock()
	return p.lastRemoteSelection
}

func dialFirstLAN(targets []string) net.Conn {
	for _, target := range targets {
		conn, err := net.DialTimeout("tcp", target, lanDialTimeout)
		if err == nil {
			return conn
		}
	}
	return nil
}

func normalizeLANTargets(targets []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(targets))
	for _, target := range targets {
		host, port, err := net.SplitHostPort(target)
		if err != nil || host == "" || port == "" {
			continue
		}
		normalized := net.JoinHostPort(host, port)
		if !seen[normalized] {
			seen[normalized] = true
			out = append(out, normalized)
		}
	}
	return out
}

func setStatus(status pathStatus) {
	statusMu.Lock()
	currentState = status
	statusMu.Unlock()
}

func loadOrCreateClientKey(path string) (key.NodePrivate, error) {
	var zero key.NodePrivate
	data, err := os.ReadFile(path)
	if err == nil {
		var k key.NodePrivate
		if err := k.UnmarshalText(bytes.TrimSpace(data)); err != nil {
			return zero, fmt.Errorf("decoding Tailcat client key: %w", err)
		}
		return k, nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return zero, err
	}
	k := key.NewNode()
	text, err := k.MarshalText()
	if err != nil {
		return zero, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return zero, err
	}
	if err := os.WriteFile(path, append(text, '\n'), 0o600); err != nil {
		return zero, err
	}
	return k, nil
}
