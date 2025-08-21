package main

import (
	"log"
	"net"
	"os"
	"strings"
)

func main() {
	data, err := os.ReadFile("/proc/cmdline")
	if err != nil {
		log.Fatal(err)
	}
	cmdline := string(data)
	if !strings.Contains(cmdline, "tsi_hijack=") {
		log.Printf("TSI not enabled")
	}

	// bind at 127.0.0.1:18578
	listener, err := net.Listen("tcp", "127.0.0.1:18578")
	if err != nil {
		log.Fatal(err)
	}
	defer listener.Close()

	log.Printf("Listening on %s", listener.Addr())
	for {
		conn, err := listener.Accept()
		if err != nil {
			log.Print(err)
			continue
		}
		go handleConnection(conn)
	}
}

func handleConnection(conn net.Conn) {
	defer conn.Close()
	// write 10 bytes
	_, err := conn.Write([]byte("HelloWorld"))
	if err != nil {
		log.Print(err)
	}
}
