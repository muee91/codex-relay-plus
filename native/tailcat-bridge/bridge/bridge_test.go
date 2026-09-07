package bridge

import (
	"testing"

	"github.com/tailscale/tailcat"
	"tailscale.com/types/key"
)

func TestReplaceTailcatClientRetainsIdentityAndEndpoint(t *testing.T) {
	clientKey := key.NewNode()
	old := newTailcatClient(tailcat.Addr("test-server"), clientKey)
	p := &proxyState{
		client:     old,
		serverAddr: tailcat.Addr("test-server"),
		clientKey:  clientKey,
		done:       make(chan struct{}),
	}

	if !p.replaceTailcatClient(old) {
		t.Fatal("replaceTailcatClient returned false")
	}
	if p.client == old {
		t.Fatal("replaceTailcatClient kept the failed client")
	}
	if p.client.Server != tailcat.Addr("test-server") {
		t.Fatalf("replacement server = %q, want %q", p.client.Server, "test-server")
	}
	if p.client.PublicKey() != clientKey.Public() {
		t.Fatal("replacement client did not retain the node identity")
	}
}

func TestReplaceTailcatClientDoesNotCloseNewerOrStoppedClient(t *testing.T) {
	p := &proxyState{
		client:     newTailcatClient(tailcat.Addr("test-server"), key.NewNode()),
		serverAddr: tailcat.Addr("test-server"),
		clientKey:  key.NewNode(),
		done:       make(chan struct{}),
	}

	stale := newTailcatClient(tailcat.Addr("test-server"), key.NewNode())
	if p.replaceTailcatClient(stale) {
		t.Fatal("replaceTailcatClient replaced a newer client")
	}

	current := p.currentTailcatClient()
	close(p.done)
	if p.replaceTailcatClient(current) {
		t.Fatal("replaceTailcatClient replaced a stopped proxy")
	}
	if p.currentTailcatClient() != current {
		t.Fatal("stopped proxy client changed")
	}
}
