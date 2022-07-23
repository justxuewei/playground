#[derive(Debug)]
pub struct E {
    pub a: String,
}

impl Drop for E {
    fn drop(&mut self) {
        println!("destroyed struct E");
    }
}
