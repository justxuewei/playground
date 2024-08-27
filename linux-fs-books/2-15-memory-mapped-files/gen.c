#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define BUFFER_SIZE 8192

int main()
{
	FILE *fp, *fp1;
	char buffer[BUFFER_SIZE];
	char text[BUFFER_SIZE];
	size_t i, text_len;

	fp = fopen("lorem-ipsum.txt", "r");
	if (!fp) {
		perror("error on opening file");
		return 1;
	}

	fread(text, sizeof(char), BUFFER_SIZE, fp);
	fclose(fp);

	text_len = strlen(text);
	while (i < BUFFER_SIZE) {
		buffer[i] = text[i % text_len];
		i++;
	}

	fp1 = fopen("lorem-ipsum-8k.txt", "w");
	if (!fp1) {
		perror("error on opening output file");
		return 1;
	}

	fwrite(buffer, sizeof(char), BUFFER_SIZE, fp1);
	fclose(fp1);

	return 0;
}
