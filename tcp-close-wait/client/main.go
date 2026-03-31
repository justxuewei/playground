// client hammers the server with concurrent HTTP GET requests using goroutines.
// Connections may be refused while the server listener is cycling; those are
// counted separately and are expected.
//
// Usage:
//
//	go run .
//	go run . -n 50 -url http://127.0.0.1:8080/
package main

import (
	"flag"
	"fmt"
	"io"
	"net/http"
	"sync/atomic"
	"time"
)

func worker(client *http.Client, url string, ok, refused *atomic.Int64) {
	for {
		resp, err := client.Get(url)
		if err != nil {
			refused.Add(1)
			// Brief pause to avoid spinning on a down server.
			time.Sleep(20 * time.Millisecond)
			continue
		}
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
		ok.Add(1)
	}
}

func main() {
	n := flag.Int("n", 20, "number of concurrent goroutines")
	url := flag.String("url", "http://127.0.0.1:8080/", "target URL")
	flag.Parse()

	client := &http.Client{Timeout: 2 * time.Second}

	var ok, refused atomic.Int64

	for i := 0; i < *n; i++ {
		go worker(client, *url, &ok, &refused)
	}

	fmt.Printf("started %d workers → %s\n\n", *n, *url)

	// Print a stats line every second.
	var prevOK, prevRefused int64
	for range time.NewTicker(time.Second).C {
		curOK := ok.Load()
		curRefused := refused.Load()
		fmt.Printf("[stats] ok=%-8d +%-5d  refused=%-8d +%d\n",
			curOK, curOK-prevOK,
			curRefused, curRefused-prevRefused,
		)
		prevOK, prevRefused = curOK, curRefused
	}
}
