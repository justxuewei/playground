package main

import (
	"net"
)

func connect() {
	net.Dial("tcp", "127.0.0.1:8080")
}

func main() {
	for {
		go connect()
	}
}
