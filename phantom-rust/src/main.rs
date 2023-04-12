// 这段代码必须运行在 nightly 版本下
#![feature(dropck_eyepatch)]
#![allow(dead_code)]
#![allow(unused)]

// use phantom1::Foo1;
use phantom2::Foo2;
use phantom3::{Bar3, Foo3};
use phantom4::{Bar4, Foo4};

mod phantom1;
// using #[may_dangle]
mod phantom2;
mod phantom3;
mod phantom4;

fn main() {
    // --> phantom1
    // let _a;
    // let _s = "hello_world".to_owned();
    // 无法通过编译，报错：`_s` does not live long enough
    // 因为编译器无法确认 &_s 的生命周期严格的长于 _a
    // 这里必须要求严格长于，主要是因为无法确认 drop 的先后顺序，假设先 drop 的
    // _s，然后在 drop _a 的时候调用了 &s，那就会导致野指针。
    // _a = Foo1::new(&_s);

    // --> phantom2(1)
    // 这种情况下先销毁 _a，再销毁 _s，所以此时 Foo2::drop() 是可以返回正确结果
    // 的：
    // ********* OUTPUT *********
    // "hello_world"
    // "hello_world"
    // Foo2 dropped
    // **************************
    // let _s = "hello_world".to_owned();
    // let _a;
    // _a = Foo2::new(&_s);

    // --> phantom2(2)
    // 这种情况下先销毁 _s，再销毁 _a，所以此时 Foo2::drop() 会输出一堆乱码或者
    // 直接 panic：
    // ********* OUTPUT *********
    // "hello_world"
    // thread 'main' panicked at 'byte index 16 is out of bounds of `�'Y�Ϝ`', library/core/src/fmt/mod.rs:2450:30
    // "�'Y\u{5}\0\0\0
    // **************************
    // let _a;
    // let _s = "hello_world".to_owned();
    // _a = Foo2::new(&_s);

    // --> phantom3
    // 销毁顺序: _s -> _a，因为 _b 已经移到 _a 里了。
    // _s 过早地被 drop 了，所以导致了野指针的出现。
    // ********* OUTPUT *********
    // Foo3 is going to be dropped
    // Bad3("\u{e}t_^\u{5}\0\0\0")
    // Bad3 is going to be dropped
    // "\u{e}t_^\u{5}\0\0\0"
    // Bad3 dropped
    // Foo3 dropped
    // **************************
    // let _a;
    // let _s = "evil dog".to_owned();
    // let _b = Bar3(&_s);
    // _a = Foo3::new(_b);

    // --> phantom4
    // 无法编译，因为要求 Bad4 的生命周期应该严格长于 Foo4
    let _a;
    let _s = "evil dog".to_owned();
    let _b = Bar4(&_s);
    // _b move to _a, _b 的生命周期比 _a 小
    _a = Foo4::new(_b);
}
