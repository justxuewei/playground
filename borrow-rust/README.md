# Borrow

1. 如果想要使用 &mut var，那么 var 必须有 mut 符号，即 `let mut var = 1`。
2. `let var_ref = &mut var` 和 `let mut var_ref = &mut var` 都是可以修改 var 的
   值的，后者可以改变引用，比如 var_ref 可以被改变为其他的引用。
3. 可以使用 double borrow，比如 `let immut_mut_int = &mut_int`（immut_mut_int 的
   类型是 `&&mut usize`），但是没办法修改 int 的值，因为最外层是一个不可变引用。
4. 这种 double borrow 的情况可以把它拆分成两次借用，比如 err2 这种情
   况，`mut_int` 是一个不可变的 &mut 类型，所以我们就不能生成一个对 `mut_int` 的
   可变借用。
