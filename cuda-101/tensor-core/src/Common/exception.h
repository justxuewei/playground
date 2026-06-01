#ifndef COMMON_EXCEPTION_H_
#define COMMON_EXCEPTION_H_


#include <stdlib.h>
#include <exception>
#include <iostream>
#include <stdexcept>
#include <string>


template <class Std_Exception>
class Exception : public Std_Exception {
 public:


  static void throw_it(const char *file, const int line,
                       const char *detailed = "-");


  static void throw_it(const char *file, const int line,
                       const std::string &detailed);


  virtual ~Exception() throw();

 private:

  Exception();


  explicit Exception(const std::string &str);
};


template <class Exception_Typ>
inline void handleException(const Exception_Typ &ex) {
  std::cerr << ex.what() << std::endl;

  exit(EXIT_FAILURE);
}


#define RUNTIME_EXCEPTION(msg) \
  Exception<std::runtime_error>::throw_it(__FILE__, __LINE__, msg)


#define LOGIC_EXCEPTION(msg) \
  Exception<std::logic_error>::throw_it(__FILE__, __LINE__, msg)


#define RANGE_EXCEPTION(msg) \
  Exception<std::range_error>::throw_it(__FILE__, __LINE__, msg)


#include <sstream>


  template <class Std_Exception>
void Exception<Std_Exception>::throw_it(const char *file, const int line,
                                        const char *detailed) {
  std::stringstream s;


  s << "Exception in file '" << file << "' in line " << line << "\n"
    << "Detailed description: " << detailed << "\n";

  throw Exception(s.str());
}


  template <class Std_Exception>
void Exception<Std_Exception>::throw_it(const char *file, const int line,
                                        const std::string &msg) {
  throw_it(file, line, msg.c_str());
}


template <class Std_Exception>
Exception<Std_Exception>::Exception() : Std_Exception("Unknown Exception.\n") {}


template <class Std_Exception>
Exception<Std_Exception>::Exception(const std::string &s) : Std_Exception(s) {}


template <class Std_Exception>
Exception<Std_Exception>::~Exception() throw() {}


#endif
