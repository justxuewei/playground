use crate::data_structure::E;

fn fn_mut<F>(mut func: F) where F: FnMut() {
    println!("fn_mut begins");
    func();
    println!("fn_mut ended");
}

#[allow(unused)]
fn fn_mut_twice<F>(mut func: F) where F: FnMut() {
    println!("fn_mut_twice begins");
    func();
    // 这里 func 可以运行多次（与 fn_once 不同）
    func();
    println!("fn_mut_twice ended");
}

pub fn test_case_1() {
    println!("===== fn_mut_examples::test_case_1 starts =====");
    let mut e = E { a: "hello".to_string() };
    let f = || {
        println!("fn mut closure called, before changing value: {:?}", e);
        e.a = "hello world".to_string();
        println!("fn mut closure called, after changed value: {:?}", e);
    };
    fn_mut(f);
    println!("===== fn_mut_examples::test_case_1 ended =====");
}
