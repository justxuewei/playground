#!/usr/bin/env python3
"""
close_wait_test.py

Reproduces a kernel bug where the server cannot close its conn fd properly,
leaving the socket stuck (e.g. in CLOSE_WAIT).

Detection strategy:
  Each iteration does a fresh bind() to port 10000 WITHOUT SO_REUSEADDR.
  If the previous conn fd was not fully released by the kernel, the port is
  still occupied and bind() fails with EADDRINUSE — confirming the bug.

Server loop (one connection per iteration):
  1. bind() to 0.0.0.0:10000  ← fails here if previous socket is stuck
  2. listen()
  3. accept()  →  close listen fd
  4. read HTTP request, send response
  5. drain until peer closes, then close conn fd
  6. repeat

Client: curl hits http://127.0.0.1:10000/ in a loop.
"""

import errno
import socket
import subprocess
import threading

HOST    = "0.0.0.0"
PORT    = 10000
REPEATS = 0  # 0 = run until bug is hit or Ctrl-C

RESPONSE = (
    b"HTTP/1.1 200 OK\r\n"
    b"Content-Type: text/plain\r\n"
    b"Content-Length: 12\r\n"
    b"Connection: close\r\n"
    b"\r\n"
    b"hello world\n"
)


def server(ready: threading.Event, stop: threading.Event):
    iteration = 0

    while not stop.is_set():
        iteration += 1

        lsock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        # No SO_REUSEADDR — a stuck conn fd from the previous iteration will
        # cause bind() to return EADDRINUSE, exposing the kernel bug.
        try:
            lsock.bind((HOST, PORT))
        except OSError as e:
            lsock.close()
            if e.errno == errno.EADDRINUSE:
                print(
                    f"[server iter {iteration}] "
                    f"bind() failed: Address already in use — bug reproduced!"
                )
            else:
                print(f"[server iter {iteration}] bind() failed: {e}")
            stop.set()
            return

        lsock.listen(1)
        lsock.settimeout(2.0)
        print(f"[server iter {iteration}] listening on {HOST}:{PORT}")

        ready.set()

        try:
            conn, peer = lsock.accept()
        except socket.timeout:
            lsock.close()
            ready.clear()
            continue

        # Close listen fd right after accept.
        lsock.close()
        print(f"[server iter {iteration}] accepted {peer[0]}:{peer[1]}, listen fd closed")

        # Read HTTP request.
        buf = b""
        conn.settimeout(2.0)
        try:
            while b"\r\n\r\n" not in buf:
                chunk = conn.recv(4096)
                if not chunk:
                    break
                buf += chunk
        except socket.timeout:
            pass

        conn.sendall(RESPONSE)

        # Drain until peer sends FIN.
        try:
            while True:
                chunk = conn.recv(4096)
                if not chunk:
                    break
        except socket.timeout:
            pass

        conn.close()
        print(f"[server iter {iteration}] conn fd closed\n")

        ready.clear()


def client(ready: threading.Event, stop: threading.Event):
    i = 0
    while not stop.is_set():
        i += 1

        ready.wait(timeout=3.0)
        if not ready.is_set():
            print(f"[curl {i}] server not ready — giving up")
            break

        label = f"[curl {i}]"
        print(f"{label} GET http://127.0.0.1:{PORT}/")
        try:
            result = subprocess.run(
                ["curl", "-s", f"http://127.0.0.1:{PORT}/"],
                capture_output=True, text=True,
                timeout=5,
            )
            print(f"{label} response: {result.stdout.strip()!r}")
        except subprocess.TimeoutExpired:
            print(f"{label} timeout")

    stop.set()
    print("\n[client] done")


def main():
    ready = threading.Event()
    stop  = threading.Event()

    srv = threading.Thread(target=server, args=(ready, stop), daemon=True)
    srv.start()

    client(ready, stop)

    srv.join(timeout=3.0)
    print("[main] exit")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[main] interrupted")
