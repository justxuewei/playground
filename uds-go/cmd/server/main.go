package main

import (
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/signal"
	"strings"

	"github.com/justxuewei/playground/uds-go/pkg"
)

func cleanup() {
	if _, err := os.Stat(pkg.SocketPath); err == nil {
		if err := os.RemoveAll(pkg.SocketPath); err != nil {
			panic(err)
		}
	}
}

func main() {
	cleanup()

	listener, err := net.Listen(pkg.Protocol, pkg.SocketPath)
	if err != nil {
		panic(err)
	}

	quit := make(chan os.Signal)
	signal.Notify(quit, os.Interrupt)

	go func() {
		<-quit
		fmt.Println("[server] preparing to exit process...")
		close(quit)
		cleanup()
		os.Exit(0)
	}()

	fmt.Println("[server] server launched")
	for {
		conn, err := listener.Accept()
		if err != nil {
			panic(err)
		}
		fmt.Printf("[server] accepted: %v\n", conn.RemoteAddr().Network())
		
		go func(conn net.Conn) {
			defer conn.Close()

			for {
				msg := new(pkg.Echo)
				err := msg.Read(conn)
				if err != nil {
					if errors.Is(err, io.EOF) {
						fmt.Println("[server] closed by peer")
						break
					}

					panic(err)
				}
				fmt.Printf("[server] read message = %v\n", msg)

				s := strings.ToUpper(string(msg.Data))
				msg.Data = []byte(s)

				err = msg.Write(conn)
				if err != nil {
					panic(err)
				}

				fmt.Printf("[server] write message = %v\n", msg)
			}
		}(conn)
	}
}
