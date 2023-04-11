use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum Test {
    #[serde(rename = "vhost-user")]
    VhostUser {
        #[allow(dead_code)]
        path: String,
    },
}

#[derive(Debug, Deserialize)]
struct Dev {
    test: Test
}

#[derive(Debug, Deserialize)]
struct Test1 {
    #[allow(dead_code)]
    name: Option<String>
}

fn main() {
    let json_str = r#"{"test": {"type": "vhost-user", "path": "/haha"}}"#;
    let dev: Dev = serde_json::from_str(json_str).unwrap();
    println!("{:?}", dev);

    let json_str = r#"{"name": "haha"}"#;
    let test1: Test1 = serde_json::from_str(json_str).unwrap();
    println!("{:?}", test1);
    let json_str = r#"{}"#;
    let test1: Test1 = serde_json::from_str(json_str).unwrap();
    println!("{:?}", test1);
}
