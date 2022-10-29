use std::collections::BinaryHeap;

/// Vec drain
pub fn test_case_1() {
    let mut test_vec = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    // test_vec = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    println!("test_vec = {:?}", test_vec);
    test_vec.drain(2..4);
    // test_vec.drain(2..4) = [1, 2, 5, 6, 7, 8, 9, 10]
    println!("test_vec.drain(2..4) = {:?}", test_vec);
}

/// BinaryHeap drain
pub fn test_case_2() {
    let mut heap = BinaryHeap::<usize>::new();
    heap.push(1);
    heap.push(2);
    heap.push(3);
    heap.push(4);
    heap.push(5);
    // heap = [5, 4, 2, 1, 3]
    println!("heap = {:?}", heap);
    // 5
    // 4
    // 2
    // 1
    // 3
    for i in heap.drain() {
        println!("{}", i);
    }
    // heap = []
    println!("heap = {:?}", heap);
}
