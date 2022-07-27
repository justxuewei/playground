package main

import (
	"fmt"

	"github.com/vishvananda/netlink"
	"github.com/vishvananda/netns"
)

func main() {
	netnsHandle, err := netns.Get()
	if err != nil {
		panic(err)
	}
	defer netnsHandle.Close()

	netlinkHandle, err := netlink.NewHandleAt(netnsHandle)
	if err != nil {
		panic(err)
	}
	defer netlinkHandle.Delete()

	linkList, err := netlinkHandle.LinkList()
	if err != nil {
		panic(err)
	}

	for _, link := range linkList {
		fmt.Printf("====== link index: %d\n", link.Attrs().Index)
		addrs, _ := netlinkHandle.AddrList(link, netlink.FAMILY_ALL)
		for i, addr := range addrs {
			fmt.Printf("addr %d: %s\n", i, addr.String())
		}
		routes, _ := netlinkHandle.RouteList(link, netlink.FAMILY_ALL)
		for i, route := range routes {
			fmt.Printf("route %d: %s\n", i, route.String())
		}
		neighbors, _ := netlinkHandle.NeighList(link.Attrs().Index, netlink.FAMILY_ALL)
		for i, neighbor := range neighbors {
			fmt.Printf("neighbor %d: %s\n", i, neighbor.String())
		}
	}
}
