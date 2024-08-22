#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <arpa/inet.h>
#include <unistd.h>

#define DATA_SIZE 32768
#define NUM_MESSAGES 1

void generate_data(char *buffer, int size) {
    int offset = 0;
    for (int i = 1; offset < size; i++) {
        offset += snprintf(buffer + offset, size - offset, "%d", i);
    }
}

int main(int argc, char *argv[]) {
    if (argc != 3) {
        printf("Usage: %s <Server IP> <Server Port>\n", argv[0]);
        return -1;
    }

    const char *server_ip = argv[1];
    int server_port = atoi(argv[2]);

    int sockfd;
    struct sockaddr_in server_addr;

    if ((sockfd = socket(AF_INET, SOCK_DGRAM, 0)) < 0) {
        perror("socket creation failed");
        exit(EXIT_FAILURE);
    }

    memset(&server_addr, 0, sizeof(server_addr));

    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(server_port);
    server_addr.sin_addr.s_addr = inet_addr(server_ip);

    char buffer[DATA_SIZE];

    for (int i = 0; i < NUM_MESSAGES; i++) {
        memset(buffer, 0, DATA_SIZE);
        generate_data(buffer, DATA_SIZE);

        if (sendto(sockfd, buffer, DATA_SIZE, 0, (struct sockaddr *)&server_addr, sizeof(server_addr)) < 0) {
            perror("sendto failed");
            close(sockfd);
            return -1;
        }

        printf("Message %d sent\n", i + 1);

        sleep(1);
    }

    close(sockfd);
    return 0;
}