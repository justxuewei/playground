use std::fmt::Debug;

pub struct Foo3<T: Debug> {
    name: *mut T
}

impl<T: Debug> Foo3<T> {
    pub fn new(init: T) -> Self {
        Self {
            name: Box::into_raw(Box::new(init))
        }
    }
}

unsafe impl<#[may_dangle] T: Debug> Drop for Foo3<T> {
    fn drop(&mut self) {
        // *self.name
        println!("Foo3 is going to be dropped");
        println!("{:?}", unsafe { Box::from_raw(self.name) });
        println!("Foo3 dropped");
    }
}

#[derive(Debug)]
pub struct Bad3<T: Debug>(pub T);

impl<T: Debug> Drop for Bad3<T> {
    fn drop(&mut self) {
        println!("Bad3 is going to be dropped");
        println!("{:?}", self.0);
        println!("Bad3 dropped");
    }
}
