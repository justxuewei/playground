use cgroups::{systemd::utils::expand_slice, Manager, SystemdManager};
use clap::Parser;
use oci_spec::runtime::{LinuxCpuBuilder, LinuxResourcesBuilder};

#[derive(Parser, Debug)]
struct Args {
    /// Manager argument
    #[clap(long, short)]
    manager: String,
    #[clap(long, short)]
    op: String,
    #[clap(long, short)]
    path: String,
    #[clap(long)]
    pid: Option<u32>,
    #[clap(long)]
    cpuset_cpus: Option<String>,
}

fn main() {
    let args = Args::parse();

    if args.manager == "fs" {
        todo!()
    } else if args.manager == "systemd" {
        systemd(&args);
    } else {
        panic!("Unsupported cgroup manager: {}", args.manager);
    }
}

fn show_states(manager: &SystemdManager) {
    println!("slice: {}", manager.slice());
    println!("unit: {}", manager.unit());
    println!(
        "fs path: {}/{}",
        expand_slice(manager.slice()).unwrap(),
        manager.unit()
    );
}

fn systemd(args: &Args) {
    let mut manager = SystemdManager::new(&args.path).expect("Failed to create SystemdManager");
    match args.op.as_str() {
        // cgroup-rust --manager systemd --op create --path cgroupsrs-pod.slice:cri:pod
        // --pid 1234
        "add" => {
            let pid = args.pid.expect("PID is required for add operation");
            manager
                .add_proc((pid as u64).into())
                .expect("Failed to add process to cgroup");

            println!("add proc: ...ok");
        }
        "show" => {
            show_states(&manager);
        }
        "stats" => {
            let stats = manager.stats();
            println!("{:?}", stats);
        }
        "set" => {
            let mut builder = LinuxCpuBuilder::default();
            if let Some(cpus) = &args.cpuset_cpus {
                builder = builder.cpus(cpus);
            }
            let cpu = builder.build().unwrap();
            let resources = LinuxResourcesBuilder::default().cpu(cpu).build().unwrap();
            manager
                .set(&resources)
                .expect("Failed to set cgroup resources");
            println!("set resources: ...ok");
        }
        "destroy" => {
            manager.destroy().expect("Failed to destroy cgroup");
            println!("destroy: ...ok");
        }
        _ => {
            panic!("Unsupported operation: {}", args.op);
        }
    }
}
