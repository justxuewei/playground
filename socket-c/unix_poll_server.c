#include <sys/socket.h>
#include <sys/un.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <poll.h>

#define BUFSIZE 1024
#define MAX_CLIENTS 10

int main(int argc, char **argv)
{
    if (argc != 2) {
        printf("Usage: %s {socket_path}\n", argv[0]);
        return 1;
    }

    int server_fd, round, n;
    struct sockaddr_un server_addr;
    char buf[BUFSIZE];
    struct pollfd fds[MAX_CLIENTS];
    int nfds = 1;

    if ((server_fd = socket(AF_UNIX, SOCK_STREAM, 0)) < 0) {
        perror("socket failed");
        return server_fd;
    }

    memset(&server_addr, 0, sizeof(struct sockaddr_un));
    server_addr.sun_family = AF_UNIX;
    strncpy(server_addr.sun_path, argv[1], sizeof(server_addr.sun_path) - 1);

    unlink(argv[1]); // 删除已存在的 socket 文件

    if (bind(server_fd, (struct sockaddr *)&server_addr, sizeof(struct sockaddr_un)) < 0) {
        perror("bind failed");
        close(server_fd);
        return -1;
    }

    if (listen(server_fd, 5) < 0) {
        perror("listen failed");
        close(server_fd);
        return -1;
    }

    printf("Server is listening on %s\n", argv[1]);

    fds[0].fd = server_fd;
    fds[0].events = POLLIN;

    for (round = 0; round < 2; round++) {
        int ret = poll(fds, nfds, -1);
        if (ret < 0) {
            perror("poll failed");
            break;
        }

        for (int i = 0; i < nfds; i++) {
            if (fds[i].revents & POLLIN) {
                if (fds[i].fd == server_fd) {
                    // New connection
                    int client_fd;
                    struct sockaddr_un client_addr;
                    socklen_t client_addr_len = sizeof(client_addr);
                    if ((client_fd = accept(server_fd, (struct sockaddr *)&client_addr, &client_addr_len)) < 0) {
                        perror("accept failed");
                        continue;
                    }
                    printf("Accepted new client\n");

                    // Add new client to pollfd array
                    if (nfds < MAX_CLIENTS) {
                        fds[nfds].fd = client_fd;
                        fds[nfds].events = POLLIN;
                        nfds++;
                    } else {
                        printf("Too many clients\n");
                        close(client_fd);
                    }
                } else {
                    // Data from client
                    memset(buf, 0, BUFSIZE);
                    n = recv(fds[i].fd, buf, BUFSIZE, 0);
                    if (n <= 0) {
                        if (n < 0) {
                            perror("recv failed");
                        } else {
                            printf("Client disconnected\n");
                        }
                        close(fds[i].fd);
                        fds[i].fd = -1;
                    } else {
                        printf("Received %d bytes from client:\n%s\n", n, buf);
                        strcpy(buf, "hello from server!");
                        n = send(fds[i].fd, buf, strlen(buf), 0);
                        if (n < 0) {
                            perror("send failed");
                        } else {
                            printf("Sent %d bytes to client:\n%s\n", n, buf);
                        }
                    }
                }
            }
        }

        // Remove closed clients
        for (int i = 0; i < nfds; i++) {
            if (fds[i].fd == -1) {
                for (int j = i; j < nfds - 1; j++) {
                    fds[j] = fds[j + 1];
                }
                nfds--;
                i--;
            }
        }
    }

    close(server_fd);
    unlink(argv[1]); // 删除 socket 文件

    return 0;
}
