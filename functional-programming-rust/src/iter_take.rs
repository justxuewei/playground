pub fn test_case_1() {
    let v = vec![1, 2, 3, 4, 5];
    println!("===== iter_take::test_case_1: started =====");
    println!("we have a vector: {:?}", v);
    println!("the result of taking 3: ");
    for value in v.iter().take(3) {
        println!("{}", value);
    }
    println!("the result of taking 4: ");
    for value in v.iter().take(4) {
        println!("{}", value);
    }
}
