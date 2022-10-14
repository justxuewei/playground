use std::time::Duration;

use async_std::task::{sleep, spawn};

mod do_nothing;
mod sleep_print;

async fn sleep_us() {
    for i in 1..=10 {
        println!("Sleepus {}", i);
        sleep(Duration::from_millis(500)).await;
    }
}

async fn interrupt_us() {
    for i in 1..=5 {
        println!("Interrupts: {}", i);
        sleep(Duration::from_millis(1000)).await;
    }
}

#[async_std::main]
async fn main() {
    // 使用 spawn 创建线程
    let sleep_us = spawn(sleep_us());
    interrupt_us().await;

    sleep_us.await;
}
