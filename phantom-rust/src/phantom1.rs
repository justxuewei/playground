pub struct Foo1<T> {
    name: *mut T
}

impl<T> Foo1<T> {
    pub fn new(init: T) -> Self {
        Self {
            name: Box::into_raw(Box::new(init))
        }
    }
}

impl<T> Drop for Foo1<T> {
    fn drop(&mut self) {
        unsafe { Box::from_raw(self.name); }
    }
}