mod proto;

use proto::GreetingRequest;

fn main() {
    let greeting_req = GreetingRequest {
        name: String::from("Xavier"),
    };
    let greeting_req_json = serde_json::to_string(&greeting_req).unwrap();
    println!("greeting_req_json: {}", greeting_req_json);
    let greeting_req_1: GreetingRequest = serde_json::from_str(&greeting_req_json).unwrap();
    println!("greeting_req_1: {:?}", greeting_req_1);
}
