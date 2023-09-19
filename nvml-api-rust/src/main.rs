mod nvml;

fn main() {
    let nvml = nvml::init_nvml().unwrap();

    for _ in 0..1000000 {
        let gpu_metrics = nvml::gpu_metrics(&nvml, 0).unwrap();
        println!("{:?}", serde_json::to_string(&gpu_metrics).unwrap());
    }
}
