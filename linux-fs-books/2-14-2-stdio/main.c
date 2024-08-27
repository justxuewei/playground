#include <stdio.h>

int main()
{
	FILE *fp;
	int c;

	fp = fopen("lorem-ipsum", "r");
	c = fgetc(fp);
	printf("char = %c\n", (char)c);
}
