use std::{ffi::CString, mem, slice};

use anyhow::{anyhow, Result};

type ServiceHandlerFn<A, R> = Box<dyn Fn(A) -> Result<R>>;

fn main() {
    let my_struct = MyStruct {
        my_int: 1234,
        my_bool: true,
    };
    let bytes = my_struct.serialize().unwrap();
    println!("serialize: {:?}", bytes);
    let new_my_struct = MyStruct::deserialize(bytes).unwrap();
    println!("deserialize: {:?}", new_my_struct);

    let bytes = [0xd2, 0x04, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00];
    call_service_handler(&bytes, Box::new(test1));
    call_service_handler(&bytes, Box::new(test2));

    let name = CString::new("xavier").unwrap();
    let ping_request = PingRequest {
        name: cstring_to_u8_128(name).unwrap(),
    };
    let ping_request_data = c_plain_struct_serialize(&ping_request).unwrap();
    println!(
        "ping_request: size: {}, data: {:?}",
        mem::size_of::<PingRequest>(),
        ping_request_data
    );
}

pub trait CStructSerializer {
    fn serialize(&self) -> Result<&[u8]>;
}

pub trait CStructDeserializer {
    fn deserialize(bytes: &[u8]) -> Result<Self>
    where
        Self: Sized;
}

fn c_plain_struct_serialize<'a, T>(p: &'a T) -> Result<&'a [u8]> {
    let bytes: &[u8] = unsafe {
        let p: *const T = p;
        let byte_p: *const u8 = p as *const u8;
        slice::from_raw_parts(byte_p, mem::size_of::<MyStruct>())
    };
    Ok(bytes)
}

fn c_plain_struct_deserialize<T>(bytes: &[u8]) -> Result<T>
where
    T: Clone,
{
    if bytes.len() != mem::size_of::<MyStruct>() {
        return Err(anyhow!("invalid bytes"));
    }
    let t: &T = unsafe { &*(bytes.as_ptr() as *const _) };
    Ok(t.clone())
}

fn cstring_to_u8_128(input: CString) -> Result<[u8; 128]> {
    let mut array = [0; 128];
    let bytes = input.into_bytes();
    if bytes.len() >= 128 {
        return Err(anyhow!("Too long"));
    }
    for (i, &byte) in bytes.iter().enumerate() {
        array[i] = byte;
    }
    array[bytes.len()] = b'\0'; // Add null terminator
    Ok(array)
}

#[repr(C)]
#[derive(Clone, Debug)]
struct MyStruct {
    my_int: u32,
    my_bool: bool,
}

#[repr(C)]
#[derive(Clone, Debug)]
struct PingRequest {
    name: [u8; 128],
}

impl CStructSerializer for MyStruct {
    fn serialize(&self) -> Result<&[u8]> {
        c_plain_struct_serialize(self)
    }
}

impl CStructDeserializer for MyStruct {
    fn deserialize(bytes: &[u8]) -> Result<Self> {
        c_plain_struct_deserialize(bytes)
    }
}

fn test1(ms: MyStruct) -> Result<MyStruct> {
    println!("test1: {:?}", ms);
    Ok(MyStruct {
        my_int: 1,
        my_bool: true,
    })
}

fn test2(ms: MyStruct) -> Result<MyStruct> {
    println!("test2: {:?}", ms);
    Ok(MyStruct {
        my_int: 2,
        my_bool: true,
    })
}

fn call_service_handler<A, R>(data: &[u8], service_fn: ServiceHandlerFn<A, R>)
where
    A: CStructDeserializer,
    R: CStructSerializer,
{
    println!("received request bytes: {:?}", data);
    let argument = A::deserialize(data).unwrap();
    let ret = service_fn(argument).unwrap();
    let ret_bytes = ret.serialize().unwrap();
    println!("sent response bytes: {:?}", ret_bytes);
}
