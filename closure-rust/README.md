# Closure

Q1: Fn、FnOnce、FnMut 的 self 到底是指的谁？

A1: 目前我的理解是 self 应该是指的 closure 本身，比如 FnOnce 就是使用的 self，所
以在调用结束的时候就会被释放，也就无法再被使用了。

Q2: closure 是如何捕获变量的？

我理解这里应该是 Fn 和 FnMut 的主要区别，Fn 是把变量以不可变的是形式捕获（不能捕
获 mut 变量，参见 `fn_examples::test_case_3`），FnMut 可捕获可变/不可变变量，
FnOnce 可捕获可变/不可变变量，还可以通过 move 把所有权移动到 closure 中。所以就
可以理解了为什么很多教程都在说 "Fn < FnMut < FnOnce"。

Q3: move 之后所有权会转移到 closure 中，如果不添加 move 呢？还会转移吗？如果不会
的话 FnOnce 又释放了什么呢？

不会转移，不加 move 默认是以引用的形势来的，可以自动捕获 mut & immut 变量。

Q4: 为什么会有 "immutable borrow later used by call" 这个错误？

```
error[E0502]: cannot borrow `e` as mutable because it is also borrowed as immutable
  --> src/fn_examples.rs:52:33
   |
49 |     let f = || {
   |             -- immutable borrow occurs here
50 |         println!("fn immut closure called: {:?}", e);
   |                                                   - first borrow occurs due to use of `e` in closure
51 |     };
52 |     fn_immut_twice_and_mut_e(f, &mut e);
   |     ------------------------    ^^^^^^ mutable borrow occurs here
   |     |
   |     immutable borrow later used by call

For more information about this error, try `rustc --explain E0502`.
error: could not compile `closure-rust` due to previous error
```

可以看下 `fn_examples::test_case_2` 这个例子，在 closure 中首先包含一个 immut e
的引用，但是在调用 `fn_immut_twice_and_mut_e()` 的时候创建了一个 mut e 的引用，
也就是说在 closure 中的 immut e 是不可用的状态，但是在
`fn_immut_twice_and_mut_e` 中又被调用了，所以才会有那个比较迷惑的错误提示。
