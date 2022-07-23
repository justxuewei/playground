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

pub fn test_case_1() {
    println!("===== fn_immut_examples::test_case_1 starts =====");
    let e = E { a: "hello".to_string() };
    let f = || {
        println!("fn immut closure called: {:?}", e);
    };
    fn_immut(f);
    println!("===== fn_immut_examples::test_case_1 ended =====");
}
