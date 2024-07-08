#include <sys/socket.h>
#include <sys/un.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

#define BUFSIZE 1024

int main(int argc, char **argv)
{
    if (argc != 2) {
        printf("Usage: %s {socket_path}\n", argv[0]);
        return 1;
    }

    int server_fd, client_fd, n;
    struct sockaddr_un server_addr, client_addr;
    char buf[BUFSIZE];
    socklen_t client_addr_len = sizeof(client_addr);

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

    if ((client_fd = accept(server_fd, (struct sockaddr *)&client_addr, &client_addr_len)) < 0) {
        perror("accept failed");
        close(server_fd);
        return -1;
    }

    memset(buf, 0, BUFSIZE);
    n = recv(client_fd, buf, BUFSIZE, 0);
    if (n < 0) {
        perror("recv failed");
        close(client_fd);
        close(server_fd);
        return -1;
    }
    printf("Received %d bytes from client:\n%s\n", n, buf);

    strcpy(buf, "hello from server!");
    n = send(client_fd, buf, strlen(buf), 0);
    if (n < 0) {
        perror("send failed");
        close(client_fd);
        close(server_fd);
        return n;
    }
    printf("Sent %d bytes to client:\n%s\n", n, buf);

    close(client_fd);
    close(server_fd);
    unlink(argv[1]); // 删除 socket 文件

    return 0;
}
