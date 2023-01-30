use prost_rust;

#[allow(unused_macros)]
macro_rules! warn {
    ($($tokens: tt)*) => {
        println!("cargo:warning={}", format!($($tokens)*))
    }
}

fn main() {
    prost_rust::generate("./src/proto", &["./proto/example.proto"], &["./proto"]).unwrap();
}
