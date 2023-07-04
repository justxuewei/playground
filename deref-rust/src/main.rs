use std::ops::Deref;

// 参考：https://course.rs/advance/smart-pointer/deref.html
// 1. 当 T: Deref<Target=U>，可以将 &T 转换成 &U；
// 2. 当 T: DerefMut<Target=U>，可以将 &mut T 转换成 &mut U；
// 3. 当 T: Deref<Target=U>，可以将 &mut T 转换成 &U

struct MyBox<T>(T);

impl<T> MyBox<T> {
    fn new(x: T) -> MyBox<T> {
        MyBox(x)
    }
}

// `MyBox  可以自动被解引用为 `&T`，更具体一点：给定一个
// `a: MyBox<usize>`，直接使用 a 其对应的类型是 `MyBox<usize>`, 使用 *a 则
// 会被 rust 首先自动引用为 `&usize`（即 Target 类型的引用），然后再解引用
// 为 `usize`（即 `*&usize`）。
// 进一步深究一下，rust 实际上帮我们做了 `*(a.deref())`。
impl<T> Deref for MyBox<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

fn main() {
    let a = MyBox::new(5usize);
    assert_eq!(5, *a);
}
