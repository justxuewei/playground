package main

import (
	"log"
	"net"
	"os"
	"strings"
)

func connect() {
	net.Dial("tcp", "127.0.0.1:8080")
}

func main() {
	data, err := os.ReadFile("/proc/cmdline")
	if err != nil {
		log.Fatal(err)
	}
	cmdline := string(data)
	if !strings.Contains(cmdline, "tsi_hijack=") {
		log.Fatal("TSI not enabled")
	}

	for {
		go connect()
	}
}
