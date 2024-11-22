package main

import (
	"context"
	"flag"
	"fmt"
	"net"
	"time"
)

func main() {
	dnsServer := flag.String("dns", "127.0.0.1:53", "DNS server to use (e.g., 192.168.0.1:53)")
	address := flag.String("addr", "baidu.com", "Address to resolve (e.g., baidu.com)")

	flag.Parse()

	fmt.Printf("DNS Server\t%s\n\n", *dnsServer)

	r := &net.Resolver{
		PreferGo: true,
		Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
			d := net.Dialer{
				Timeout: time.Millisecond * time.Duration(10000),
			}
			return d.DialContext(ctx, network, *dnsServer)
		},
	}
	addrs, err := r.LookupHost(context.Background(), *address)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Name\t\tAddress\n")
	fmt.Printf("%s\t%v\n", *address, addrs)
}
