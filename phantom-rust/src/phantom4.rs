use std::{fmt::Debug, marker::PhantomData};

pub struct Foo4<T: Debug> {
    // name 是一个指向堆的指针
    name: *mut T,
    // 告诉编译器 Foo4::drop() 一定会访问堆上的 T 这个类型的，也就是 T 的生命周
    // 期应该严格长于 Foo4
    // 如果 T 拥有自定义的drop函数，那么编译器仍然要T strictly outlive Foo。
    _mark: PhantomData<T>,
}

impl<T: Debug> Foo4<T> {
    pub fn new(init: T) -> Self {
        Self {
            name: Box::into_raw(Box::new(init)),
            _mark: PhantomData,
        }
    }
}

// 如果 T 没有自定义的 drop 函数，那么就不要求 T outlive Foo<T>。
unsafe impl<#[may_dangle] T: Debug> Drop for Foo4<T> {
    fn drop(&mut self) {
        println!("Foo4 is going to be dropped");
        // 新建了一个 Box<Bad4>
        println!("{:?}", unsafe { Box::from_raw(self.name) });
        // drop Box<Bad4> -> 调用 Bad4::drop() -> 可能已经把 self.name dropped，
        // 假设这里再访问一次 unsafe { Box::from_raw(self.name) } 就会出错，原因
        // 是 Bad4 已经无了
        println!("Foo4 dropped");
    }
}

#[derive(Debug)]
pub struct Bad4<T: Debug>(pub T);

// 如果把这段代码注释掉，则 phontam4 可以正常编译
// why？？？
impl<T: Debug> Drop for Bad4<T> {
    fn drop(&mut self) {
        println!("Bad4 is going to be dropped");
        println!("{:?}", self.0);
        println!("Bad4 dropped");
    }
}
