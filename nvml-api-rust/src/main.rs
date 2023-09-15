mod nvml;

fn main() {
    println!("Nvml wrapper example app.");
    let gpu_metrics = nvml::gpu_metrics(0).unwrap();
    println!("{:?}", serde_json::to_string(&gpu_metrics).unwrap());
}
