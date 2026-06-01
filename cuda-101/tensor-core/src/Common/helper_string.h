#ifndef COMMON_HELPER_STRING_H_
#define COMMON_HELPER_STRING_H_

#include <stdio.h>
#include <stdlib.h>
#include <fstream>
#include <string>

#if defined(WIN32) || defined(_WIN32) || defined(WIN64) || defined(_WIN64)
#ifndef _CRT_SECURE_NO_DEPRECATE
#define _CRT_SECURE_NO_DEPRECATE
#endif
#ifndef STRCASECMP
#define STRCASECMP _stricmp
#endif
#ifndef STRNCASECMP
#define STRNCASECMP _strnicmp
#endif
#ifndef STRCPY
#define STRCPY(sFilePath, nLength, sPath) strcpy_s(sFilePath, nLength, sPath)
#endif

#ifndef FOPEN
#define FOPEN(fHandle, filename, mode) fopen_s(&fHandle, filename, mode)
#endif
#ifndef FOPEN_FAIL
#define FOPEN_FAIL(result) (result != 0)
#endif
#ifndef SSCANF
#define SSCANF sscanf_s
#endif
#ifndef SPRINTF
#define SPRINTF sprintf_s
#endif
#else
#include <string.h>
#include <strings.h>

#ifndef STRCASECMP
#define STRCASECMP strcasecmp
#endif
#ifndef STRNCASECMP
#define STRNCASECMP strncasecmp
#endif
#ifndef STRCPY
#define STRCPY(sFilePath, nLength, sPath) strcpy(sFilePath, sPath)
#endif

#ifndef FOPEN
#define FOPEN(fHandle, filename, mode) (fHandle = fopen(filename, mode))
#endif
#ifndef FOPEN_FAIL
#define FOPEN_FAIL(result) (result == NULL)
#endif
#ifndef SSCANF
#define SSCANF sscanf
#endif
#ifndef SPRINTF
#define SPRINTF sprintf
#endif
#endif

#ifndef EXIT_WAIVED
#define EXIT_WAIVED 2
#endif


inline int stringRemoveDelimiter(char delimiter, const char *string) {
  int string_start = 0;

  while (string[string_start] == delimiter) {
    string_start++;
  }

  if (string_start >= static_cast<int>(strlen(string) - 1)) {
    return 0;
  }

  return string_start;
}

inline int getFileExtension(char *filename, char **extension) {
  int string_length = static_cast<int>(strlen(filename));

  while (filename[string_length--] != '.') {
    if (string_length == 0) break;
  }

  if (string_length > 0) string_length += 2;

  if (string_length == 0)
    *extension = NULL;
  else
    *extension = &filename[string_length];

  return string_length;
}

inline bool checkCmdLineFlag(const int argc, const char **argv,
                             const char *string_ref) {
  bool bFound = false;

  if (argc >= 1) {
    for (int i = 1; i < argc; i++) {
      int string_start = stringRemoveDelimiter('-', argv[i]);
      const char *string_argv = &argv[i][string_start];

      const char *equal_pos = strchr(string_argv, '=');
      int argv_length = static_cast<int>(
          equal_pos == 0 ? strlen(string_argv) : equal_pos - string_argv);

      int length = static_cast<int>(strlen(string_ref));

      if (length == argv_length &&
          !STRNCASECMP(string_argv, string_ref, length)) {
        bFound = true;
        continue;
      }
    }
  }

  return bFound;
}


template <class T>
inline bool getCmdLineArgumentValue(const int argc, const char **argv,
                                    const char *string_ref, T *value) {
  bool bFound = false;

  if (argc >= 1) {
    for (int i = 1; i < argc; i++) {
      int string_start = stringRemoveDelimiter('-', argv[i]);
      const char *string_argv = &argv[i][string_start];
      int length = static_cast<int>(strlen(string_ref));

      if (!STRNCASECMP(string_argv, string_ref, length)) {
        if (length + 1 <= static_cast<int>(strlen(string_argv))) {
          int auto_inc = (string_argv[length] == '=') ? 1 : 0;
          *value = (T)atoi(&string_argv[length + auto_inc]);
        }

        bFound = true;
        i = argc;
      }
    }
  }

  return bFound;
}

