package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/tailscale/tailcat"
	"tailscale.com/tailcfg"
)

var (
	addressOnly = flag.Bool("address-only", false, "resolve and print the persistent Tailcat address, then exit")
	keyPath     = flag.String("key", "", "path to the persistent Tailcat server key")
	relayPort   = flag.Int("port", 8787, "local Codex Relay TCP port to expose")
)

type startupInfo struct {
	Address string `json:"address"`
	Port    int    `json:"port"`
}

func main() {
	flag.Parse()
	if *keyPath == "" {
		log.Fatal("--key is required")
	}
	if *relayPort < 1 || *relayPort > 65535 {
		log.Fatalf("invalid --port %d", *relayPort)
	}

	pk, err := loadOrCreatePrivateKey(*keyPath)
	if err != nil {
		log.Fatalf("loading Tailcat key: %v", err)
	}
	region, err := resolveRegion(pk)
	if err != nil {
		log.Fatalf("resolving Tailcat DERP region: %v", err)
	}
	if err := savePrivateKey(*keyPath, pk); err != nil {
		log.Fatalf("saving Tailcat key: %v", err)
	}

	address := string(pk.Public.Addr())
	if *addressOnly {
		fmt.Println(address)
		return
	}

	server := &tailcat.Server{Key: pk.Private, Region: region}
	server.OnTCP = func(port uint16) func(net.Conn) {
		if int(port) != *relayPort {
			return nil
		}
		return func(remote net.Conn) {
			local, err := net.DialTimeout(
				"tcp",
				net.JoinHostPort("127.0.0.1", fmt.Sprint(*relayPort)),
				5*time.Second,
			)
			if err != nil {
				log.Printf("Tailcat backend dial failed: %v", err)
				_ = remote.Close()
				return
			}
			tailcat.ProxyConns(remote, local)
		}
	}
	if err := server.Start(); err != nil {
		_ = server.Close()
		log.Fatalf("starting Tailcat server: %v", err)
	}
	defer server.Close()

	if err := json.NewEncoder(os.Stdout).Encode(startupInfo{Address: address, Port: *relayPort}); err != nil {
		log.Fatalf("writing Tailcat startup info: %v", err)
	}

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	<-sig
}

func loadOrCreatePrivateKey(path string) (*tailcat.PrivateKey, error) {
	data, err := os.ReadFile(path)
	if err == nil {
		var pk tailcat.PrivateKey
		if err := json.Unmarshal(data, &pk); err != nil {
			return nil, fmt.Errorf("decoding %s: %w", path, err)
		}
		return &pk, nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	pk := tailcat.NewPrivateKey()
	pk.Public.RegionID = -1
	return pk, nil
}

func resolveRegion(pk *tailcat.PrivateKey) (*tailcfg.DERPRegion, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	ci := pk.Public
	if err := ci.Expand(ctx, tailcat.ExpandForServer); err != nil {
		return nil, err
	}
	if len(ci.Region) != 1 || ci.Region[0] == nil {
		return nil, fmt.Errorf("Tailcat returned %d DERP regions; expected 1", len(ci.Region))
	}
	region := ci.Region[0]
	pk.Public.RegionID = region.RegionID
	pk.Public.Region = nil
	return region, nil
}

func savePrivateKey(path string, pk *tailcat.PrivateKey) error {
	data, err := json.Marshal(pk)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, append(data, '\n'), 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
