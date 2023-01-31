use proc_macro::TokenStream;
use proc_macro2::TokenStream as TokenStream2;
use quote::quote;
use syn::{parse_macro_input, Data, DeriveInput, Fields, Ident, Type};

#[proc_macro_derive(Builder)]
pub fn derive_builder(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    // 处理类名 {}Builder
    let ident = input.ident;
    let ident_builder = Ident::new(&format!("{}Builder", ident), ident.span());

    // 处理字段
    if let Data::Struct(r#struct) = input.data {
        let fields = r#struct.fields;
        // 判断字段是否具名的
        if matches!(&fields, Fields::Named(_)) {
            let builder_fields = map_fields(&fields, |(ident, ty)| quote!(#ident: Option<#ty>, ));
            let builder_set_fields = map_fields(&fields, |(ident, ty)| {
                quote!(pub fn #ident(mut self, value: #ty) -> Self {
                    self.#ident = Some(value);
                    self
                })
            });
            let build_lets = map_fields(&fields, |(ident, _)| {
                quote!(
                    let #ident = self.#ident.ok_or(format!(
                        "field \"{}\" required, but not set yet.",
                        stringify!(#ident),
                    ))?;
                )
            });
            let build_values = map_fields(&fields, |(ident, _)| quote!(#ident,));

            let result = quote!(
                impl #ident {
                    pub fn builder() -> #ident_builder {
                        #ident_builder::default()
                    }
                }

                #[derive(Default)]
                pub struct #ident_builder {
                    #builder_fields
                }

                impl #ident_builder {
                    #builder_set_fields

                    pub fn build(self) -> Result<#ident, String> {
                        #build_lets
                        Ok(#ident { #build_values })
                    }
                }
            )
            .into();

            return result;
        }
    };

    quote!().into()
}

fn map_fields<F>(fields: &Fields, mapper: F) -> TokenStream2
where
    F: FnMut((&Ident, &Type)) -> TokenStream2,
{
    TokenStream2::from_iter(
        fields
            .iter()
            // 输入 field 是字段，输出 (字段名 ident，类型 type)
            .map(|field| (field.ident.as_ref().unwrap(), &field.ty))
            .map(mapper),
    )
}
