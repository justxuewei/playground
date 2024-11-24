#include <arpa/inet.h>
#include <netdb.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
int main(int argc, char *argv[]) {
    if (argc != 2) {
        fprintf(stderr, "Usage: %s <hostname>\n", argv[0]);
        return EXIT_FAILURE;
    }

    const char *hostname = argv[1];
    struct addrinfo hints, *res, *p;
    int status;
    char ipstr[INET_ADDRSTRLEN];

    memset(&hints, 0, sizeof(hints));
    hints.ai_family = AF_INET;        // IPv4
    hints.ai_flags = AI_CANONNAME;   // Request canonical name

    // Get address info
    if ((status = getaddrinfo(hostname, NULL, &hints, &res)) != 0) {
        fprintf(stderr, "getaddrinfo: %s\n", gai_strerror(status));
        return EXIT_FAILURE;
    }

    // Print canonical name
    if (res->ai_canonname != NULL) {
        printf("Canonical name: %s\n", res->ai_canonname);
    } else {
        printf("Canonical name not available.\n");
    }

    // Iterate through the results
    for (p = res; p != NULL; p = p->ai_next) {
        struct sockaddr_in *ipv4 = (struct sockaddr_in *)p->ai_addr;
        void *addr = &(ipv4->sin_addr);

        // Convert the IP to a string
        inet_ntop(p->ai_family, addr, ipstr, sizeof(ipstr));
        printf("  IPv4: %s\n", ipstr);
    }

    // Free memory
    freeaddrinfo(res);

    return EXIT_SUCCESS;
}
