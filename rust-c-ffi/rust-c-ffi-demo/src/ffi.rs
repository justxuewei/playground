use crate::my_app;

#[no_mangle]
/// Expose this function via C-FFI.
/// 1. `pub` keyword isn't required.
/// 2. `#[no_mangle]` is required. Otherwise, this function can't be found
///    by its function symbol.
fn do_sum(arg1: u8, arg2: u16, arg3: u32) -> usize {
    my_app::do_sum(arg1, arg2, arg3)
}
