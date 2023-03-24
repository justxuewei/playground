// https://rustwiki.org/zh-CN/rust-by-example/std_misc/channels.html

use std::{sync::mpsc::{channel, Receiver, Sender}, thread};

const NTHREADS: i32 = 3;

fn main() {
    let (tx, rx): (Sender<i32>, Receiver<i32>) = channel();
    
    for id in 0..NTHREADS {
        let thread_tx = tx.clone();
        thread::spawn(move || {
            thread_tx.send(id).unwrap();
            println!("Provider sent a message: {}.", id);
        });
    }

    for _ in 0..NTHREADS {
        println!("Consumer received a message: {:?}.", rx.recv());
    }
}
