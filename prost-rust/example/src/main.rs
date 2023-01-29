use prost_rust;

fn main() {
    prost_rust::generate("./src/proto", &["./proto/example.proto"], &["./proto"]).unwrap();
}
