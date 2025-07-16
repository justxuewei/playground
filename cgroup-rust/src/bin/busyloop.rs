use std::hint::spin_loop;
use std::sync::mpsc;
use std::thread;

use libc::SIGTERM;
use signal_hook::iterator::Signals;

/// A simple busy loop that spawns 5 threads (main thread + 4 busyloop
/// threads). The output would be "{main tid},{tid1},{tid2},{tid3},{tid4}".
fn main() {
    let mut handles = Vec::new();
    let mut output = vec![];

    let (tx, rx) = mpsc::channel();

    for _ in 0..4 {
        let tx = tx.clone();
        let handle = thread::spawn(move || {
            let tid = unsafe { libc::syscall(libc::SYS_gettid) };
            tx.send(tid).unwrap();
            loop {
                spin_loop();
            }
        });
        handles.push(handle);
    }

    let pid = unsafe { libc::getpid() };
    output.push(pid.to_string());

    for _ in 0..4 {
        let tid = rx.recv().unwrap().to_string();
        output.push(tid);
    }

    println!("{}", output.join(","));

    let mut signals = Signals::new(&[SIGTERM]).unwrap();
    let _signal_handle = thread::spawn(move || {
        for sig in signals.forever() {
            println!("Received signal {}, ignoring...", sig);
        }
    });

    for handle in handles {
        handle.join().unwrap();
    }
}
