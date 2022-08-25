use crate::data_structure::E;

fn fn_immut<F>(func: F) where F: Fn() {
    println!("fn_immut begins");
    func();
    println!("fn_immut ended");
}

#[allow(unused)]
fn fn_immut_twice<F>(func: F) where F: Fn() {
    println!("fn_immut begins");
    func();
    func();
    println!("fn_immut ended");
}

#[allow(unused)]
fn fn_immut_twice_and_mut_e<F>(func: F, e: &mut E) where F: Fn() {
    println!("fn_immut begins");
    func();
    e.a = "changed".to_string();
    func();
    println!("fn_immut ended");
}

#[allow(unused)]
fn fn_immut_twice_and_immut_e<F>(func: F, e: &E) where F: Fn() {
    println!("fn_immut begins");
    func();
    println!("fn_immut: e = {:?}", e);
    func();
    println!("fn_immut ended");
}

pub fn test_case_1() {
    println!("===== fn_immut_examples::test_case_1 starts =====");
    let e = E { a: "hello".to_string() };
    let f = || {
        println!("fn immut closure called: {:?}", e);
    };
    fn_immut(f);
    println!("===== fn_immut_examples::test_case_1 ended =====");
}

// 这个编译是不通过的，详见 readme 的 Q4
// pub fn test_case_2() {
//     println!("===== fn_immut_examples::test_case_2 starts =====");
//     let mut e = E { a: "hello".to_string() };
//     let f = || {
//         println!("fn immut closure called: {:?}", e);
//     };
//     fn_immut_twice_and_mut_e(f, &mut e);
//     println!("===== fn_immut_examples::test_case_2 ended =====");
// }

pub fn test_case_4() {
    println!("===== fn_immut_examples::test_case_4 starts =====");
    let e = E { a: "hello".to_string() };
    let f = || {
        println!("fn immut closure called: {:?}", e);
    };
    fn_immut_twice_and_immut_e(f, &e);
    println!("===== fn_immut_examples::test_case_4 ended =====");
}

// 这也是不能编译过的，看来 Fn 是没法捕获 mut 变量的
// pub fn test_case_3() {
//     println!("===== fn_immut_examples::test_case_3 starts =====");
//     let mut e = E { a: "hello".to_string() };
//     let f = || {
//         println!("fn immut closure called: {:?}", e);
//     };
//     fn_immut(f);
//     println!("===== fn_immut_examples::test_case_3 ended =====");
// }
