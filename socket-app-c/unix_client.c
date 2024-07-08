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

    int sockfd, n;
    struct sockaddr_un server_addr;
    char buf[BUFSIZE];

    if ((sockfd = socket(AF_UNIX, SOCK_STREAM, 0)) < 0) {
        perror("socket failed");
        return sockfd;
    }

    memset(&server_addr, 0, sizeof(struct sockaddr_un));
    server_addr.sun_family = AF_UNIX;
    strncpy(server_addr.sun_path, argv[1], sizeof(server_addr.sun_path) - 1);

    if (connect(sockfd, (struct sockaddr *)&server_addr, sizeof(struct sockaddr_un)) < 0) {
        perror("connect failed");
        close(sockfd);
        return -1;
    }

    memset(buf, 0, BUFSIZE);
    strcpy(buf, "hello from client!");
    n = send(sockfd, buf, strlen(buf), 0);
    if (n < 0) {
        perror("send failed");
        close(sockfd);
        return n;
    }
    printf("Sent %d bytes to server:\n%s\n", n, buf);

    memset(buf, 0, BUFSIZE);
    n = recv(sockfd, buf, BUFSIZE, 0);
    if (n < 0) {
        perror("recv failed");
        close(sockfd);
        return n;
    }
    printf("Received %d bytes from server:\n%s\n", n, buf);

    close(sockfd);
    return 0;
}
