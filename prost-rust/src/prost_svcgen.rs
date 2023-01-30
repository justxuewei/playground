use prost_build::ServiceGenerator;

pub struct ProstServiceGenerator;

impl ProstServiceGenerator {}

impl ServiceGenerator for ProstServiceGenerator {
    fn finalize(&mut self, _buf: &mut String) {
        todo!()
    }

    fn finalize_package(&mut self, _package: &str, _buf: &mut String) {
        todo!()
    }

    fn generate(&mut self, _service: prost_build::Service, _buf: &mut String) {
        todo!()
    }
}
