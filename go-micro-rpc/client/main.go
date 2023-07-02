package main

import (
	"context"
	"fmt"

	"github.com/justxuewei/go-micro-rpc/client/proto"
	"go-micro.dev/v4"
)

func main() {
	service := micro.NewService()

	client := proto.NewGreeterService("demo", service.Client())

	req := &proto.Request{
		Name: "justxuewei",
	}
	resp, err := client.Hello(context.Background(), req)
	if err != nil {
		panic(err)
	}

	fmt.Printf("RPC invocation is succeed. The result is \"%s\".\n", resp.GetMsg())
}
