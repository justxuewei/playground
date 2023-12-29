use std::process::Command;

use scan_fmt::scan_fmt;

fn main() {
    let mut cmd = Command::new("cat");
    cmd.arg("/sys/fs/cgroup/memory/memory.usage_in_bytes");
    let output = cmd.output().unwrap();
    println!("{}", String::from_utf8_lossy(&output.stdout));

    let mut cmd = Command::new("cat");
    cmd.arg("/proc/meminfo");
    let output = cmd.output().unwrap();
    let cmd_str = String::from_utf8_lossy(&output.stdout);
    let meminfo_arr = cmd_str.split("\n").nth(1).unwrap();

    let mem_free = scan_fmt!(meminfo_arr, "MemFree:\t{d} kB", u32).unwrap();

    println!("{}: {}", meminfo_arr, mem_free);
}
