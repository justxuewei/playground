#!/usr/bin/env python3
"""
close_wait_test.py

Reproduces a kernel bug where the server cannot close its conn fd properly,
leaving the socket stuck (e.g. in CLOSE_WAIT).

Detection strategy:
  Each server iteration does a fresh bind() WITHOUT SO_REUSEADDR.
  If the previous conn fd was not fully released by the kernel, the port is
  still occupied and bind() fails with EADDRINUSE — confirming the bug.

Server loop (one connection per iteration):
  1. bind() to 0.0.0.0:8080  ← fails here if previous socket is stuck
  2. listen()
  3. accept()  →  close listen fd
  4. read HTTP request, send response
  5. drain until peer closes, then close conn fd
  6. randomly sleep before recreating the listener
  7. repeat

Client loop (independent):
  curl hits http://127.0.0.1:8080/ continuously; may get connection refused
  while the server listener is down between iterations.
"""

import errno
import random
import socket
import subprocess
import threading
import time

HOST = "0.0.0.0"
PORT = 8080

RESPONSE = (
    b"HTTP/1.1 200 OK\r\n"
    b"Content-Type: text/plain\r\n"
    b"Content-Length: 12\r\n"
    b"Connection: close\r\n"
    b"\r\n"
    b"hello world\n"
)


def server(stop: threading.Event):
    iteration = 0

    while not stop.is_set():
        iteration += 1

        lsock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        # No SO_REUSEADDR — a stuck socket from the previous iteration causes
        # bind() to return EADDRINUSE, exposing the kernel bug.
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
        lsock.settimeout(1.0)
        print(f"[server iter {iteration}] listening on {HOST}:{PORT}")

        try:
            conn, peer = lsock.accept()
        except socket.timeout:
            lsock.close()
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
        print(f"[server iter {iteration}] conn fd closed")

        # Random downtime before recreating the listener — during this window
        # the client will get connection refused.
        downtime = random.uniform(0.0, 0.5)
        print(f"[server iter {iteration}] listener down for {downtime:.2f}s\n")
        time.sleep(downtime)


def client(stop: threading.Event):
    i = 0
    while not stop.is_set():
        i += 1
        try:
            result = subprocess.run(
                ["curl", "-s", "--max-time", "2", f"http://127.0.0.1:{PORT}/"],
                capture_output=True, text=True,
                timeout=3,
            )
            if result.returncode == 0:
                print(f"[curl {i}] ok: {result.stdout.strip()!r}")
            else:
                # exit code 7 = connection refused, 28 = timeout
                print(f"[curl {i}] refused/error (curl exit {result.returncode})")
        except subprocess.TimeoutExpired:
            print(f"[curl {i}] timeout")

        time.sleep(random.uniform(0.05, 0.2))

    print("[client] done")


def main():
    stop = threading.Event()

    srv = threading.Thread(target=server, args=(stop,), daemon=True)
    cli = threading.Thread(target=client, args=(stop,), daemon=True)

    srv.start()
    cli.start()

    srv.join()
    cli.join(timeout=1.0)
    print("[main] exit")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[main] interrupted")
