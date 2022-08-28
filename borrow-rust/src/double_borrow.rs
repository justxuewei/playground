pub fn run() {
    let mut int = 0;
    let mut_int = &mut int;
    *mut_int += 1;
    println!("mut_int: {}", mut_int);
    let immut_mut_int = &mut_int;
    // err 0:
    // cannot assign to `**immut_mut_int`, which is behind a `&` reference
    // **immut_mut_int += 1;

    // err 1:
    // cannot move out of `*immut_mut_int` which is behind a shared reference
    // move occurs because `*immut_mut_int` has type `&mut i32`, which does not
    // implement the `Copy` trait 
    // let deref_immut_mut_int = *immut_mut_int;

    // err 2:
    // cannot borrow `mut_int` as mutable, as it is not declared as mutable
    // cannot borrow as mutable
    // let mut_mut_int = &mut mut_int;

    // err 2 的解法，把 mut_int 变成一个可变变量。
    let mut mut_int = &mut int;
    let mut_mut_int = &mut mut_int;
    **mut_mut_int += 1;
    println!("mut_mut_int: {}", mut_mut_int);
}