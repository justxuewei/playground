// server accepts connections on 0.0.0.0:8080 until a random timer fires,
// then closes the listener, drains all active connections, and rebinds.
//
// SO_REUSEADDR is explicitly disabled so that a conn fd stuck in CLOSE_WAIT
// from a broken kernel close path will cause the next bind() to fail with
// EADDRINUSE — exposing the bug.
//
// Usage:
//
//	go run .
//	go run . -addr 0.0.0.0:9090 -min 200ms -max 1s
package main

import (
	"bytes"
	"context"
	"errors"
	"flag"
	"fmt"
	"math/rand"
	"net"
	"os"
	"sync"
	"syscall"
	"time"
)

var response = []byte(
	"HTTP/1.1 200 OK\r\n" +
		"Content-Type: text/plain\r\n" +
		"Content-Length: 12\r\n" +
		"Connection: close\r\n" +
		"\r\n" +
		"hello world\n",
)

func handleConn(conn net.Conn) {
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(2 * time.Second))

	// Read until end of HTTP request headers.
	buf := make([]byte, 4096)
	req := make([]byte, 0, 4096)
	for !bytes.Contains(req, []byte("\r\n\r\n")) {
		n, err := conn.Read(buf)
		if n > 0 {
			req = append(req, buf[:n]...)
		}
		if err != nil {
			return
		}
	}

	conn.Write(response)

	// Drain until peer sends FIN.
	for {
		n, err := conn.Read(buf)
		if n == 0 || err != nil {
			return
		}
	}
}

func main() {
	addr := flag.String("addr", "0.0.0.0:8080", "listen address")
	minTTL := flag.Duration("min", 1*time.Second, "minimum listener lifetime")
	maxTTL := flag.Duration("max", 5*time.Second, "maximum listener lifetime")
	flag.Parse()

	// ListenConfig with SO_REUSEADDR disabled.
	// Go sets SO_REUSEADDR by default; we unset it here so that a stuck socket
	// from the previous iteration blocks the next bind().
	lc := net.ListenConfig{
		Control: func(network, address string, c syscall.RawConn) error {
			return c.Control(func(fd uintptr) {
				syscall.SetsockoptInt(int(fd), syscall.SOL_SOCKET, syscall.SO_REUSEADDR, 0)
			})
		},
	}

	for iter := 1; ; iter++ {
		ln, err := lc.Listen(context.Background(), "tcp", *addr)
		if err != nil {
			if errors.Is(err, syscall.EADDRINUSE) {
				fmt.Fprintf(os.Stderr,
					"[server iter %d] bind failed: address already in use — bug reproduced!\n", iter)
			} else {
				fmt.Fprintf(os.Stderr, "[server iter %d] listen: %v\n", iter, err)
			}
			os.Exit(1)
		}

		ttl := *minTTL + time.Duration(rand.Int63n(int64(*maxTTL-*minTTL)))
		fmt.Printf("[server iter %d] listening on %s  ttl=%v\n", iter, *addr, ttl.Round(time.Millisecond))

		var (
			wg       sync.WaitGroup
			accepted int
		)

		// Close the listener once the TTL expires; Accept() will then return
		// an error and exit the loop below.
		time.AfterFunc(ttl, func() { ln.Close() })

		for {
			conn, err := ln.Accept()
			if err != nil {
				break
			}
			accepted++
			wg.Add(1)
			go func() {
				defer wg.Done()
				handleConn(conn)
			}()
		}

		fmt.Printf("[server iter %d] listener closed  accepted=%d  draining...\n", iter, accepted)
		wg.Wait()
		fmt.Printf("[server iter %d] done\n\n", iter)
	}
}
