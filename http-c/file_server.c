#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/socket.h>

#define BUFFER_SIZE 40960

void error(const char *msg) {
    perror(msg);
    exit(1);
}

void send_file(int client_socket, const char *file_path) {
    int file_fd = open(file_path, O_RDONLY);
    if (file_fd == -1) {
        error("Error opening file");
    }

    struct stat file_stat;
    if (fstat(file_fd, &file_stat) == -1) {
        error("Error getting file stat");
    }

    char header[BUFFER_SIZE];
    int header_length = snprintf(header, BUFFER_SIZE,
        "HTTP/1.1 200 OK\r\n"
        "Content-Length: %ld\r\n"
        "Content-Type: application/octet-stream\r\n"
        "Connection: close\r\n\r\n", file_stat.st_size);
    
    if (send(client_socket, header, header_length, 0) == -1) {
        error("Error sending header");
    }

    char buffer[BUFFER_SIZE];
    ssize_t bytes_read, bytes_sent;
    while ((bytes_read = read(file_fd, buffer, BUFFER_SIZE)) > 0) {
        bytes_sent = send(client_socket, buffer, bytes_read, 0);
        if (bytes_sent == -1) {
            perror("Error sending file");
            break;
        }
    }

    close(file_fd);
    shutdown(client_socket, SHUT_WR); // Gracefully close the write end of the connection
}

int main(int argc, char *argv[]) {
    if (argc != 4) {
        fprintf(stderr, "Usage: %s <IP> <Port> <File>\n", argv[0]);
        exit(1);
    }

    const char *ip = argv[1];
    int port = atoi(argv[2]);
    const char *file_path = argv[3];

    int server_socket = socket(AF_INET, SOCK_STREAM, 0);
    if (server_socket == -1) {
        error("Error creating socket");
    }

    struct sockaddr_in server_addr;
    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = inet_addr(ip);
    server_addr.sin_port = htons(port);

    if (bind(server_socket, (struct sockaddr*)&server_addr, sizeof(server_addr)) == -1) {
        error("Error binding socket");
    }

    if (listen(server_socket, 5) == -1) {
        error("Error listening on socket");
    }

    printf("Server listening on %s:%d\n", ip, port);

    while (1) {
        struct sockaddr_in client_addr;
        socklen_t client_len = sizeof(client_addr);
        int client_socket = accept(server_socket, (struct sockaddr*)&client_addr, &client_len);
        if (client_socket == -1) {
            error("Error accepting connection");
        }

        printf("Connection accepted from %s:%d\n", inet_ntoa(client_addr.sin_addr), ntohs(client_addr.sin_port));

        send_file(client_socket, file_path);

        close(client_socket);
    }

    close(server_socket);
    return 0;
}
