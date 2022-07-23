use crate::data_structure::E;

fn fn_once<F>(func: F) where F: FnOnce() {
    println!("fn_once begins");
    func();
    println!("fn_once ended");
}

// 这个函数是没办法过编译器的，因为 func() 在第一次被调用的时候就已经被销毁了
// fn fn_once_twice<F>(func: F) where F: FnOnce() {
//     println!("fn_once begins");
//     func();
//     func();
//     println!("fn_once ends");
// }

pub fn test_case_1() {
    println!("===== fn_once_examples::test_case_1 starts =====");
    let e = E { a: "hello".to_string() };
    let f = || {
        println!("fn once closure called: {:?}", e);
    };
    fn_once(f);
    println!("===== fn_once_examples::test_case_1 ended =====");
}

/**
 * 结果如下，可以看到在使用 move 之后 E 的所有权被移动到 fn_once 中了，
 * 所以在 fn_once 退出之后 E 就被销毁了。
 * 
 * ===== fn_once_examples::test_case_1 starts =====
 * fn_once begins
 * fn once closure called: E { a: "hello" }
 * fn_once ended
 * ===== fn_once_examples::test_case_1 ended =====
 * destroyed struct E
 * 
 * ===== fn_once_examples::test_case_2 starts =====
 * fn_once begins
 * fn once closure called: E { a: "hello" }
 * destroyed struct E
 * fn_once ended
 * ===== fn_once_examples::test_case_2 ended =====
 */
pub fn test_case_2() {
    println!("===== fn_once_examples::test_case_2 starts =====");
    let e = E { a: "hello".to_string() };
    // 这里添加了一个 move，观察数据结果
    let f = move || {
        println!("fn once closure called: {:?}", e);
    };
    fn_once(f);
    println!("===== fn_once_examples::test_case_2 ended =====");
}
