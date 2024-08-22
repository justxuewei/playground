#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <arpa/inet.h>
#include <unistd.h>

#define DATA_SIZE 32768
#define NUM_MESSAGES 100

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

    int sockfd, rcvbuf = DATA_SIZE;
    struct sockaddr_in server_addr, client_addr;

    // 创建UDP socket
    if ((sockfd = socket(AF_INET, SOCK_DGRAM, 0)) < 0) {
        perror("socket creation failed");
        exit(EXIT_FAILURE);
    }

    if (setsockopt(sockfd, SOL_SOCKET, SO_RCVBUF, &rcvbuf, sizeof(int)) < 0) {
        perror("setsockopt failed");
        close(sockfd);
        exit(EXIT_FAILURE);
    }

    memset(&server_addr, 0, sizeof(server_addr));
    memset(&client_addr, 0, sizeof(client_addr));

    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(server_port);
    server_addr.sin_addr.s_addr = inet_addr(server_ip);

    if (bind(sockfd, (struct sockaddr *)&server_addr, sizeof(server_addr)) < 0) {
        perror("bind failed");
        close(sockfd);
        return -1;
    }

    char buffer[DATA_SIZE];
    char expected_data[DATA_SIZE];
    socklen_t addr_len = sizeof(client_addr);

    for (int i = 0; i < NUM_MESSAGES; i++) {
        memset(buffer, 0, DATA_SIZE);
        memset(expected_data, 0, DATA_SIZE);
        generate_data(expected_data, DATA_SIZE);

        int total_bytes_received = 0;
        while (total_bytes_received < DATA_SIZE) {
            int n = recvfrom(sockfd, buffer + total_bytes_received, DATA_SIZE - total_bytes_received, 0, (struct sockaddr *)&client_addr, &addr_len);
            if (n < 0) {
                perror("recvfrom failed");
                close(sockfd);
                return -1;
            } else if (n == 0) {
                printf("No more data to receive. Ending reception.\n");
                break;
            }
            printf("recv %d bytes\n", n);
            total_bytes_received += n;
        }

        printf("recv %d bytes, expected recv %d bytes\n", total_bytes_received, DATA_SIZE);

        if (total_bytes_received != DATA_SIZE) {
            exit(1);
        }

        if (memcmp(buffer, expected_data, DATA_SIZE) == 0) {
            printf("Message %d received correctly. Total bytes received: %d\n", i + 1, total_bytes_received);
        } else {
            printf("Message %d received incorrectly. Total bytes received: %d\n", i + 1, total_bytes_received);
            exit(1);
        }
    }

    close(sockfd);
    return 0;
}