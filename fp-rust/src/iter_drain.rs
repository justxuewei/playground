pub fn test_case_1() {
    let mut test_vec = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    println!("test_vec = {:?}", test_vec);
    test_vec.drain(2..4);
    println!("test_vec.drain(2..4) = {:?}", test_vec);
}
