package main

import (
	"context"

	"github.com/justxuewei/go-micro-rpc/server/proto"
	"go-micro.dev/v4"
)

type Greeter struct{}

func (g *Greeter) Hello(ctx context.Context, req *proto.Request, resp *proto.Response) error {
	resp.Msg = "Hello, " + req.Name
	return nil
}

func main() {
	service := micro.NewService(
		micro.Name("demo"),
	)

	proto.RegisterGreeterHandler(service.Server(), &Greeter{})

	service.Init()
	service.Run()
}
