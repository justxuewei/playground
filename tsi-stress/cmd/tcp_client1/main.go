package main

import (
	"log"
	"net"
	"os"
	"runtime"
	"strings"
)

func connect(semaphore chan struct{}) {
	for {
		semaphore <- struct{}{}
		conn, err := net.Dial("tcp", "127.0.0.1:18578")
		if err != nil {
			log.Print(err)
			<-semaphore
			continue
		}

		// receive HelloWorld
		buf := make([]byte, 10)
		n, err := conn.Read(buf)
		if err != nil {
			log.Print(err)
			conn.Close()
			<-semaphore
			continue
		}

		if n != 10 {
			log.Printf("Expected 10 bytes, got %d", n)
			conn.Close()
			<-semaphore
			continue
		}

		<-semaphore
		conn.Close()
	}
}

// TCP client with a maximum of 5 outstanding connections
func main() {
	data, err := os.ReadFile("/proc/cmdline")
	if err != nil {
		log.Fatal(err)
	}
	cmdline := string(data)
	if !strings.Contains(cmdline, "tsi_hijack=") {
		log.Printf("TSI not enabled")
	}

	numCPU := runtime.NumCPU()
	log.Printf("Spawn %d workers", numCPU)

	semaphore := make(chan struct{}, 5)

	for i := 0; i < numCPU; i++ {
		go connect(semaphore)
	}

	select {} // Block forever
}
