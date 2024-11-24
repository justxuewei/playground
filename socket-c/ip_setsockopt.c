#include <stdio.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <errno.h>

int main() {
    int sockfd = socket(AF_INET, SOCK_DGRAM|SOCK_CLOEXEC|SOCK_NONBLOCK, IPPROTO_IP);
    if (sockfd < 0) {
        perror("socket");
        return -1;
    }

    int enable = 1;
    if (setsockopt(sockfd, SOL_IP, IP_RECVERR, &enable, sizeof(enable)) < 0) {
        perror("setsockopt");
        return -1;
    }

    printf("IP_RECVERR enabled on socket.\n");
    // Use the socket for communication here...

    return 0;
}