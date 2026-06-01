#ifndef COMMON_HELPER_TIMER_H_
#define COMMON_HELPER_TIMER_H_

#ifndef EXIT_WAIVED
#define EXIT_WAIVED 2
#endif


#include <vector>


#include <exception.h>


class StopWatchInterface {
 public:
  StopWatchInterface() {}
  virtual ~StopWatchInterface() {}

 public:

  virtual void start() = 0;


  virtual void stop() = 0;


  virtual void reset() = 0;


  virtual float getTime() = 0;


  virtual float getAverageTime() = 0;
};


#if defined(WIN32) || defined(_WIN32) || defined(WIN64) || defined(_WIN64)

#define WINDOWS_LEAN_AND_MEAN
#include <windows.h>
#undef min
#undef max


class StopWatchWin : public StopWatchInterface {
 public:

  StopWatchWin()
      : start_time(),
        end_time(),
        diff_time(0.0f),
        total_time(0.0f),
        running(false),
        clock_sessions(0),
        freq(0),
        freq_set(false) {
    if (!freq_set) {

      LARGE_INTEGER temp;


      QueryPerformanceFrequency(reinterpret_cast<LARGE_INTEGER *>(&temp));


      freq = (static_cast<double>(temp.QuadPart)) / 1000.0;


      freq_set = true;
    }
  }


  ~StopWatchWin() {}

 public:

  inline void start();


  inline void stop();


  inline void reset();


  inline float getTime();


  inline float getAverageTime();

 private:


  LARGE_INTEGER start_time;

  LARGE_INTEGER end_time;


  float diff_time;


  float total_time;


  bool running;


  int clock_sessions;


  double freq;


  bool freq_set;
};


inline void StopWatchWin::start() {
  QueryPerformanceCounter(reinterpret_cast<LARGE_INTEGER *>(&start_time));
  running = true;
}


inline void StopWatchWin::stop() {
  QueryPerformanceCounter(reinterpret_cast<LARGE_INTEGER *>(&end_time));
  diff_time = static_cast<float>(((static_cast<double>(end_time.QuadPart) -
                                   static_cast<double>(start_time.QuadPart)) /
                                  freq));

  total_time += diff_time;
  clock_sessions++;
  running = false;
}


inline void StopWatchWin::reset() {
  diff_time = 0;
  total_time = 0;
  clock_sessions = 0;

  if (running) {
    QueryPerformanceCounter(reinterpret_cast<LARGE_INTEGER *>(&start_time));
  }
}


inline float StopWatchWin::getTime() {

  float retval = total_time;

  if (running) {
    LARGE_INTEGER temp;
    QueryPerformanceCounter(reinterpret_cast<LARGE_INTEGER *>(&temp));
    retval += static_cast<float>(((static_cast<double>(temp.QuadPart) -
                                   static_cast<double>(start_time.QuadPart)) /
                                  freq));
  }

  return retval;
}


inline float StopWatchWin::getAverageTime() {
  return (clock_sessions > 0) ? (total_time / clock_sessions) : 0.0f;
}
#else


#include <sys/time.h>
#include <ctime>


class StopWatchLinux : public StopWatchInterface {
 public:

  StopWatchLinux()
      : start_time(),
        diff_time(0.0),
        total_time(0.0),
        running(false),
        clock_sessions(0) {}


  virtual ~StopWatchLinux() {}

 public:

  inline void start();


  inline void stop();


  inline void reset();


  inline float getTime();


  inline float getAverageTime();

 private:


  inline float getDiffTime();

 private:


  struct timeval start_time;


  float diff_time;


  float total_time;


  bool running;


  int clock_sessions;
};


inline void StopWatchLinux::start() {
  gettimeofday(&start_time, 0);
  running = true;
}


inline void StopWatchLinux::stop() {
  diff_time = getDiffTime();
  total_time += diff_time;
  running = false;
  clock_sessions++;
}


inline void StopWatchLinux::reset() {
  diff_time = 0;
  total_time = 0;
  clock_sessions = 0;

  if (running) {
    gettimeofday(&start_time, 0);
  }
}


inline float StopWatchLinux::getTime() {

  float retval = total_time;

  if (running) {
    retval += getDiffTime();
  }

  return retval;
}


inline float StopWatchLinux::getAverageTime() {
  return (clock_sessions > 0) ? (total_time / clock_sessions) : 0.0f;
}


inline float StopWatchLinux::getDiffTime() {
  struct timeval t_time;
  gettimeofday(&t_time, 0);


  return static_cast<float>(1000.0 * (t_time.tv_sec - start_time.tv_sec) +
                            (0.001 * (t_time.tv_usec - start_time.tv_usec)));
}
#endif


inline bool sdkCreateTimer(StopWatchInterface **timer_interface) {

#if defined(WIN32) || defined(_WIN32) || defined(WIN64) || defined(_WIN64)
  *timer_interface = reinterpret_cast<StopWatchInterface *>(new StopWatchWin());
#else
  *timer_interface =
      reinterpret_cast<StopWatchInterface *>(new StopWatchLinux());
#endif
  return (*timer_interface != NULL) ? true : false;
}


inline bool sdkDeleteTimer(StopWatchInterface **timer_interface) {

  if (*timer_interface) {
    delete *timer_interface;
    *timer_interface = NULL;
  }

  return true;
}


inline bool sdkStartTimer(StopWatchInterface **timer_interface) {

  if (*timer_interface) {
    (*timer_interface)->start();
  }

  return true;
}


inline bool sdkStopTimer(StopWatchInterface **timer_interface) {

  if (*timer_interface) {
    (*timer_interface)->stop();
  }

  return true;
}


inline bool sdkResetTimer(StopWatchInterface **timer_interface) {

  if (*timer_interface) {
    (*timer_interface)->reset();
  }

  return true;
}


inline float sdkGetAverageTimerValue(StopWatchInterface **timer_interface) {


  if (*timer_interface) {
    return (*timer_interface)->getAverageTime();
  } else {
    return 0.0f;
  }
}


inline float sdkGetTimerValue(StopWatchInterface **timer_interface) {

  if (*timer_interface) {
    return (*timer_interface)->getTime();
  } else {
    return 0.0f;
  }
}

#endif
