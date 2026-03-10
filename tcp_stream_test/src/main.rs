use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::os::fd::AsRawFd;
use std::os::unix::io::FromRawFd;
use std::time::Duration;
use std::{fs, thread};

fn get_fd_ref_count(stream: &TcpStream) -> Option<u32> {
    let fd = stream.as_raw_fd();
    // /proc/self/fdinfo/<fd> contains info about the fd
    // but ref count is in /proc/self/fd/<fd> -> symlink count is NOT the ref count

    // The real socket ref count is in /proc/net/tcp or via kcmp syscall
    // Simplest: read /proc/self/fdinfo/<fd>
    let path = format!("/proc/self/fdinfo/{}", fd);

    // fdinfo doesn't directly expose ref count
    // Use /proc/self/fd/<fd> link count via stat
    let path = format!("/proc/self/fd/{}", fd);
    let meta = fs::metadata(&path).ok()?;

    // nlink on the socket inode = ref count (number of fds pointing to it)
    use std::os::unix::fs::MetadataExt;
    Some(meta.nlink() as u32)
}

fn run_server() {
    let listener = TcpListener::bind("127.0.0.1:8080").expect("Failed to bind");
    println!("[Server] Listening on 127.0.0.1:8080");

    // accept only one connection for this demo
    if let Ok((mut stream, addr)) = listener.accept() {
        println!("[Server] Accepted connection from {}", addr);

        let mut buf = [0u8; 1024];
        match stream.read(&mut buf) {
            Ok(0) => println!("[Server] Client disconnected"),
            Ok(n) => {
                let msg = String::from_utf8_lossy(&buf[..n]);
                println!("[Server] Received ({} bytes): {}", n, msg);

                // echo back
                stream.write_all(&buf[..n]).expect("[Server] Write failed");
                println!("[Server] Echoed back {} bytes", n);
            }
            Err(e) => eprintln!("[Server] Read error: {}", e),
        }
    }
}

fn run_client() {
    // -------------------------------------------------------
    // Step 1: Connect using libc::connect
    // -------------------------------------------------------
    let raw_fd = unsafe {
        // create a TCP socket
        let fd = libc::socket(libc::AF_INET, libc::SOCK_STREAM, 0);
        if fd < 0 {
            panic!(
                "[Client] socket() failed: {}",
                std::io::Error::last_os_error()
            );
        }
        println!("[Client] Created socket fd = {}", fd);

        // build sockaddr_in for 127.0.0.1:8080
        let addr = libc::sockaddr_in {
            sin_family: libc::AF_INET as libc::sa_family_t,
            sin_port: 8080u16.to_be(),
            sin_addr: libc::in_addr {
                s_addr: u32::from_be_bytes([127, 0, 0, 1]).to_be(),
            },
            sin_zero: [0; 8],
        };

        let ret = libc::connect(
            fd,
            &addr as *const libc::sockaddr_in as *const libc::sockaddr,
            std::mem::size_of::<libc::sockaddr_in>() as libc::socklen_t,
        );
        if ret < 0 {
            libc::close(fd);
            panic!(
                "[Client] connect() failed: {}",
                std::io::Error::last_os_error()
            );
        }
        println!("[Client] Connected via libc, fd = {}", fd);

        fd
    };

    // -------------------------------------------------------
    // Step 2: Create TcpStream from raw fd
    // -------------------------------------------------------
    // SAFETY: raw_fd is a valid connected socket we own
    let original_stream = unsafe { TcpStream::from_raw_fd(raw_fd) };
    let rcount = get_fd_ref_count(&original_stream);
    println!(
        "[Client] Created TcpStream from raw fd {}, rcount: {:?}",
        raw_fd, rcount
    );

    // -------------------------------------------------------
    // Step 3: Clone the TcpStream
    // -------------------------------------------------------
    let mut cloned_stream = original_stream
        .try_clone()
        .expect("[Client] Failed to clone TcpStream");
    let rcount = get_fd_ref_count(&original_stream);
    let rcount2 = get_fd_ref_count(&cloned_stream);
    println!(
        "[Client] Cloned TcpStream successfully, rcount: {:?}, rcount2: {:?}, fd: {}, new fd: {}",
        rcount,
        rcount2,
        original_stream.as_raw_fd(),
        cloned_stream.as_raw_fd(),
    );

    // -------------------------------------------------------
    // Step 4: Close (drop) the original TcpStream
    // -------------------------------------------------------
    // Dropping original_stream closes its fd, but since try_clone()
    // calls dup() internally, cloned_stream still holds a valid fd.
    drop(original_stream);
    let rcount = get_fd_ref_count(&cloned_stream);
    println!(
        "[Client] Dropped original TcpStream (old fd closed), rcount: {:?}",
        rcount
    );

    // -------------------------------------------------------
    // Step 5: Send data via cloned stream
    // -------------------------------------------------------
    let message = b"Hello from client via cloned stream!";
    cloned_stream
        .write_all(message)
        .expect("[Client] Write failed");
    println!(
        "[Client] Sent ({} bytes): {}",
        message.len(),
        String::from_utf8_lossy(message)
    );

    // -------------------------------------------------------
    // Step 6: Receive echoed data from server
    // -------------------------------------------------------
    let mut buf = [0u8; 1024];
    match cloned_stream.read(&mut buf) {
        Ok(0) => println!("[Client] Server disconnected"),
        Ok(n) => {
            let msg = String::from_utf8_lossy(&buf[..n]);
            println!("[Client] Received echo ({} bytes): {}", n, msg);
        }
        Err(e) => eprintln!("[Client] Read error: {}", e),
    }
}

fn main() {
    // start server in background thread
    let server_handle = thread::spawn(|| {
        run_server();
    });

    // give server time to start listening
    thread::sleep(Duration::from_millis(200));

    // run client in main thread
    run_client();

    // wait for server to finish
    server_handle.join().expect("Server thread panicked");

    println!("\n[Main] Done.");
}
