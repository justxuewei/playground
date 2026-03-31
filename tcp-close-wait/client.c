/*
 * client.c — two threads, each demonstrating a different CLOSE_WAIT scenario.
 *
 * Case 1 (port 10000): client calls close() → sends FIN to server.
 *   Server (which never closes) enters CLOSE_WAIT.
 *
 * Case 2 (port 10001): client never calls close() after receiving server's FIN.
 *   Client socket stays in CLOSE_WAIT.
 *
 * Usage:
 *   ./client.out [server_ip]   (default: 127.0.0.1)
 *
 * Observe with:
 *   ss -tnp | grep '1000[01]'
 */

#include <arpa/inet.h>
#include <netinet/in.h>
#include <pthread.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

#define PORT1  10000
#define PORT2  10001

static volatile int keep_running = 1;
static const char  *server_ip    = "127.0.0.1";

static int connect_to(int port)
{
	int sockfd;
	struct sockaddr_in addr;

	sockfd = socket(AF_INET, SOCK_STREAM, 0);

	memset(&addr, 0, sizeof(addr));
	addr.sin_family = AF_INET;
	addr.sin_port   = htons(port);
	inet_pton(AF_INET, server_ip, &addr.sin_addr);

	/* Retry for up to 3 s in case the server thread isn't ready yet. */
	for (int i = 0; i < 10; i++) {
		if (connect(sockfd, (struct sockaddr *)&addr, sizeof(addr)) == 0)
			return sockfd;
		usleep(300000);
	}
	perror("connect");
	close(sockfd);
	return -1;
}

/*
 * Case 1: client closes → server enters CLOSE_WAIT.
 */
static void *case1_thread(void *arg)
{
	int sockfd = connect_to(PORT1);
	if (sockfd < 0)
		return NULL;
	printf("[case1] connected to %s:%d\n", server_ip, PORT1);

	const char *msg = "hello from case1 client";
	write(sockfd, msg, strlen(msg));
	printf("[case1] sent: \"%s\"\n", msg);

	/* close() sends FIN → server enters CLOSE_WAIT */
	close(sockfd);
	printf("[case1] socket closed (FIN sent) — server should be in CLOSE_WAIT\n\n");

	return NULL;
}

/*
 * Case 2: server closes first; client receives FIN but never calls close()
 * → client socket stays in CLOSE_WAIT.
 */
static void *case2_thread(void *arg)
{
	int sockfd = connect_to(PORT2);
	if (sockfd < 0)
		return NULL;
	printf("[case2] connected to %s:%d\n", server_ip, PORT2);

	const char *msg = "hello from case2 client";
	write(sockfd, msg, strlen(msg));
	printf("[case2] sent: \"%s\"\n", msg);

	/* Block until server sends FIN (read returns 0). */
	char buf[64];
	int n = read(sockfd, buf, sizeof(buf));
	if (n == 0)
		printf("[case2] received FIN from server (read returned 0)\n");

	/*
	 * Do NOT close sockfd.
	 * We received the server's FIN; the kernel ACKed it, but because we
	 * never call close() here this socket stays in CLOSE_WAIT.
	 */
	printf("[case2] holding sockfd=%d open — client is in CLOSE_WAIT\n", sockfd);
	printf("[case2] check: ss -tnp | grep %d\n\n", PORT2);

	while (keep_running)
		sleep(1);

	close(sockfd);
	return NULL;
}

int main(int argc, char **argv)
{
	if (argc > 1)
		server_ip = argv[1];

	pthread_t t1, t2;

	pthread_create(&t1, NULL, case1_thread, NULL);
	pthread_create(&t2, NULL, case2_thread, NULL);

	printf("press Enter to exit...\n\n");
	getchar();

	keep_running = 0;
	pthread_join(t1, NULL);
	pthread_join(t2, NULL);
	return 0;
}
