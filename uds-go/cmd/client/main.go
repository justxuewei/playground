package main

import (
	"fmt"
	"net"
	"time"

	"github.com/justxuewei/playground/uds-go/pkg"
)

func main() {
	values := []string{
		"hello world",
		"golang",
		"goroutine",
		"this program runs on crostini",
	}

	conn, err := net.Dial(pkg.Protocol, pkg.SocketPath)
	if err != nil {
		panic(err)
	}
	defer conn.Close()

	for _, v := range values {
		time.Sleep(1 * time.Second)

		msg := &pkg.Echo{
			Length: len(v),
			Data: []byte(v),
		}

		if err = msg.Write(conn); err != nil {
			panic(err)
		}
		fmt.Printf("[client] write message = %v\n", msg)

		if err = msg.Read(conn); err != nil {
			panic(err)
		}
		fmt.Printf("[client] read message = %v\n", msg)
	}
}
