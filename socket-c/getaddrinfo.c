#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netdb.h>
#include <arpa/inet.h>

void print_address_info(struct addrinfo *res) {
    char host[NI_MAXHOST];
    char service[NI_MAXSERV];
    struct addrinfo *p;

    for (p = res; p != NULL; p = p->ai_next) {
        int status = getnameinfo(p->ai_addr, p->ai_addrlen, host, sizeof(host), service, sizeof(service), NI_NUMERICHOST | NI_NUMERICSERV);
        if (status != 0) {
            fprintf(stderr, "getnameinfo: %s\n", gai_strerror(status));
            continue;
        }
        printf("Host: %s, Port: %s\n", host, service);
    }
}

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "Usage: %s <hostname_or_ip> <port>\n", argv[0]);
        exit(EXIT_FAILURE);
    }

    const char *hostname = argv[1];
    const char *port = argv[2];

    struct addrinfo hints, *res, *p;
    int status;

    memset(&hints, 0, sizeof hints);
    hints.ai_family = 0x2; // AF_INET or AF_INET6 to force version
    hints.ai_socktype = 0x1;
    hints.ai_protocol = 0x6;
    hints.ai_flags = 0x22;

    if ((status = getaddrinfo(hostname, port, &hints, &res)) != 0) {
        fprintf(stderr, "getaddrinfo: %s\n", gai_strerror(status));
        exit(EXIT_FAILURE);
    }

    print_address_info(res);

    int sockfd;
    for (p = res; p != NULL; p = p->ai_next) {
        if ((sockfd = socket(p->ai_family, p->ai_socktype, p->ai_protocol)) == -1) {
            perror("socket");
            continue;
        }

        if (connect(sockfd, p->ai_addr, p->ai_addrlen) == -1) {
            close(sockfd);
            perror("connect");
            continue;
        }

        break; // If we get here, we must have connected successfully
    }

    if (p == NULL) {
        fprintf(stderr, "failed to connect\n");
        return 2;
    }

    freeaddrinfo(res); // Free the linked list

    // Now sockfd is connected to the server
    printf("Connected to %s on port %s\n", hostname, port);

    close(sockfd);
    return 0;
}
