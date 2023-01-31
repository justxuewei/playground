use proc_macro2::TokenStream;
use prost_build::{ServiceGenerator, Service, Method};
use quote::{quote, format_ident};

pub struct ProstServiceGenerator;

impl ProstServiceGenerator {
    pub fn new() -> Self {
        Self {}
    }
}

impl ServiceGenerator for ProstServiceGenerator {
    fn finalize(&mut self, _buf: &mut String) {
    }

    fn finalize_package(&mut self, _package: &str, _buf: &mut String) {
    }

    fn generate(&mut self, service: prost_build::Service, buf: &mut String) {
        generate_methods(&service, buf)
    }
}

fn generate_methods(service: &Service, buf: &mut String) {
    buf.push('\n');
    service.comments.append_with_indent(0, buf);
    buf.push_str(&format!("pub trait {}: Send + Sync + 'static {{", service.name));

    for method in service.methods.iter() {
        // generate_method(&service.name, &service_path, method, buf);
        buf.push('\n');
        method.comments.append_with_indent(1, buf);
        buf.push_str(&format!("    {};\n", method_sig_tokens(method)));
    }
    buf.push_str("}\n");
}

fn method_sig_tokens(method: &Method) -> TokenStream {
    let name = format_ident!("{}", method.name);
    let input_type = format_ident!("{}", method.input_type);
    let output_type = format_ident!("{}", method.output_type);
    quote! {
        fn #name(&self, request: #input_type) -> #output_type
    }
}
