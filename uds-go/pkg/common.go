package pkg

// This project references the implementation of go-unix-domain-socket-example,
// whose GitHub repository is: https://github.com/devlights/go-unix-domain-socket-example/blob/master/cmd/readwrite/client/main.go.
const (
	Protocol   = "unix"
	SocketPath = "/tmp/uds-go.sock"
)
