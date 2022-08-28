use std::{sync::{Arc, Mutex, mpsc::channel}, thread, time};

// ref: https://doc.rust-lang.org/std/sync/struct.Mutex.html
pub fn run(n: usize) {
    let data = Arc::new(Mutex::new(0));
    let (tx, rx) = channel();
    for _ in 0..n {
        let (data, tx) = (data.clone(), tx.clone());
        thread::spawn(move || {
            match data.lock() {
                Ok(mut data) => {
                    *data += 1;
                    println!("{}", *data);
                    if *data == n {
                        tx.send(()).unwrap();
                    }
                    thread::sleep(time::Duration::from_millis(5000));
                }
                Err(_) => println!("panic!"),
            }
        });
    }
    rx.recv().unwrap();
}