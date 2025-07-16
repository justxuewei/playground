# Cgroup Rust

Add busyloop and cgroup-rust to environment variables.

```shell
$ export BUSYLOOP="$(pwd)/target/debug/busyloop"
$ export CGROUPRUST="$(pwd)/target/debug/cgroup-rust"
```

Start a busyloop process. The first one is tgid (also pid of main thread),
the rest are pids of spawned threads which do busy looping.

```shell
$ $BUSYLOOP
4104292,4104293,4104295,4104294,4104296
```

Manipulate cgroups through systemd.

```shell
# Show states: slice, unit and path in cgroupfs.
$ sudo $CGROUPRUST --manager systemd \
    --path cgroupsrs-test.slice:cri:pod \
    --op states
# Create a cgroup and add the busyloop process to the cgroup.
$ sudo $CGROUPRUST --manager systemd \
    --path cgroupsrs-test.slice:cri:pod \
    --op add \
    --pid 4104293
# Set cpuset.cpus for the cgroup.
$ sudo $CGROUPRUST --manager systemd \
    --path cgroupsrs-test.slice:cri:pod \
    --op set \
    --cpuset-cpus 0-4
# Show cgroup stats, e.g. memory in use
$ sudo $CGROUPRUST --manager systemd \
    --path cgroupsrs-test.slice:cri:pod \
    --op stats
# Destroy the cgroup.
$ sudo $CGROUPRUST --manager systemd \
    --path cgroupsrs-test.slice:cri:pod \
    --op destroy
```