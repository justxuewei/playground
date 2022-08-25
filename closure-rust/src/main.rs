mod data_structure;
mod fn_once_examples;
mod fn_mut_examples;
mod fn_examples;

// Ref: https://dengjianping.github.io/2019/03/05/%E8%B0%88%E4%B8%80%E8%B0%88Fn,-FnMut,-FnOnce%E7%9A%84%E5%8C%BA%E5%88%AB.html
fn main() {
    exec_fn_and_wrap(fn_once_examples::test_case_1);
    exec_fn_and_wrap(fn_once_examples::test_case_2);
    exec_fn_and_wrap(fn_once_examples::test_case_3);
    exec_fn_and_wrap(fn_mut_examples::test_case_1);
    exec_fn_and_wrap(fn_examples::test_case_1);
    exec_fn_and_wrap(fn_examples::test_case_4);
}

fn exec_fn_and_wrap<F>(f: F) where F: Fn() {
    f();
    println!();
}
