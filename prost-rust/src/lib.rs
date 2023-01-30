use std::{io::Result, path::Path};

use prost_build::Config;

mod prost_svcgen;

pub fn generate<P>(out_dir: P, protos: &[P], includes: &[P]) -> Result<()>
where
    P: AsRef<Path>,
{
    Config::new()
        .out_dir(out_dir.as_ref())
        .message_attribute(".", "#[derive(::serde::Serialize, ::serde::Deserialize)]")
        .compile_protos(protos, includes)
        .unwrap();

    Ok(())
}
