#include <stdio.h>
#include <stdlib.h>
#include <time.h>

int compare(const void *a, const void *b) { return (*(int *)a - *(int *)b); }

void test(int sort) {
  const unsigned arraySize = 32768;
  int *data = malloc(sizeof(int) * arraySize);

  for (unsigned c = 0; c < arraySize; ++c)
    data[c] = rand() % 256;

  if (sort)
    qsort(data, arraySize, sizeof(int), compare);

  // loop begin
  clock_t start = clock();
  long long sum = 0;

  for (unsigned i = 0; i < 10000; ++i) {
    for (unsigned c = 0; c < arraySize; ++c) {
      if (data[c] >= 128)
        sum++;
    }
  }

  double elapsedTime = (double)(clock() - start) / CLOCKS_PER_SEC;
  // loop end

  free(data);
  printf("sort=%d, elapsedTime=%.3f seconds\n", sort, elapsedTime);
}

int main() {
  test(0);
  test(1);
  return 0;
}
