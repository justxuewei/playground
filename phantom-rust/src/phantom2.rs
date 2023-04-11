use std::fmt::Debug;

pub struct Foo2<T: Debug> {
    name: *mut T
}

impl<T: Debug> Foo2<T> {
    pub fn new(init: T) -> Self {
        println!("{:?}", init);
        Self {
            name: Box::into_raw(Box::new(init))
        }
    }
}

// #[may_dangle] 是我向编译器保证：我肯定不会在 T dropped 的时候调用 self.name
// - phantom2(1) 可以正确返回结果
// - phantom2(2) 无法正确返回结果
unsafe impl<#[may_dangle] T: Debug> Drop for Foo2<T> {
    fn drop(&mut self) {
        // *self.name
        println!("{:?}", unsafe { Box::from_raw(self.name) });
        println!("Foo2 dropped");
    }
}