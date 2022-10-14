use std::{future::Future, task::Poll, time::Duration};

use async_std::task::sleep;

#[allow(dead_code)]
struct SleepPrint<Fut> {
    sleep: Fut,
}

fn sleep_us() -> impl Future<Output = ()> {
    SleepPrint {
        sleep: sleep(Duration::from_millis(3000)),
    }
}

impl<Fut: Future<Output = ()>> Future for SleepPrint<Fut> {
    type Output = ();

    fn poll(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Self::Output> {
        let sleep = unsafe { self.map_unchecked_mut(|s| &mut s.sleep) };
        match sleep.poll(cx) {
            Poll::Pending => Poll::Pending,
            Poll::Ready(ret) => {
                println!("Inside SleepPrint");
                Poll::Ready(ret)
            }
        }
    }
}
