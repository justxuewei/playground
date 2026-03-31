/*
 * server.c — two threads, each demonstrating a different CLOSE_WAIT scenario.
 *
 * Case 1 (port 10000): server never calls close(connfd) after receiving the
 *   client's FIN → server socket stays in CLOSE_WAIT.
 *
 * Case 2 (port 10001): server calls close(connfd) immediately after reading →
 *   server sends FIN first; client (which never closes) enters CLOSE_WAIT.
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

#define PORT1   10000
#define PORT2   10001
#define BUFSIZE 1024

static volatile int keep_running = 1;

static int make_listener(int port)
{
	int fd, opt = 1;
	struct sockaddr_in addr;

	fd = socket(AF_INET, SOCK_STREAM, 0);
	setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

	memset(&addr, 0, sizeof(addr));
	addr.sin_family      = AF_INET;
	addr.sin_addr.s_addr = INADDR_ANY;
	addr.sin_port        = htons(port);

	bind(fd, (struct sockaddr *)&addr, sizeof(addr));
	listen(fd, 1);
	return fd;
}

/*
 * Case 1: client closes first.
 * Server receives FIN but never calls close(connfd) → server in CLOSE_WAIT.
 */
static void *case1_thread(void *arg)
{
	int listenfd = make_listener(PORT1);
	printf("[case1] listening on port %d\n", PORT1);

	struct sockaddr_in peer;
	socklen_t plen = sizeof(peer);
	int connfd = accept(listenfd, (struct sockaddr *)&peer, &plen);
	close(listenfd);
	printf("[case1] accepted %s:%d, listenfd closed\n",
	       inet_ntoa(peer.sin_addr), ntohs(peer.sin_port));

	char buf[BUFSIZE];
	int n = read(connfd, buf, BUFSIZE - 1);
	if (n > 0) {
		buf[n] = '\0';
		printf("[case1] received: \"%s\"\n", buf);
	}

	/*
	 * Do NOT close connfd.
	 * After the client's close() sends FIN, the kernel ACKs it but this
	 * side never sends its own FIN → connfd stays in CLOSE_WAIT.
	 */
	printf("[case1] holding connfd=%d open — server will be in CLOSE_WAIT\n",
	       connfd);
	printf("[case1] check: ss -tnp | grep %d\n\n", PORT1);

	while (keep_running)
		sleep(1);

	close(connfd);
	return NULL;
}

/*
 * Case 2: server closes first.
 * Server calls close(connfd) immediately → sends FIN to client.
 * Client (which never calls close) enters CLOSE_WAIT.
 */
static void *case2_thread(void *arg)
{
	int listenfd = make_listener(PORT2);
	printf("[case2] listening on port %d\n", PORT2);

	struct sockaddr_in peer;
	socklen_t plen = sizeof(peer);
	int connfd = accept(listenfd, (struct sockaddr *)&peer, &plen);
	close(listenfd);
	printf("[case2] accepted %s:%d, listenfd closed\n",
	       inet_ntoa(peer.sin_addr), ntohs(peer.sin_port));

	char buf[BUFSIZE];
	int n = read(connfd, buf, BUFSIZE - 1);
	if (n > 0) {
		buf[n] = '\0';
		printf("[case2] received: \"%s\"\n", buf);
	}

	/* Close immediately — sends FIN to client, client enters CLOSE_WAIT. */
	close(connfd);
	printf("[case2] connfd closed (FIN sent to client)\n");
	printf("[case2] client should now be in CLOSE_WAIT\n");
	printf("[case2] check: ss -tnp | grep %d\n\n", PORT2);

	return NULL;
}

int main(void)
{
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
