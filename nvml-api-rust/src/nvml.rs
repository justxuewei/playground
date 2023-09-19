use std::ffi::OsStr;

use anyhow::{Context, Result};
use nvml_wrapper::Nvml;
use serde::{Deserialize, Serialize};

const NVML_LIB: &str = "/run/kata-containers/shared/containers/passthrough/sandbox-mounts/nvidia-driver/tesla/470.57.02/libnvidia-ml.so.1";

#[derive(Serialize, Deserialize)]
pub struct GpuMetrics {
    util: u32,
    mem_util: u32,
}

pub fn init_nvml() -> Result<Nvml> {
    let mut nvml_builder = Nvml::builder();
    nvml_builder.lib_path(OsStr::new(NVML_LIB));
    nvml_builder.init().context("nvml init")
}

pub fn gpu_metrics(nvml: &Nvml, index: u32) -> Result<GpuMetrics> {
    let device = nvml.device_by_index(index).context("get gpu device")?;

    let util = device.utilization_rates().context("get utilization")?;

    Ok(GpuMetrics {
        util: util.gpu,
        mem_util: util.memory,
    })
}