inline int getCmdLineArgumentInt(const int argc, const char **argv,
                                 const char *string_ref) {
  bool bFound = false;
  int value = -1;

  if (argc >= 1) {
    for (int i = 1; i < argc; i++) {
      int string_start = stringRemoveDelimiter('-', argv[i]);
      const char *string_argv = &argv[i][string_start];
      int length = static_cast<int>(strlen(string_ref));

      if (!STRNCASECMP(string_argv, string_ref, length)) {
        if (length + 1 <= static_cast<int>(strlen(string_argv))) {
          int auto_inc = (string_argv[length] == '=') ? 1 : 0;
          value = atoi(&string_argv[length + auto_inc]);
        } else {
          value = 0;
        }

        bFound = true;
        continue;
      }
    }
  }

  if (bFound) {
    return value;
  } else {
    return 0;
  }
}

inline float getCmdLineArgumentFloat(const int argc, const char **argv,
                                     const char *string_ref) {
  bool bFound = false;
  float value = -1;

  if (argc >= 1) {
    for (int i = 1; i < argc; i++) {
      int string_start = stringRemoveDelimiter('-', argv[i]);
      const char *string_argv = &argv[i][string_start];
      int length = static_cast<int>(strlen(string_ref));

      if (!STRNCASECMP(string_argv, string_ref, length)) {
        if (length + 1 <= static_cast<int>(strlen(string_argv))) {
          int auto_inc = (string_argv[length] == '=') ? 1 : 0;
          value = static_cast<float>(atof(&string_argv[length + auto_inc]));
        } else {
          value = 0.f;
        }

        bFound = true;
        continue;
      }
    }
  }

  if (bFound) {
    return value;
  } else {
    return 0;
  }
}

inline bool getCmdLineArgumentString(const int argc, const char **argv,
                                     const char *string_ref,
                                     char **string_retval) {
  bool bFound = false;

  if (argc >= 1) {
    for (int i = 1; i < argc; i++) {
      int string_start = stringRemoveDelimiter('-', argv[i]);
      char *string_argv = const_cast<char *>(&argv[i][string_start]);
      int length = static_cast<int>(strlen(string_ref));

      if (!STRNCASECMP(string_argv, string_ref, length)) {
        *string_retval = &string_argv[length + 1];
        bFound = true;
        continue;
      }
    }
  }

  if (!bFound) {
    *string_retval = NULL;
  }

  return bFound;
}


