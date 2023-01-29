use std::{io::Result, path::Path};

use prost_build::Config;

pub fn generate<P>(out_dir: P, protos: &[P], includes: &[P]) -> Result<()>
where
    P: AsRef<Path>,
{
    let mut config = Config::new();
    config.out_dir(out_dir.as_ref());
    config.compile_protos(protos, includes)
}
