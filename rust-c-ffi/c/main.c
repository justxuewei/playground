#include <stdio.h>
#include <stdlib.h>
#include <dlfcn.h>
#include <stdint.h>

int main(int argc, char** argv) {
    // Declare a function pointer for `crate::ffi::do_sum()` function
    // exposed from Rust
    typedef size_t (*do_sum_t)(uint8_t, uint16_t, uint32_t);

    // Open shared library
    void *dlh = dlopen("../rust-c-ffi-demo/target/debug/librust_c_ffi_demo.so", RTLD_LAZY);
    if (dlh == NULL) {
        fprintf(stderr, "%s", dlerror()); 
        exit(1);
    }

    // Resolve function sysbol to use
    do_sum_t do_sum = dlsym(dlh, "do_sum");

    // Call the imported function
    printf("Result: %ld\n", do_sum(1, 2, 3));
}
