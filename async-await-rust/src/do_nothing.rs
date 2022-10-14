use std::{future::Future, task::Poll};

#[allow(dead_code)]
struct DoNothing;

impl Future for DoNothing {
    type Output = ();

    /// 立即返回成功
    fn poll(self: std::pin::Pin<&mut Self>, _cx: &mut std::task::Context<'_>) -> std::task::Poll<Self::Output> {
        Poll::Ready(())
    }
}
