use proc_macro_rust::Builder;

#[allow(dead_code)]
#[derive(Builder)]
pub struct Command {
    executable: String,
    args: Vec<String>,
    current_dir: String,
}

fn main() {
    let command = Command::builder()
        .executable("cargo".to_owned())
        .args(vec!["build".to_owned(), "--release".to_owned()])
        .current_dir("..".to_owned())
        .build()
        .unwrap();

    assert_eq!(command.executable, "cargo");
    assert_eq!(command.args, &["build", "--release"]);
    assert_eq!(command.current_dir, "..");
}
