use std::{collections::HashMap, hash::Hash};

pub fn test1() {
    let mut hash_map: HashMap<String, HashMap<String, String>> = HashMap::new();
    {
        hash_map.insert("test".to_owned(), HashMap::new());
        let test_hash_map = hash_map.get_mut("test").unwrap();
        test_hash_map.insert("test1".to_owned(), "value".to_owned());
    }

    let test_hash_map = hash_map.get_mut("test").unwrap();
    let test1_hash_map = test_hash_map.get_mut("test1").unwrap();
    *test1_hash_map = "new value".to_owned();

    println!("hash map: {:?}", hash_map);
}

struct MountedInfo {
    field1: String,
}

struct Sandbox {
    double_hash_map: HashMap<String, HashMap<String, MountedInfo>>,
}

impl Sandbox {
    fn test_fn(&self, field1: &str) {
        println!("Test::field1 = {}", field1);
    }

    fn test_main(&mut self) {
        {
            let mounted_info = MountedInfo {
                field1: "haha".to_owned(),
            };
            self.double_hash_map = HashMap::new();
            self.double_hash_map
                .insert("test".to_owned(), HashMap::new());
            self.double_hash_map
                .get_mut("test")
                .unwrap()
                .insert("test1".to_owned(), mounted_info);
        }

        let mounted_info = self
            .double_hash_map
            .get_mut("test")
            .unwrap()
            .get_mut("test1")
            .unwrap();
        let field1 = mounted_info.field1.clone();
        self.test_fn(&field1);
    }
}

pub fn test2() {

}