inline char *sdkFindFilePath(const char *filename,
                             const char *executable_path) {


  const char *searchPath[] = {
      "./",
      "./data/",

      "../../../../cpp/<executable_name>/",
      "../../../cpp/<executable_name>/",
      "../../cpp/<executable_name>/",

      "../../../../cpp/<executable_name>/data/",
      "../../../cpp/<executable_name>/data/",
      "../../cpp/<executable_name>/data/",

      "../../../../cpp/0_Introduction/<executable_name>/",
      "../../../cpp/0_Introduction/<executable_name>/",
      "../../cpp/0_Introduction/<executable_name>/",

      "../../../../cpp/1_Utilities/<executable_name>/",
      "../../../cpp/1_Utilities/<executable_name>/",
      "../../cpp/1_Utilities/<executable_name>/",

      "../../../../cpp/2_Concepts_and_Techniques/<executable_name>/",
      "../../../cpp/2_Concepts_and_Techniques/<executable_name>/",
      "../../cpp/2_Concepts_and_Techniques/<executable_name>/",

      "../../../../cpp/3_CUDA_Features/<executable_name>/",
      "../../../cpp/3_CUDA_Features/<executable_name>/",
      "../../cpp/3_CUDA_Features/<executable_name>/",

      "../../../../cpp/4_CUDA_Libraries/<executable_name>/",
      "../../../cpp/4_CUDA_Libraries/<executable_name>/",
      "../../cpp/4_CUDA_Libraries/<executable_name>/",

      "../../../../cpp/5_Domain_Specific/<executable_name>/",
      "../../../cpp/5_Domain_Specific/<executable_name>/",
      "../../cpp/5_Domain_Specific/<executable_name>/",

      "../../../../cpp/6_Performance/<executable_name>/",
      "../../../cpp/6_Performance/<executable_name>/",
      "../../cpp/6_Performance/<executable_name>/",

      "../../../../cpp/0_Introduction/<executable_name>/data/",
      "../../../cpp/0_Introduction/<executable_name>/data/",
      "../../cpp/0_Introduction/<executable_name>/data/",

      "../../../../cpp/1_Utilities/<executable_name>/data/",
      "../../../cpp/1_Utilities/<executable_name>/data/",
      "../../cpp/1_Utilities/<executable_name>/data/",

      "../../../../cpp/2_Concepts_and_Techniques/<executable_name>/data/",
      "../../../cpp/2_Concepts_and_Techniques/<executable_name>/data/",
      "../../cpp/2_Concepts_and_Techniques/<executable_name>/data/",

      "../../../../cpp/3_CUDA_Features/<executable_name>/data/",
      "../../../cpp/3_CUDA_Features/<executable_name>/data/",
      "../../cpp/3_CUDA_Features/<executable_name>/data/",

      "../../../../cpp/4_CUDA_Libraries/<executable_name>/data/",
      "../../../cpp/4_CUDA_Libraries/<executable_name>/data/",
      "../../cpp/4_CUDA_Libraries/<executable_name>/data/",

      "../../../../cpp/5_Domain_Specific/<executable_name>/data/",
      "../../../cpp/5_Domain_Specific/<executable_name>/data/",
      "../../cpp/5_Domain_Specific/<executable_name>/data/",

      "../../../../cpp/6_Performance/<executable_name>/data/",
      "../../../cpp/6_Performance/<executable_name>/data/",
      "../../cpp/6_Performance/<executable_name>/data/",

      "../../../../Common/data/",
      "../../../Common/data/",
      "../../Common/data/",

      "../../../../cpp/9_CUDA_Tile/<executable_name>/",
      "../../../cpp/9_CUDA_Tile/<executable_name>/",
      "../../cpp/9_CUDA_Tile/<executable_name>/",
      "../cpp/9_CUDA_Tile/<executable_name>/",
      "./cpp/9_CUDA_Tile/<executable_name>/"
  };


  std::string executable_name;

  if (executable_path != 0) {
    executable_name = std::string(executable_path);

#if defined(WIN32) || defined(_WIN32) || defined(WIN64) || defined(_WIN64)

    size_t delimiter_pos = executable_name.find_last_of('\\');
    executable_name.erase(0, delimiter_pos + 1);

    if (executable_name.rfind(".exe") != std::string::npos) {

      executable_name.resize(executable_name.size() - 4);
    }

#else

    size_t delimiter_pos = executable_name.find_last_of('/');
    executable_name.erase(0, delimiter_pos + 1);
#endif
  }


  for (unsigned int i = 0; i < sizeof(searchPath) / sizeof(char *); ++i) {
    std::string path(searchPath[i]);
    size_t executable_name_pos = path.find("<executable_name>");


    if (executable_name_pos != std::string::npos) {
      if (executable_path != 0) {
        path.replace(executable_name_pos, strlen("<executable_name>"),
                     executable_name);
      } else {

        continue;
      }
    }

#ifdef _DEBUG
    printf("sdkFindFilePath <%s> in %s\n", filename, path.c_str());
#endif


    path.append(filename);
    FILE *fp;
    FOPEN(fp, path.c_str(), "rb");

    if (fp != NULL) {
      fclose(fp);


      char *file_path = reinterpret_cast<char *>(malloc(path.length() + 1));
      STRCPY(file_path, path.length() + 1, path.c_str());
      return file_path;
    }

    if (fp) {
      fclose(fp);
    }
  }


  printf("\nerror: sdkFindFilePath: file <%s> not found!\n", filename);
  return 0;
}

#endif
