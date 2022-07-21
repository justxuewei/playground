package pkg

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"net"
)

type Echo struct {
	Length int
	Data   []byte
}

func (e *Echo) String() string {
	return fmt.Sprintf("length: %d, data: %s", e.Length, e.Data)
}

func (e *Echo) Write(c net.Conn) error {
	// length + data
	data := make([]byte, 0, 4 + e.Length)

	// append length
	buf := make([]byte, 4)
	binary.BigEndian.PutUint32(buf, uint32(e.Length))
	data = append(data, buf...)

	// append data
	w := bytes.Buffer{}
	err := binary.Write(&w, binary.BigEndian, e.Data)
	if err != nil {
		return err
	}
	data = append(data, w.Bytes()...)

	_, err = c.Write(data)
	if err != nil {
		return err
	}

	return nil
}

func (e *Echo) Read(c net.Conn) error {
	buf := make([]byte, 4)

	_, err := c.Read(buf)
	if err != nil {
		return err
	}

	bytesLen := binary.BigEndian.Uint32(buf)
	e.Length = int(bytesLen)
	e.Data = make([]byte, e.Length)

	_, err = c.Read(e.Data)
	if err != nil {
		return err
	}

	return nil
}
